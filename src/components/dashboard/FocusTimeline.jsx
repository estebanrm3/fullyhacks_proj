import { useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

const BUCKET_MS = 30_000

const STATUS_COLOR = {
  focused:    '#0E7C7B',
  paused:     '#E9C46A',
  distracted: '#EF4444',
}

function buildBuckets(events, startTime, endTime) {
  const start  = new Date(startTime).getTime()
  const end    = new Date(endTime ?? Date.now()).getTime()
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  let carryStatus = 'focused'
  const buckets   = []

  for (let t = start; t < end; t += BUCKET_MS) {
    const bucketEnd = Math.min(t + BUCKET_MS, end)
    const inBucket  = sorted.filter(e => {
      const et = new Date(e.timestamp).getTime()
      return et >= t && et < bucketEnd
    })

    let bucketStatus = carryStatus

    for (const evt of inBucket) {
      if (evt.type === 'tab_switch' || evt.type === 'fullscreen_exit') {
        bucketStatus = 'distracted'
        carryStatus  = 'focused'
      } else if (evt.type === 'tab_return') {
        if (bucketStatus === 'distracted') bucketStatus = 'focused'
        carryStatus = 'focused'
      } else if (evt.type === 'pause') {
        if (bucketStatus !== 'distracted') bucketStatus = 'paused'
        carryStatus = 'paused'
      } else if (evt.type === 'resume') {
        if (bucketStatus === 'paused') bucketStatus = 'focused'
        carryStatus = 'focused'
      }
    }

    const elapsed = t - start
    const m = Math.floor(elapsed / 60000)
    const s = Math.floor((elapsed % 60000) / 1000)

    buckets.push({ time: `${m}:${String(s).padStart(2, '0')}`, value: 1, status: bucketStatus })
  }

  return buckets
}

function calcPercentages(buckets) {
  const total = buckets.length || 1
  const counts = { focused: 0, paused: 0, distracted: 0 }
  buckets.forEach(b => counts[b.status]++)
  return {
    focused:    Math.round((counts.focused    / total) * 100),
    paused:     Math.round((counts.paused     / total) * 100),
    distracted: Math.round((counts.distracted / total) * 100),
  }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { time, status } = payload[0].payload
  return (
    <div className="bg-ocean border border-teal/40 rounded px-3 py-1.5 text-xs text-white shadow-lg">
      <span className="font-mono">{time}</span>{' — '}
      <span style={{ color: STATUS_COLOR[status] }}>{status}</span>
    </div>
  )
}

export default function FocusTimeline({ events, startTime, endTime }) {
  const buckets = useMemo(
    () => (startTime ? buildBuckets(events, startTime, endTime) : []),
    [events, startTime, endTime]
  )

  if (!buckets.length) {
    return <p className="text-white/30 text-sm text-center py-4">No session data available</p>
  }

  const pct          = calcPercentages(buckets)
  const tickInterval = Math.max(1, Math.floor(buckets.length / 8))

  return (
    <div className="space-y-4">
      {/* Stacked percentage bar */}
      <div>
        <div className="flex rounded-lg overflow-hidden h-5" style={{ gap: 2 }}>
          {pct.focused > 0 && (
            <div
              className="flex items-center justify-center text-[10px] font-bold text-white/80 transition-all"
              style={{ width: `${pct.focused}%`, background: STATUS_COLOR.focused }}
            >
              {pct.focused >= 10 ? `${pct.focused}%` : ''}
            </div>
          )}
          {pct.paused > 0 && (
            <div
              className="flex items-center justify-center text-[10px] font-bold text-deep-navy transition-all"
              style={{ width: `${pct.paused}%`, background: STATUS_COLOR.paused }}
            >
              {pct.paused >= 10 ? `${pct.paused}%` : ''}
            </div>
          )}
          {pct.distracted > 0 && (
            <div
              className="flex items-center justify-center text-[10px] font-bold text-white/80 transition-all"
              style={{ width: `${pct.distracted}%`, background: STATUS_COLOR.distracted }}
            >
              {pct.distracted >= 10 ? `${pct.distracted}%` : ''}
            </div>
          )}
        </div>

        {/* Legend with percentages */}
        <div className="flex gap-5 mt-2">
          {[
            { color: STATUS_COLOR.focused,    label: 'Focused',    pct: pct.focused    },
            { color: STATUS_COLOR.paused,     label: 'Paused',     pct: pct.paused     },
            { color: STATUS_COLOR.distracted, label: 'Distracted', pct: pct.distracted },
          ].map(({ color, label, pct: p }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-white/60">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
              {label} <span className="text-white/30">{p}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Granular 30-second bar chart */}
      <div>
        <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">30-second buckets</p>
        <ResponsiveContainer width="100%" height={72}>
          <BarChart data={buckets} barCategoryGap={1} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fill: '#48CAE4', fontSize: 9, fontFamily: 'DM Sans' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={STATUS_COLOR[b.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
