// Judge a typed quiz guess against the card's answer — client-side, instant.
//
// Deliberately NOT an LLM call: R2 forbids generation in the serving path,
// and a guess-check that costs a network round trip would make the core
// mechanic feel broken on a slow connection. A token matcher is honest about
// what it is — generous, occasionally wrong — which is why every caller
// reveals the real answer right after the verdict and (in the recall quiz)
// lets the user overrule a wrong "wrong".
//
// The rules, in order of what actually discriminates:
//   1. Tokens that also appear in the QUESTION prove nothing. "How many
//      years has DDLJ been running?" → a guess of "50 years" must not pass
//      because "years" shows up in the answer text.
//   2. If the guess contains a number, numbers decide. "30" passes against
//      "running for over 30 years"; "25" fails. Number words count ("thirty"
//      → 30), including the Indian counters lakh/crore.
//   3. Otherwise any content token of the guess (≥3 chars, not a stopword)
//      matching an answer token by 4-char prefix passes — "Mumbai" matches
//      "Mumbai's", "kohli" matches "Kohli".

const STOP = new Set(
  ('a an the is are was were be been being do does did has have had of in on at to for from by with ' +
    'about as into over under and or not no yes it its this that these those i you he she they we my ' +
    'your his her their our me him them us there here when where what which who how why whom most more ' +
    'many much some any all both each few other than then so if because while during before after').split(' ')
)

const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  lakh: 100000, million: 1000000, crore: 10000000, billion: 1000000000,
}

function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    // Grouped digits collapse BEFORE punctuation splits, or "73,000" becomes
    // the tokens "73"+"000" and the correct guess "73000" is judged wrong
    // (found live). Applied to guess and answer alike, so "73,000" and
    // "73000" normalize identically whichever side they're on.
    .replace(/(\d)[.,](?=\d)/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation splits — "30-year" → "30 year"
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t in NUM_WORDS ? String(NUM_WORDS[t]) : t))
}

const isNum = (t) => /^\d+$/.test(t)

/**
 * True when `guess` plausibly matches `answer`, given the `question` whose
 * words carry no evidence. Empty/contentless guesses are always false.
 */
export function guessMatches(guess, answer, question = '') {
  const qTokens = new Set(tokens(question))
  const aTokens = tokens(answer)
  // Content tokens of the guess: not stopwords, not words the question
  // already handed the user.
  const gTokens = tokens(guess).filter((t) => !STOP.has(t) && !qTokens.has(t))
  if (!gTokens.length) return false

  const gNums = gTokens.filter(isNum)
  if (gNums.length) {
    const aNums = new Set(aTokens.filter(isNum))
    return gNums.some((n) => aNums.has(n))
  }

  // Prefix match both directions at 4 chars, so plurals, possessives and
  // light stemming all connect ("temples" ~ "temple", "kohli" ~ "kohlis").
  const aContent = aTokens.filter((t) => !STOP.has(t))
  return gTokens.some((g) =>
    aContent.some((a) => {
      const n = Math.min(Math.max(g.length, a.length) >= 4 ? 4 : 3, g.length, a.length)
      return g.length >= 3 && a.length >= 3 && g.slice(0, n) === a.slice(0, n)
    })
  )
}
