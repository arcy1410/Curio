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
import { geminiGenerateCard, geminiVerifyCard } from './gemini.js'
import { openaiGenerateCard, openaiVerifyCard, openaiGenerateQuiz } from './openai.js'
import { GENERATE_SYSTEM, VERIFY_SYSTEM } from './prompts.js'

const GENERATOR = 'claude-sonnet-5'
const VERIFIER = 'claude-haiku-4-5'

// "~150 words / a 2-minute read" is a product promise, not a preference.
// Cards outside this band are regenerated rather than published.
const WORD_MIN = 120
const WORD_MAX = 170

/**
 * Which provider runs the generate/verify pair.
 *
 * Preference order when nothing is forced:
 *   1. Anthropic — the target design (Sonnet writes, Haiku checks).
 *   2. OpenAI — paid, so no free-tier quota cliff; the reliable interim.
 *   3. Gemini — free, but quota-capped; the fallback interim.
 *
 * Force any of them with PROVIDER=anthropic|openai|gemini.
 */
export function activeProvider() {
  const forced = process.env.PROVIDER
  if (['anthropic', 'openai', 'gemini'].includes(forced)) return forced
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  throw new Error('no model provider configured (set ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)')
}

// The generate/verify pair for a provider.
const PROVIDERS = {
  anthropic: { gen: null, check: null }, // filled below (defined later in file)
  openai: { gen: openaiGenerateCard, check: openaiVerifyCard },
  gemini: { gen: geminiGenerateCard, check: geminiVerifyCard },
}

/**
 * The spec's core trust mechanism is an INDEPENDENT check — the verifier must
 * not be the generator, and ideally not even the same vendor. Same-vendor
 * pairs (both OpenAI, both Gemini) are the honestly-weaker interim.
 *
 * VERIFY_PROVIDER lets the verify step run on a DIFFERENT vendor from generate
 * — e.g. PROVIDER=openai VERIFY_PROVIDER=gemini gives a genuine cross-vendor
 * pair, stronger independence than even the same-vendor Anthropic target. It
 * trades reliability for that: the verify half then depends on the chosen
 * provider's availability (Gemini's free tier can 429).
 */
function verifyProvider() {
  const v = process.env.VERIFY_PROVIDER
  return ['anthropic', 'openai', 'gemini'].includes(v) ? v : null
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
  // Anthropic's pair lives in this file (generateCard/verifyCard); the others
  // are imported. PROVIDERS.anthropic is wired here rather than at definition
  // because those functions are declared later in the module.
  PROVIDERS.anthropic.gen = generateCard
  PROVIDERS.anthropic.check = verifyCard

  const genProvider = activeProvider()
  const chkProvider = verifyProvider() || genProvider
  const gen = PROVIDERS[genProvider].gen
  const check_ = PROVIDERS[chkProvider].check

  let cost = 0
  let attempts = 0
  let lastFlags = []

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++
    const card = await gen({ source, topicName, subtopicName })
    cost += card.cost

    // Length is part of the product promise ("a 2-minute read", ~150 words),
    // so an over-long card is a failed attempt, not a publishable one. Checked
    // before verification because it's free and rejects early.
    const words = card.body.trim().split(/\s+/).length
    if (words < WORD_MIN || words > WORD_MAX) {
      lastFlags = [`length out of budget: ${words} words (allowed ${WORD_MIN}-${WORD_MAX})`]
      continue
    }

    const check = await check_({ source, card })
    cost += check.cost

    if (check.verified) {
      // Quiz layer (redesign). Only ever added to a card that already passed
      // verification, and the quiz's own answer is checked against the source
      // too — a "guess first" answer is a claim shown to the reader as fact,
      // so it gets the same gate as the card body. A failed or unverifiable
      // quiz degrades the card to the editorial treatment; it never blocks a
      // verified card from publishing.
      let quiz = null
      if (genProvider === 'openai') {
        try {
          const q = await openaiGenerateQuiz({ source, card })
          cost += q.cost
          const qCheck = await check_({
            source,
            card: { title: q.quizQuestion, body: q.quizAnswer },
          })
          cost += qCheck.cost
          if (qCheck.verified) quiz = q
        } catch {
          // leave quiz null — the card still ships
        }
      }

      return {
        card,
        quiz,
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
