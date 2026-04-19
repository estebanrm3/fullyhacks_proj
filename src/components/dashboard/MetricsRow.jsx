// MetricsRow — five HUD tiles in a single strip. Colors track severity:
// distraction counts turn warn-orange the moment they go above zero,
// focus rate stays teal until it drops below 70% / 40%.

function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// Sums time between tab_switch / tab_return pairs — what the student spent away.
function calcTimeAway(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let away = 0
  let outAt = null
  for (const e of sorted) {
    if (e.type === 'tab_switch')  outAt = new Date(e.timestamp).getTime()
    if (e.type === 'tab_return' && outAt) {
      away += new Date(e.timestamp).getTime() - outAt
      outAt = null
    }
  }
  return away
}

function StatTile({ label, value, sub, tone = '' }) {
  return (
    <div className={'stat-tile ' + tone}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function MetricsRow({
  startTime,
  endTime,
  tabSwitches     = 0,
  events          = [],
  cameraAways     = 0,
  phoneDetections = 0,
}) {
  const sessionMs  = startTime && endTime ? new Date(endTime) - new Date(startTime) : 0
  const timeAwayMs = calcTimeAway(events)
  const focusMs    = Math.max(0, sessionMs - timeAwayMs)
  const focusPct   = sessionMs > 0 ? Math.round((focusMs / sessionMs) * 100) : 100

  const awayTone  = timeAwayMs > 0      ? 'warn' : 'good'
  const tabTone   = tabSwitches > 0     ? 'warn' : 'good'
  const camTone   = cameraAways > 2     ? 'bad'  : cameraAways > 0 ? 'warn' : 'good'
  const phoneTone = phoneDetections > 0 ? 'warn' : 'good'
  const focusTone = focusPct >= 70      ? 'good' : focusPct >= 40  ? 'warn' : 'bad'

  return (
    <div className="surf-row-stats">
      <StatTile label="Session Duration" value={formatDuration(sessionMs)} />
      <StatTile
        label="Time Away"
        value={timeAwayMs > 0 ? formatDuration(timeAwayMs) : '0s'}
        sub={`${tabSwitches} tab switch${tabSwitches !== 1 ? 'es' : ''}`}
        tone={awayTone}
      />
      <StatTile label="Tab Switches"  value={tabSwitches}      sub="Times left tab"   tone={tabTone} />
      <StatTile label="Off Camera"    value={cameraAways}      sub="Left the desk"    tone={camTone} />
      <StatTile label="Phone Spotted" value={phoneDetections}  sub="Detected on cam"  tone={phoneTone} />
      <StatTile label="Focus Rate"    value={`${focusPct}%`}   sub="In-focus session" tone={focusTone} />
    </div>
  )
}
