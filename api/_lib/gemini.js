// Gemini provider — interim stand-in for the Sonnet/Haiku pair while
// Anthropic credits clear.
//
// Facts established by probing the API rather than from memory:
//   • Structured output (responseSchema) requires the **v1beta** path. On v1
//     the API replies: "JSON mode is not enabled for api version v1."
//   • Newer models (gemini-3.x) are real but intermittently return 503
//     "high demand", so the pipeline defaults to models that answered
//     reliably. Everything goes through retry regardless.
//   • Schema types are UPPERCASE OpenAPI-style ("OBJECT"/"STRING"), not the
//     JSON-Schema lowercase Anthropic uses, and `additionalProperties` is not
//     supported — so the schemas here are deliberately not shared with the
//     Anthropic ones.
//
// The structural rule from the spec still holds: the verifier is a DIFFERENT
// model from the generator. Worth stating the caveat honestly — two models
// from one family is a weaker independent check than a cross-vendor pair, so
// this is an interim arrangement, not the target design.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Chosen by probing THIS key against a REAL workload, not from documentation.
// Three traps found, each of which would have been a silent production bug:
//   • ListModels returns models the key cannot call — gemini-2.5-flash-lite is
//     listed but 404s with "no longer available to new users". ListModels is
//     not an availability signal.
//   • gemini-2.5-pro / 2.0-flash* return 429: no free-tier quota on this key.
//   • gemini-3.5-flash passes a toy probe but 503s ("high demand") on a real
//     31k-character source. Probe-sized tests do not predict real capacity.
//
// So: primaries are what survived a genuine generate call, and each has an
// alternate to fall back to when capacity bites mid-run.
export const GEMINI_GENERATOR = 'gemini-2.5-flash'
export const GEMINI_VERIFIER = 'gemini-3.5-flash-lite'

// Tried in order when the primary is capacity-limited (503/429). Keeping the
// verifier list disjoint from the generator preserves the spec's rule that the
// checker is never the model that wrote the card.
const GENERATOR_FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.6-flash']
const VERIFIER_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite']

/** Gemini's free tier bills nothing; token counts are still recorded. */
const COST_USD = 0

async function callGemini({ model, system, user, schema, maxOutputTokens = 2048, attempts = 3 }) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      maxOutputTokens,
    },
  }

  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const delay = 600 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5)
      await new Promise((r) => setTimeout(r, delay))
    }
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000), // generation is slower than a plain GET
      })

      // 503 "high demand" and 429 quota are both worth another attempt.
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        lastError = new Error(`gemini ${res.status}`)
        continue
      }

      const text = await res.text()
      if (!res.ok) throw new Error(`gemini ${res.status}: ${text.slice(0, 200)}`)
      if (!text) {
        // Empty 2xx body has been observed on flaky links — retry rather than
        // crash the run on a JSON.parse of "".
        lastError = new Error('empty response body')
        continue
      }

      const data = JSON.parse(text)
      const candidate = data.candidates?.[0]
      if (!candidate) throw new Error(`no candidate: ${text.slice(0, 200)}`)

      // A truncated response yields invalid JSON — surface it as retryable
      // rather than letting JSON.parse throw an opaque syntax error.
      const out = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('')
      let parsed
      try {
        parsed = JSON.parse(out)
      } catch {
        lastError = new Error(`unparseable output (finishReason=${candidate.finishReason})`)
        continue
      }

      const usage = data.usageMetadata ?? {}
      return {
        parsed,
        model,
        usage: {
          input_tokens: usage.promptTokenCount ?? 0,
          output_tokens: usage.candidatesTokenCount ?? 0,
        },
        cost: COST_USD,
      }
    } catch (err) {
      if (err.message?.startsWith('gemini 4')) throw err // client error — don't retry
      lastError = err
    }
  }
  throw new Error(`gemini call failed after ${attempts} attempts: ${lastError?.message}`)
}

/**
 * Call the first model in `models` that has capacity.
 *
 * Free-tier capacity is genuinely unreliable: a model that answers a small
 * probe can still 503 on a real request. Retrying the SAME model harder does
 * not help when the model itself is saturated — moving to a sibling does.
 */
async function callWithModelFallback({ models, ...args }) {
  let lastError
  for (const model of models) {
    try {
      return await callGemini({ model, ...args })
    } catch (err) {
      // Capacity/availability problems are worth trying the next model for.
      // A genuine client error (bad schema, bad request) would repeat, so stop.
      const capacity = /50\d|429|no longer available|failed after/.test(err.message)
      if (!capacity) throw err
      lastError = err
    }
  }
  throw new Error(`all models exhausted (${models.join(', ')}): ${lastError?.message}`)
}

// ── Schemas (Gemini dialect: uppercase types, no additionalProperties) ──

const CARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Short, curiosity-provoking, under 60 characters.' },
    body: { type: 'STRING', description: 'About 150 words, one paragraph, plain prose.' },
  },
  required: ['title', 'body'],
  propertyOrdering: ['title', 'body'],
}

const VERDICT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    unsupported_claims: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Claims in the card not directly supported by the source. Empty if all supported.',
    },
  },
  required: ['unsupported_claims'],
}

// Prompts are intentionally identical in intent to the Anthropic ones, so
// swapping providers changes the model, not the product's editorial rules.
const GENERATE_SYSTEM = `You write short, factual knowledge cards for Curio, a source-grounded reading app for Indian readers aged 18-30.

Rules, in order of importance:
1. Every single fact in the card MUST appear in the source text provided. Add nothing — no context you happen to know, no dates, no numbers, no names that are not in the source. If the source does not say it, it does not go in the card.
2. If you are unsure whether something is in the source, leave it out.
3. Write ~150 words of clean prose in one paragraph. No bullet points, no headings, no markdown.
4. Lead with the most surprising or concrete thing, not with background.
5. Plain, direct language. Explain jargon in-line. Do not address the reader as "you", and do not editorialise.

Your output is checked against the source by a separate fact-checking model. Claims you invent will be caught and the card discarded.`

const VERIFY_SYSTEM = `You are a fact-checker. You are given a source text and a card written from it.

Your only job: list every claim in the card that is NOT directly supported by the source text.

Guidance:
- A claim is supported only if the source text states it. Do not use your own knowledge to excuse a claim — a fact can be true in the world and still be unsupported by THIS source.
- Rewording and summarising are fine. A claim is supported if the source says the same thing in different words.
- Reasonable paraphrase and compression are not errors. Added specifics are: a date, number, name, or causal link that the source does not contain is unsupported.
- If every claim is supported, return an empty array.

Be strict. A card that passes will be shown to readers as fact-checked.`

export async function geminiGenerateCard({ source, topicName, subtopicName }) {
  const r = await callWithModelFallback({
    models: GENERATOR_FALLBACKS,
    system: GENERATE_SYSTEM,
    user: `Topic: ${topicName}${subtopicName ? ` › ${subtopicName}` : ''}
Source title: ${source.title}

<source_text>
${source.text.slice(0, 12000)}
</source_text>

Write one Curio card grounded strictly in the source text above.`,
    schema: CARD_SCHEMA,
    maxOutputTokens: 2048,
  })
  return { title: r.parsed.title, body: r.parsed.body, model: r.model, usage: r.usage, cost: r.cost }
}

export async function geminiVerifyCard({ source, card }) {
  const r = await callWithModelFallback({
    models: VERIFIER_FALLBACKS,
    system: VERIFY_SYSTEM,
    user: `<source_text>
${source.text.slice(0, 12000)}
</source_text>

<card>
Title: ${card.title}

${card.body}
</card>

Does this card contain any claim not directly supported by the source text above? List the unsupported claims.`,
    schema: VERDICT_SCHEMA,
    maxOutputTokens: 1024,
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
