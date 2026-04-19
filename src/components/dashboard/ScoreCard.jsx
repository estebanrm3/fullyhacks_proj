// ScoreCard — animated SVG ring with the student's performance score.
// Ring color tracks the score: teal/green >= 80, sand >= 60, red below.
// Animates the stroke-dashoffset from empty → actual on mount.

import { useEffect, useState } from 'react'

const STATUS_LABEL = {
  complete:   'Complete',
  partial:    'Partial',
  incomplete: 'Incomplete',
}

function ringColor(score) {
  if (score >= 80) return '#15b4b2' // teal-bright
  if (score >= 60) return '#E9C46A' // sand
  return              '#ff7b7b'     // danger
}

export default function ScoreCard({ score = 0, status = 'partial' }) {
  // Animate from 0 → score so the ring "fills" in.
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(score), 80)
    return () => clearTimeout(t)
  }, [score])

  const color = ringColor(score)
  const size = 156
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, displayed)) / 100) * c

  return (
    <>
      <div className="perf-ring-wrap" style={{ color }}>
        <svg className="perf-ring-svg" viewBox={`0 0 ${size} ${size}`}>
          <circle className="perf-ring-track" cx={size / 2} cy={size / 2} r={r} />
          <circle
            className="perf-ring-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="perf-ring-number">{Math.round(score)}</div>
      </div>

      <span className="perf-status-pill" style={{ color }}>
        <span className="pill-dot" />
        {STATUS_LABEL[status] ?? STATUS_LABEL.partial}
      </span>
    </>
  )
}
