import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initAnalytics, track, EV } from './lib/analytics.js'

initAnalytics()
track(EV.APP_OPENED)

// Session-length telemetry (§6 guardrail + future DAU/MAU basis).
// A "session" here is one continuous foreground stint: we fire session_ended
// with the stint's duration whenever the tab is hidden/left, and restart the
// clock when it becomes visible again. Summing stints per distinct_id/day
// gives total daily usage; the per-stint duration is the doom-scroll
// guardrail signal (NG3).
let sessionStart = Date.now()
let sessionOpen = true

function endSession() {
  if (!sessionOpen) return
  sessionOpen = false
  track(EV.SESSION_ENDED, {
    duration_s: Math.max(0, Math.round((Date.now() - sessionStart) / 1000)),
  })
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    endSession()
  } else if (document.visibilityState === 'visible' && !sessionOpen) {
    sessionStart = Date.now()
    sessionOpen = true
  }
})
// pagehide catches closes/navigations where visibilitychange may not fire
window.addEventListener('pagehide', endSession)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
