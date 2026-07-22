// Card generation + verification (spec R10 steps 3–4).
//
// The model split is the whole point: Sonnet writes the card, Haiku checks it
// against the source, and the verifier is NEVER the generator — a model
// grading its own output is not a check. A card only reaches `verified: true`
// if Haiku finds zero unsupported claims.
//
// Both calls use structured outputs (output_config.format), so we never parse
// prose or rely on the model formatting JSON correctly by luck.

import Anthropic from '@anthropic-ai/sdk'
import {
  geminiGenerateCard,
  geminiVerifyCard,
  GEMINI_GENERATOR,
  GEMINI_VERIFIER,
} from './gemini.js'

const GENERATOR = 'claude-sonnet-5'
const VERIFIER = 'claude-haiku-4-5'

/**
 * Which provider runs the generate/verify pair.
 *
 * Anthropic (Sonnet writes, Haiku checks) is the target design and wins
 * whenever its key is present. Gemini is an interim stand-in so the pipeline
 * isn't blocked on billing — same two-model structure, same prompts, weaker
 * independence (both verifier and generator come from one family).
 *
 * Set PROVIDER=gemini to force Gemini even when an Anthropic key exists.
 */
export function activeProvider() {
  const forced = process.env.PROVIDER
  if (forced === 'gemini') return 'gemini'
  if (forced === 'anthropic') return 'anthropic'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  throw new Error('no model provider configured (set ANTHROPIC_API_KEY or GEMINI_API_KEY)')
}

// Standard list prices per million tokens. Used for the per-card cost figure
// recorded on every row (spec R10: "records model version and processing cost
// so cost and quality can be compared across versions"). Deliberately the
// standard rate, not the promotional one — an over-estimate is the safe
// direction for a cost cap.
const PRICING = {
  [GENERATOR]: { in: 3 / 1e6, out: 15 / 1e6 },
  [VERIFIER]: { in: 1 / 1e6, out: 5 / 1e6 },
}

function costOf(model, usage) {
  const p = PRICING[model]
  if (!p || !usage) return 0
  return (usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out
}

let client
function anthropic() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
    client = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return client
}

/** Pull the first text block out of a response and JSON.parse it. */
function parsed(response) {
  const block = response.content.find((b) => b.type === 'text')
  if (!block) throw new Error('no text block in response')
  return JSON.parse(block.text)
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Sonnet generates
// ─────────────────────────────────────────────────────────────

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'A short, curiosity-provoking title, under 60 characters. Not clickbait — it must be accurate to the card body.',
    },
    body: {
      type: 'string',
      description:
        'The card text: roughly 150 words, a single paragraph, plain prose. Every fact must appear in the source.',
    },
  },
  required: ['title', 'body'],
  additionalProperties: false,
}

const GENERATE_SYSTEM = `You write short, factual knowledge cards for Curio, a source-grounded reading app for Indian readers aged 18-30.

Rules, in order of importance:
1. Every single fact in the card MUST appear in the source text provided. Add nothing — no context you happen to know, no dates, no numbers, no names that are not in the source. If the source does not say it, it does not go in the card.
2. If you are unsure whether something is in the source, leave it out.
3. Write ~150 words of clean prose in one paragraph. No bullet points, no headings, no markdown.
4. Lead with the most surprising or concrete thing, not with background.
5. Plain, direct language. Explain jargon in-line. Do not address the reader as "you", and do not editorialise.

Your output is checked against the source by a separate fact-checking model. Claims you invent will be caught and the card discarded.`

/**
 * Generate one card from a source document.
 * Returns { title, body, usage, cost, model }.
 */
export async function generateCard({ source, topicName, subtopicName }) {
  const response = await anthropic().messages.create({
    model: GENERATOR,
    max_tokens: 4000,
    system: GENERATE_SYSTEM,
    output_config: {
      // Low effort: this is grounded summarisation, not reasoning. Keeps
      // per-card cost down, which is what makes the pipeline affordable.
      effort: 'low',
      format: { type: 'json_schema', schema: CARD_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `Topic: ${topicName}${subtopicName ? ` › ${subtopicName}` : ''}
Source title: ${source.title}

<source_text>
${source.text.slice(0, 12000)}
</source_text>

Write one Curio card grounded strictly in the source text above.`,
      },
    ],
  })

  const card = parsed(response)
  return {
    ...card,
    model: GENERATOR,
    usage: response.usage,
    cost: costOf(GENERATOR, response.usage),
  }
}

// ─────────────────────────────────────────────────────────────
// Step 4 — Haiku verifies (the gate)
// ─────────────────────────────────────────────────────────────

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    unsupported_claims: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Every claim in the card that is not directly supported by the source text. Empty array if all claims are supported.',
    },
  },
  required: ['unsupported_claims'],
  additionalProperties: false,
}

const VERIFY_SYSTEM = `You are a fact-checker. You are given a source text and a card written from it.

Your only job: list every claim in the card that is NOT directly supported by the source text.

Guidance:
- A claim is supported only if the source text states it. Do not use your own knowledge to excuse a claim — a fact can be true in the world and still be unsupported by THIS source.
- Rewording and summarising are fine. A claim is supported if the source says the same thing in different words.
- Reasonable paraphrase and compression are not errors. Added specifics are: a date, number, name, or causal link that the source does not contain is unsupported.
- If every claim is supported, return an empty array.

Be strict. A card that passes will be shown to readers as fact-checked.`

/**
 * Check a generated card against its source.
 * Returns { verified, unsupportedClaims, usage, cost, model }.
 */
export async function verifyCard({ source, card }) {
  const response = await anthropic().messages.create({
    model: VERIFIER,
    max_tokens: 2000,
    system: VERIFY_SYSTEM,
    // NOTE: no `effort` here. Haiku 4.5 does not support the effort parameter
    // and rejects it — only `format` goes in output_config for this model.
    output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `<source_text>
${source.text.slice(0, 12000)}
</source_text>

<card>
Title: ${card.title}

${card.body}
</card>

Does this card contain any claim not directly supported by the source text above? List the unsupported claims.`,
      },
    ],
  })

  const verdict = parsed(response)
  const unsupportedClaims = verdict.unsupported_claims ?? []

  return {
    verified: unsupportedClaims.length === 0,
    unsupportedClaims,
    model: VERIFIER,
    usage: response.usage,
    cost: costOf(VERIFIER, response.usage),
  }
}

// ─────────────────────────────────────────────────────────────
// Generate → verify → (retry) → discard
// ─────────────────────────────────────────────────────────────

/**
 * Produce one verified card, or null.
 *
 * Retries generation a bounded number of times when verification flags claims
 * (spec NFR: bounded at 2 retries per card, then discard). Never returns an
 * unverified card — "fail closed" is the entire point of the gate.
 */
export async function generateVerifiedCard({ source, topicName, subtopicName, maxRetries = 2 }) {
  const provider = activeProvider()
  const gen = provider === 'gemini' ? geminiGenerateCard : generateCard
  const check_ = provider === 'gemini' ? geminiVerifyCard : verifyCard

  let cost = 0
  let attempts = 0
  let lastFlags = []

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++
    const card = await gen({ source, topicName, subtopicName })
    cost += card.cost

    const check = await check_({ source, card })
    cost += check.cost

    if (check.verified) {
      return {
        card,
        verified: true,
        attempts,
        cost,
        generatorModel: card.model,
        verifierModel: check.model,
      }
    }
    lastFlags = check.unsupportedClaims
  }

  // Exhausted retries — discard. Nothing unverified is ever stored.
  return { card: null, verified: false, attempts, cost, flags: lastFlags }
}

export { GENERATOR, VERIFIER }
