import { TOPICS } from '../data/topics.js'
import { topicDistribution } from '../lib/scoring.js'
import { haptic } from '../lib/haptics.js'

// Profile + the mocked Curio+ paywall. No real payment processor — the locked
// state is a deliberate conversion-nudge pattern, shown even though nothing is
// wired up (per the brief).
export default function Profile({ state, onReset, onUpgradeAttempt, onEditInterests }) {
  const swipeCount = state.swipes.length
  const keepCount = state.kept.length
  const dist = topicDistribution(state.topicScores)
  const top3 = [...TOPICS].sort((a, b) => (dist[b.id] ?? 0) - (dist[a.id] ?? 0)).slice(0, 3)

  return (
    <div>
      <div className="kept-head">
        <h1>Your Curio</h1>
        <p>A quiet record of what you&apos;re learning.</p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          margin: '18px 0 8px',
        }}
      >
        {[
          { n: swipeCount, l: 'Swiped' },
          { n: keepCount, l: 'Kept' },
          { n: state.interests.length, l: 'Interests' },
        ].map((s) => (
          <div key={s.l} className="stat-tile">
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Top interests */}
      <div style={{ margin: '16px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>
        You lean toward
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        {top3.map((t) => (
          <span
            key={t.id}
            className="chip"
            style={{
              fontSize: 13,
              padding: '6px 12px',
              background: `color-mix(in srgb, ${t.color} 16%, transparent)`,
              borderColor: `color-mix(in srgb, ${t.color} 35%, transparent)`,
              color: t.color,
              fontWeight: 700,
            }}
          >
            {t.emoji} {t.name} · {Math.round((dist[t.id] ?? 0) * 100)}%
          </span>
        ))}
      </div>

      <button
        className="btn-ghost"
        style={{ width: '100%', marginTop: 14 }}
        onClick={onEditInterests}
      >
        ✎ Edit interests
      </button>

      {/* Locked Curio+ element example */}
      <div className="locked" style={{ marginTop: 20 }}>
        <div className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Weekly learning digest</span>
          <span className="lock-badge">🔒 Curio+</span>
        </div>
        <div
          className="veil"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, marginBottom: 6 }}>
            You kept 12 cards across 4 topics this week
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            Your curiosity is trending toward Markets. Here are 5 threads to go deeper on,
            plus a 3-question recap quiz to make it stick…
          </div>
        </div>
      </div>

      {/* Curio+ upsell */}
      <div className="plus-card">
        <div className="kicker">Curio+</div>
        <h3>Turn swipes into knowledge that sticks</h3>
        <p>Everything in Curio, plus the tools that make it actually retain.</p>
        <ul>
          <li>
            <span className="ic">✦</span> Weekly digest &amp; recap quizzes on what you kept
          </li>
          <li>
            <span className="ic">✦</span> Ask “why?” follow-ups on any card (AI Tutor)
          </li>
          <li>
            <span className="ic">✦</span> Unlimited kept pile &amp; PDF export
          </li>
          <li>
            <span className="ic">✦</span> Audio narration for hands-free reading
          </li>
        </ul>
        <button className="buy" onClick={onUpgradeAttempt}>
          Go Curio+ · ₹149/mo
        </button>
        <div className="fine">Prototype — no payment is processed.</div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          className="btn-ghost"
          onClick={() => {
            haptic.tap()
            onReset()
          }}
        >
          Reset prototype
        </button>
      </div>
    </div>
  )
}
