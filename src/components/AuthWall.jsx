// R9 — the sign-in wall, shown on the 8th swipe-action.
//
// Two rules from the spec shape everything here, and both are ethics
// commitments rather than UX preferences (NG3):
//
//   1. It states plainly what it is. No countdown, no "offer ends", no
//      invented scarcity. The honest reason — swipes past this point need
//      somewhere to live — is also the persuasive one.
//   2. It gates PARTICIPATION, not ACCESS. The card behind stays readable,
//      Kept and Discover stay open, and the wall is dismissable. We are
//      asking someone to keep what they have built, not holding it hostage.
//
// Dismissing is a real choice with a real consequence (swipes stay blocked),
// so it's a button, not a hidden ✕.

import { useEffect, useState } from 'react'
import { signInWithGoogle } from '../lib/session.js'
import { haptic } from '../lib/haptics.js'
import { track, EV } from '../lib/analytics.js'

export default function AuthWall({ swipeCount, keptCount, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Coming back from a cancelled Google flow re-mounts this with busy stuck
  // from the previous attempt in some browsers; start clean every time.
  useEffect(() => {
    setBusy(false)
  }, [])

  async function go() {
    haptic.tap()
    setBusy(true)
    setErr('')

    // Watchdog. `busy` disables the button, and the success path never cleared
    // it because the browser was assumed to have navigated away. When the
    // navigation didn't happen — which is what mobile was doing — the button
    // stayed disabled reading "Opening Google…" forever, so every further tap
    // did nothing. A stuck control is worse than a failed one: it gives the
    // user no way to retry and no reason why.
    const watchdog = setTimeout(() => {
      setBusy(false)
      setErr("Google didn't open. Tap again, or open Curio in Safari or Chrome rather than inside another app.")
      track(EV.SIGNUP_FAILED, { reason: 'navigation_blocked' })
    }, 4000)

    const { error } = await signInWithGoogle()
    if (error) {
      clearTimeout(watchdog)
      // Fail closed on the gate, open on reading (R9 exceptions).
      setErr(error)
      setBusy(false)
      haptic.error()
      track(EV.SIGNUP_FAILED, { reason: 'provider_error' })
    }
    // On success the browser navigates away and the watchdog never fires.
  }

  function dismiss() {
    track(EV.SIGNUP_ABANDONED, { swipe_count: swipeCount, kept_count: keptCount })
    onDismiss()
  }

  return (
    <div className="sheet-backdrop" onClick={dismiss}>
      <div className="sheet auth-wall" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />

        <h3 className="auth-title">Keep what you&apos;ve built</h3>

        <p className="auth-body">
          You&apos;ve swiped {swipeCount} cards and your feed has learned from every one.
          Sign in and it stays yours — on this device and any other.
        </p>

        {keptCount > 0 && (
          <p className="auth-body dim">
            That includes the {keptCount} card{keptCount === 1 ? '' : 's'} in your Kept pile.
          </p>
        )}

        {err && <div className="err">{err}</div>}

        <button className="btn-primary auth-google" onClick={go} disabled={busy}>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <button className="btn-ghost auth-later" onClick={dismiss}>
          Not now — keep reading
        </button>

        <p className="auth-fine">
          Reading, your Kept pile and Discover stay open either way. Signing in is what
          lets new swipes count.
        </p>
      </div>
    </div>
  )
}
