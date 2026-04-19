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

// Calculates total milliseconds the user was away using tab_switch / tab_return pairs
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

function MetricCard({ label, value, sub, valueColor = 'text-seafoam' }) {
  return (
    <div className="rounded-2xl border border-seafoam/20 bg-white/5 backdrop-blur-md p-5 text-center">
      <p className="text-seafoam text-[10px] font-semibold uppercase tracking-[0.15em] mb-2">{label}</p>
      <p className={`text-3xl font-mono font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function MetricsRow({ startTime, endTime, tabSwitches, fullscreenExits, pauses, events = [] }) {
  const sessionMs     = startTime && endTime ? new Date(endTime) - new Date(startTime) : 0
  const timeAwayMs    = calcTimeAway(events)
  const distractions  = (tabSwitches ?? 0) + (fullscreenExits ?? 0)

  const focusMs       = Math.max(0, sessionMs - timeAwayMs)
  const focusPct      = sessionMs > 0 ? Math.round((focusMs / sessionMs) * 100) : 0

  const distractColor =
    distractions === 0 ? 'text-green-400' :
    distractions  <  3 ? 'text-yellow-400' :
                         'text-red-400'

  const focusColor =
    focusPct >= 80 ? 'text-green-400' :
    focusPct >= 60 ? 'text-yellow-400' :
                     'text-red-400'

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <MetricCard
        label="Session Duration"
        value={formatDuration(sessionMs)}
      />
      <MetricCard
        label="Time Away"
        value={timeAwayMs > 0 ? formatDuration(timeAwayMs) : '0s'}
        sub={`${tabSwitches ?? 0} tab switch${(tabSwitches ?? 0) !== 1 ? 'es' : ''}`}
        valueColor={timeAwayMs > 0 ? 'text-red-400' : 'text-green-400'}
      />
      <MetricCard
        label="Tab Switches"
        value={tabSwitches ?? 0}
        sub="times left tab"
        valueColor={distractColor}
      />
      <MetricCard
        label="Fullscreen Exits"
        value={fullscreenExits ?? 0}
        sub="times pressed Escape"
        valueColor={(fullscreenExits ?? 0) === 0 ? 'text-green-400' : 'text-yellow-400'}
      />
      <MetricCard
        label="Focus Rate"
        value={`${focusPct}%`}
        sub="of session in focus"
        valueColor={focusColor}
      />
    </div>
  )
}
