// FocusTimeline — stacked percentage bar (focused / paused / distracted)
// plus a granular Recharts bar broken into 30-second buckets so the
// student can see when during the session they drifted.

import { useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

const BUCKET_MS = 30_000

const STATUS_COLOR = {
  focused:    '#15b4b2', // teal-bright — matches --teal-bright token
  paused:     '#E9C46A', // sand
  distracted: '#ff7b7b', // danger
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

// Time-based percentages so this lines up exactly with the "Focus Rate"
// metric tile above. We sum real elapsed ms in each state by walking the
// event log in chronological order, then normalize against session length.
function calcPercentages(events, startTime, endTime) {
  const start = new Date(startTime).getTime()
  const end   = new Date(endTime ?? Date.now()).getTime()
  const total = Math.max(1, end - start)
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  let distractedMs = 0
  let pausedMs     = 0
  let outAt        = null    // tab_switch timestamp waiting for a tab_return
  let pauseAt      = null    // pause timestamp waiting for a resume

  for (const e of sorted) {
    const t = new Date(e.timestamp).getTime()
    if (e.type === 'tab_switch' || e.type === 'fullscreen_exit') {
      if (outAt === null) outAt = t
    } else if (e.type === 'tab_return') {
      if (outAt !== null) { distractedMs += t - outAt; outAt = null }
    } else if (e.type === 'pause') {
      if (pauseAt === null) pauseAt = t
    } else if (e.type === 'resume') {
      if (pauseAt !== null) { pausedMs += t - pauseAt; pauseAt = null }
    }
  }
  // Account for events still open at end-of-session.
  if (outAt   !== null) distractedMs += end - outAt
  if (pauseAt !== null) pausedMs     += end - pauseAt

  const focusedMs = Math.max(0, total - distractedMs - pausedMs)

  // Round to whole percentages but ensure they always sum to 100.
  const focused    = Math.round((focusedMs    / total) * 100)
  const paused     = Math.round((pausedMs     / total) * 100)
  let   distracted = 100 - focused - paused
  if (distracted < 0) distracted = 0
  return { focused, paused, distracted }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { time, status } = payload[0].payload
  return (
    <div
      style={{
        background: 'rgba(6,16,32,0.92)',
        border: '1px solid rgba(72,202,228,0.35)',
        borderRadius: 4,
        padding: '6px 10px',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 11,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#fff',
      }}
    >
      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{time}</span>
      {' · '}
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
    return (
      <p style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'center',
        padding: '18px 0',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
      }}>
        No session data available
      </p>
    )
  }

  const pct = calcPercentages(events, startTime, endTime)
  const tickInterval = Math.max(1, Math.floor(buckets.length / 8))

  return (
    <>
      {/* Stacked percentage bar */}
      <div className="pct-bar">
        {pct.focused > 0 && (
          <div className="pct-seg focused" style={{ width: `${pct.focused}%` }}>
            {pct.focused >= 10 ? `${pct.focused}%` : ''}
          </div>
        )}
        {pct.paused > 0 && (
          <div className="pct-seg paused" style={{ width: `${pct.paused}%` }}>
            {pct.paused >= 10 ? `${pct.paused}%` : ''}
          </div>
        )}
        {pct.distracted > 0 && (
          <div className="pct-seg distracted" style={{ width: `${pct.distracted}%` }}>
            {pct.distracted >= 10 ? `${pct.distracted}%` : ''}
          </div>
        )}
      </div>

      <div className="legend">
        {[
          { color: STATUS_COLOR.focused,    label: 'Focused',    value: pct.focused    },
          { color: STATUS_COLOR.paused,     label: 'Paused',     value: pct.paused     },
          { color: STATUS_COLOR.distracted, label: 'Distracted', value: pct.distracted },
        ].map(({ color, label, value }) => (
          <span key={label} className="entry">
            <span className="swatch" style={{ background: color }} />
            {label} <span className="pct">{value}%</span>
          </span>
        ))}
      </div>

      {/* Granular bucket chart */}
      <div className="buckets-label">30-second buckets</div>
      <ResponsiveContainer width="100%" height={76}>
        <BarChart data={buckets} barCategoryGap={1} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="time"
            tick={{ fill: 'rgba(72,202,228,0.6)', fontSize: 9, fontFamily: 'DM Sans', letterSpacing: '0.1em' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(72,202,228,0.15)' }}
            interval={tickInterval}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={i} fill={STATUS_COLOR[b.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}
