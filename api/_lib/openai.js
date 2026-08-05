// OpenAI provider for the R10 pipeline.
//
// Why this exists alongside gemini.js: the Gemini free tier is quota-capped
// (a real pipeline run hit daily 429s), which caps how many cards a day the
// pipeline can make. This key is PAID, so it removes the quota cliff — the
// pipeline can run to completion instead of stalling mid-run.
//
// Facts established by probing THIS key against a real card, not from memory
// (the lesson from gemini.js: a model that ListModels returns is not
// necessarily one you should use):
//   • gpt-4.1-mini generates a faithful ~150-word card in ~1.2s. The gpt-5
//     family also works but spends 9s and up to 1600 tokens REASONING about a
//     task — grounded summarisation — that needs no reasoning. Wrong tool.
//   • The verifier MUST be a reasoning model. gpt-4o-mini and gpt-4.1-mini
//     both FALSE-POSITIVED on a real 24k-char source — asked to check "known
//     as the Paris of India", a phrase literally in the article, they flagged
//     it as unsupported because they don't retrieve reliably over long
//     context. A verifier that rejects faithful claims burns good cards and
//     wastes spend, which is worse than plumbing that doesn't run. gpt-5-mini
//     (which reasons over the source) finds the phrase and does not flag it —
//     at ~7s per check versus ~1s, a cost the verify step is worth paying.
//     (My short Taj-Mahal probe missed this: probe-sized sources don't
//     surface the retrieval failure. Only a real article did.)
//   • Structured output uses response_format:{type:'json_schema',strict:true}.
//
// HONEST CAVEAT, same as Gemini: generator and verifier are both OpenAI, so
// this is a weaker independent check than a cross-vendor pair. A genuinely
// independent arrangement — OpenAI generates, Gemini verifies — is available
// via VERIFY_PROVIDER and is the stronger version of the spec's verify step.
import { GENERATE_SYSTEM, VERIFY_SYSTEM } from './prompts.js'

const BASE = 'https://api.openai.com/v1/chat/completions'

export const OPENAI_GENERATOR = 'gpt-4.1-mini'
export const OPENAI_VERIFIER = 'gpt-5-mini' // reasoning verifier — see note above

// Approximate list prices per million tokens (paid key — real cost, unlike
// Gemini's $0). Rounded/estimated, and deliberately not promotional rates: an
// over-estimate is the safe direction for the per-card cost figure R10
// records. gpt-5-mini's reasoning tokens bill as output, so verify is the
// pricier half despite the smaller prompt.
const PRICING = {
  [OPENAI_GENERATOR]: { in: 0.4 / 1e6, out: 1.6 / 1e6 },
  [OPENAI_VERIFIER]: { in: 0.25 / 1e6, out: 2.0 / 1e6 },
}

function costOf(model, usage) {
  const p = PRICING[model]
  if (!p || !usage) return 0
  return (usage.prompt_tokens || 0) * p.in + (usage.completion_tokens || 0) * p.out
}

async function callOpenAI({ model, system, user, schema, schemaName, maxTokens = 1200, attempts = 3 }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    max_completion_tokens: maxTokens,
  }

  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const delay = 600 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5)
      await new Promise((r) => setTimeout(r, delay))
    }
    try {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      })

      // 429 (rate/quota) and 5xx are transient; retry. 4xx else is a real
      // client error — surface it rather than retrying a request that will
      // fail identically.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`openai ${res.status}`)
        continue
      }
      const text = await res.text()
      if (!res.ok) throw new Error(`openai ${res.status}: ${text.slice(0, 200)}`)

      const data = JSON.parse(text)
      const choice = data.choices?.[0]
      // A refusal or a length-truncated response yields no usable content.
      if (choice?.finish_reason === 'length') {
        lastError = new Error('truncated (hit max_completion_tokens)')
        continue
      }
      const out = choice?.message?.content
      if (!out) throw new Error(`no content: ${text.slice(0, 200)}`)

      return {
        parsed: JSON.parse(out),
        model,
        usage: data.usage,
        cost: costOf(model, data.usage),
      }
    } catch (err) {
      if (/openai 4/.test(err.message)) throw err // client error — don't retry
      lastError = err
    }
  }
  throw new Error(`openai call failed after ${attempts} attempts: ${lastError?.message}`)
}

// Schemas — OpenAI strict mode requires additionalProperties:false and every
// property listed in `required`.
const CARD_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    unsupported_claims: { type: 'array', items: { type: 'string' } },
  },
  required: ['unsupported_claims'],
  additionalProperties: false,
}

// Prompts are intentionally identical to the Anthropic/Gemini ones — swapping
// providers changes the model, never the editorial rules.
export async function openaiGenerateCard({ source, topicName, subtopicName }) {
  const r = await callOpenAI({
    model: OPENAI_GENERATOR,
    schemaName: 'card',
    schema: CARD_SCHEMA,
    system: GENERATE_SYSTEM,
    user: `Topic: ${topicName}${subtopicName ? ` › ${subtopicName}` : ''}
Source title: ${source.title}

<source_text>
${source.text.slice(0, 12000)}
</source_text>

Write one Curio card grounded strictly in the source text above.`,
    maxTokens: 1200,
  })
  return { title: r.parsed.title, body: r.parsed.body, model: r.model, usage: r.usage, cost: r.cost }
}

const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    quiz_question: { type: 'string' },
    quiz_answer: { type: 'string' },
    stat: { type: 'string' },
    stat_label: { type: 'string' },
  },
  required: ['quiz_question', 'quiz_answer', 'stat', 'stat_label'],
  additionalProperties: false,
}

const QUIZ_SYSTEM = `You turn a factual card into a "guess first" quiz for Curio.

Produce four things:
1. quiz_question — ONE question, under 90 characters, whose answer is the single most surprising fact in the card. It must be answerable from the card, and interesting to guess at: prefer "how many", "where", "how long" over yes/no. Never ask something the question itself gives away.
2. quiz_answer — the answer in 1-2 plain sentences, under 220 characters. Every fact must appear in the source text.
3. stat — the single most striking figure, as a SHORT display string: "350M", "1721", "20 years", "43%". Under 10 characters. If the source has no figure, use a short defining phrase instead (e.g. "Ivory marble").
4. stat_label — 2-5 words in plain language saying what the stat counts, e.g. "neurons, mostly in the limbs".

Rules:
- Every fact you write MUST appear in the source text provided. Invent nothing.
- Do not editorialise, and do not use judgement adjectives.
- The question must not repeat the card's title verbatim.`

/**
 * Derive the quiz layer for a card.
 *
 * Grounded on the SOURCE, not on the card body. That distinction is what makes
 * this native-quality rather than a summary-of-a-summary: the quiz sees the
 * same evidence the card was written from, so its answer can carry a detail
 * the card compressed away — and the verifier can check it against the source
 * like any other claim.
 */
export async function openaiGenerateQuiz({ source, card }) {
  const r = await callOpenAI({
    model: OPENAI_GENERATOR,
    schemaName: 'quiz',
    schema: QUIZ_SCHEMA,
    system: QUIZ_SYSTEM,
    user: `<source_text>
${source.text.slice(0, 12000)}
</source_text>

<card>
Title: ${card.title}

${card.body}
</card>

Write the guess-first quiz layer for this card.`,
    maxTokens: 800,
  })
  return {
    quizQuestion: r.parsed.quiz_question,
    quizAnswer: r.parsed.quiz_answer,
    stat: r.parsed.stat,
    statLabel: r.parsed.stat_label,
    model: r.model,
    usage: r.usage,
    cost: r.cost,
  }
}

export async function openaiVerifyCard({ source, card }) {
  const r = await callOpenAI({
    model: OPENAI_VERIFIER,
    schemaName: 'verdict',
    schema: VERDICT_SCHEMA,
    system: VERIFY_SYSTEM,
    user: `<source_text>
${source.text.slice(0, 12000)}
</source_text>

<card>
Title: ${card.title}

${card.body}
</card>

Does this card contain any claim not directly supported by the source text above? List the unsupported claims.`,
    // Generous: gpt-5-mini spends reasoning tokens (billed as completion) before
    // emitting the verdict, and a truncated reasoning pass yields no output.
    maxTokens: 4000,
  })
  const unsupportedClaims = r.parsed.unsupported_claims ?? []
  return {
    verified: unsupportedClaims.length === 0,
    unsupportedClaims,
    model: r.model,
    usage: r.usage,
    cost: r.cost,
  }
}
