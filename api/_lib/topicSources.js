// Topic → source configuration for the content pipeline.
//
// Shared by api/pipeline.js (the scheduled/manual batch run) and
// api/refill.js (single-card, user-triggered top-up when the feed runs
// dry). One copy, one set of editorial filters — the guardrails cannot
// drift apart by living in two files.
//
// How each Curio topic maps onto trending input.
//
// `guardianQuery` is doing the real work here, not `guardianSection`. Guardian
// sections are global: `sport` is dominated by rugby, football and AFL, and a
// section-only pull produced trending items with nothing to do with Indian
// cricket. The query keeps the India-first wedge intact; the section just
// narrows the corpus.
//
// `seeds` are durable Wikipedia articles used to top up a topic when trending
// yields nothing groundable — they keep a run productive on a quiet news day.
// `titleMustMatch` is the India-first guarantee. A body-level query alone let
// a 4,000-word piece on Australian scheduling through because it mentioned the
// IPL once; requiring the signal in the HEADLINE is what actually keeps the
// wedge intact.
//
// `topicMustMatch` answers a question `titleMustMatch` never asks: is this
// about the topic the reader picked? India-relevance and topic-relevance are
// independent, and assuming one implies the other produced two distinct bugs:
//   • resolution drift — a markets headline resolved to the Wikipedia article
//     "Second presidency of Donald Trump", a history headline to "India
//     women's national cricket team". Both India-relevant, neither on topic.
//   • an India-relevant Guardian piece about women's cricket filed under
//     history, because the headline said "India" and nothing checked further.
// So EVERY candidate — the Wikipedia resolution and the Guardian article it
// came from — has to match the topic, or it isn't used.
export const TOPIC_SOURCES = {
  cricket: {
    guardianSection: 'sport',
    guardianQuery: 'cricket AND (India OR Indian OR IPL)',
    titleMustMatch: /\b(india|indian|ipl|kohli|rohit|bumrah|bcci|ranji|mumbai|chennai|kolkata)\b/i,
    topicMustMatch: /\b(cricket|ipl|test match|odi|twenty20|t20|bcci|ranji|wicket|batting|bowling)\b/i,
    seeds: [
      'Indian Premier League',
      'India national cricket team',
      'Cricket World Cup',
      'Sachin Tendulkar',
      'Ranji Trophy',
      'Test cricket',
      'Eden Gardens',
      'Duckworth–Lewis–Stern method',
    ],
  },
  markets: {
    guardianSection: 'business',
    guardianQuery: '(India OR Indian OR rupee OR Sensex OR Mumbai) AND (economy OR markets OR stocks)',
    titleMustMatch: /\b(india|indian|rupee|sensex|nifty|mumbai|adani|ambani|reliance|rbi)\b/i,
    topicMustMatch:
      /\b(econom\w*|market\w*|stock\w*|share\w*|trade|tariff|bank\w*|financ\w*|rupee|sensex|nifty|exchange|inflation|invest\w*|compan\w*|industr\w*|startup)\b/i,
    seeds: [
      'BSE SENSEX',
      'NIFTY 50',
      'Reserve Bank of India',
      'Bombay Stock Exchange',
      'Harshad Mehta',
      'Indian rupee',
      'Demonetisation in India',
      'Securities and Exchange Board of India',
      'Initial public offering',
    ],
  },
  bollywood: {
    guardianSection: 'film',
    guardianQuery: 'Bollywood OR "Hindi cinema" OR "Indian film"',
    titleMustMatch: /\b(bollywood|hindi|india|indian|khan|bachchan|kapoor|mumbai)\b/i,
    topicMustMatch: /\b(film\w*|cinema|movie\w*|bollywood|actor|actress|director|screenplay|filmfare|soundtrack)\b/i,
    seeds: [
      'Bollywood',
      'Cinema of India',
      'Filmfare Awards',
      'Satyajit Ray',
      'Lata Mangeshkar',
      'Mughal-e-Azam',
      'Dilwale Dulhania Le Jayenge',
      'Playback singing',
    ],
  },
  hollywood: {
    // The counterpart to `bollywood`, not a replacement for it: bollywood
    // keeps its India-first headline filter, hollywood deliberately has none,
    // because requiring "India" in a Hollywood headline would return almost
    // nothing. Topic-relevance is still enforced — that guardrail never
    // depended on geography (see the India-first note in CLAUDE.md).
    guardianSection: 'film',
    guardianQuery: 'Hollywood OR "box office" OR Oscars OR "film review"',
    titleMustMatch: null,
    topicMustMatch:
      /\b(film\w*|cinema|movie\w*|hollywood|actor|actress|director|screenplay|oscar\w*|academy award\w*|box office|studio|sequel|franchise)\b/i,
    seeds: [
      'Academy Awards',
      'Cinema of the United States',
      'Blockbuster (entertainment)',
      'Star Wars',
      'Steven Spielberg',
      'Marvel Cinematic Universe',
      'Film score',
      'Practical effects',
    ],
  },
  technology: {
    guardianSection: 'technology',
    guardianQuery: '"artificial intelligence" OR startup OR semiconductor OR software OR "space launch"',
    titleMustMatch: null,
    topicMustMatch:
      /\b(tech\w*|software|hardware|comput\w*|artificial intelligence|\bai\b|machine learning|algorithm\w*|startup\w*|semiconductor|chip\w*|robot\w*|internet|app\w*|data|space|satellite|rocket|launch)\b/i,
    seeds: [
      'Artificial intelligence',
      'Semiconductor industry',
      'Indian Space Research Organisation',
      'Unified Payments Interface',
      'Large language model',
      'Aadhaar',
      'Chandrayaan-3',
      'Open-source software',
    ],
  },
  history: {
    // No section: Guardian files Indian history across culture, world and
    // books. The query and headline filter do the work here.
    guardianSection: null,
    guardianQuery: '"Indian history" OR "ancient India" OR Mughal OR Maurya',
    titleMustMatch: /\b(india|indian|mughal|maurya|ancient|empire|partition|delhi)\b/i,
    // Wider than the others on purpose: "history" in Curio means heritage,
    // religion, archaeology and dynasties, not just articles with "history"
    // in the title. Matched against the article's opening prose, not the bare
    // title — "Shiva" is a perfectly good history source but its title alone
    // says nothing.
    topicMustMatch:
      /\b(histor\w*|ancient|medieval|centur\w*|empire|dynast\w*|kingdom|civilisation|civilization|archaeolog\w*|hindu\w*|buddhis\w*|jain\w*|deit\w*|temple|mughal|maurya|gupta|colonial|partition|independence movement|heritage|monument)\b/i,
    seeds: [
      'History of India',
      'Maurya Empire',
      'Indus Valley Civilisation',
      'Ashoka',
      'Gupta Empire',
      'Chola dynasty',
      'Nalanda mahavihara',
      'Ajanta Caves',
      'Partition of India',
    ],
  },
}
