import { useEffect } from 'react'
import { TOPICS } from '../data/topics.js'
import { topicDistribution } from '../lib/scoring.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

// Profile + the mocked Curio+ paywall. No real payment processor — the locked
// state is a deliberate conversion-nudge pattern, shown even though nothing is
// wired up (per the brief).
export default function Profile({
  state,
  onReset,
  onUpgradeAttempt,
  onEditInterests,
  authUser,
  signedIn,
  onSignIn,
  onSignOut,
  theme = 'light',
  onToggleTheme = () => {},
  streak = 0,
  longest = 0,
  week = [],
}) {
  const swipeCount = state.swipes.length
  const keepCount = state.kept.length
  const dist = topicDistribution(state.topicScores)
  const top3 = [...TOPICS].sort((a, b) => (dist[b.id] ?? 0) - (dist[a.id] ?? 0)).slice(0, 3)

  // The locked Curio+ block is on this screen, so reaching it counts as a
  // paywall impression — the denominator for paywall conversion.
  useEffect(() => {
    track(EV.PAYWALL_VIEWED, { swipes: swipeCount, kept: keepCount })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="kept-head">
        <h1>Your Curio</h1>
        <p>A quiet record of what you&apos;re learning.</p>
      </div>

      {/* Account. Someone who dismissed the wall needs a way back to sign-in
          that isn't "swipe until you're blocked again". */}
      <div className="account-row">
        <div>
          <div className="who">
            {signedIn ? authUser?.email || 'Signed in' : 'Not signed in'}
          </div>
          <div className="sub">
            {signedIn
              ? 'Your feed and Kept pile follow you to any device.'
              : 'Sign in to keep your swipes and Kept pile.'}
          </div>
        </div>
        <button className="btn-ghost" onClick={signedIn ? onSignOut : onSignIn}>
          {signedIn ? 'Sign out' : 'Sign in'}
        </button>
      </div>

      {/* Streak. Presented as a record of what you've done, never as
          something at risk — no "don't lose it", no countdown (NG3). */}
      <div className="streak-card">
        <div className="streak-top">
          <span className="streak-n">{streak}</span>
          <div>
            <div className="streak-label">day streak</div>
            <div className="streak-sub">Longest: {longest} {longest === 1 ? 'day' : 'days'}</div>
          </div>
        </div>
        <div className="week-row">
          {week.map((d, i) => (
            <div key={d.key} className="week-day">
              <span
                className={`sq ${d.complete ? 'done' : ''} ${d.isToday ? 'today' : ''}`}
                title={`${d.done} card${d.done === 1 ? '' : 's'}`}
              />
              <span className="mono">{d.initial}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {[
          { n: swipeCount, l: 'cards swiped' },
          { n: keepCount, l: 'cards kept' },
          { n: state.interests.length, l: 'interests' },
        ].map((s) => (
          <div key={s.l} className="stat-tile">
            <div className="n">{s.n}</div>
            <div className="mono l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Mastery — the same additive scores the feed uses, shown honestly as
          "where your attention is going" rather than as a skill claim we
          cannot evidence. */}
      <div className="section-head mono">What you&apos;re building</div>
      <div className="mastery">
        {top3.map((t) => (
          <div key={t.id} className="mastery-row">
            <div className="mastery-top">
              <span>{t.name}</span>
              <span className="mono">{Math.round((dist[t.id] ?? 0) * 100)}%</span>
            </div>
            <div className="bar">
              <span style={{ width: `${Math.round((dist[t.id] ?? 0) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <button className="btn-ghost wide" onClick={onEditInterests}>
        Edit interests
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

      {/* Light is Curio's default; dark is a mirror of it for people who
          prefer one. An explicit switch rather than following the OS, so the
          product is met in the skin it was designed in. */}
      <div className="pref-row">
        <span>Dark mode</span>
        <button
          className={`switch ${theme === 'dark' ? 'on' : ''}`}
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label="Dark mode"
          onClick={() => {
            haptic.tap()
            onToggleTheme()
          }}
        >
          <span className="knob" />
        </button>
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
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
