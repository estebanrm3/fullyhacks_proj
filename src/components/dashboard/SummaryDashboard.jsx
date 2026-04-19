// SummaryDashboard — Phase 3, the "you surfaced" view.
// Shares the visual DNA of SetupScreen + LockScreen (same font stack,
// same HUD chrome, same color tokens). The narrative shift is the
// background: light rays from above instead of the dark deep-sea photo,
// and a bioluminescent fish drifting in the corner like the jellyfish
// did on the landing page.

import { useEffect, useMemo, useState } from 'react'
import { useSessionContext } from '../../context/SessionContext'
import ScoreCard     from './ScoreCard'
import MetricsRow    from './MetricsRow'
import FocusTimeline from './FocusTimeline'
import StudyInsights from './StudyInsights'
import Cursor        from '../ui/Cursor.jsx'

// Interactive elements the cursor ring should "snap onto" — the single
// return button, any cards that might become clickable, etc.
const SURF_HOVER_SELECTORS = [
  '.return-btn',
  '.dive-again',
  '.surf-card',
  'button',
  'a',
]

// Same sparse particle field as the setup screen but drifting upward
// more gently — we've surfaced, so it reads like surface foam rather
// than deep-sea bioluminescence.
function SurfaceParticles() {
  const motes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 26; i++) {
      const size = 1.2 + Math.random() * 2.4
      const dur  = 18 + Math.random() * 16
      const delay = -Math.random() * dur
      const dx   = Math.random() * 80 - 40
      arr.push({
        key: i,
        style: {
          width:  size + 'px',
          height: size + 'px',
          left:   Math.random() * 100 + 'vw',
          top:    60 + Math.random() * 50 + 'vh',
          animationDuration: dur + 's',
          animationDelay: delay + 's',
          '--dx': dx + 'px',
        },
      })
    }
    return arr
  }, [])

  return (
    <div className="surf-particles" aria-hidden="true">
      {motes.map(m => <div key={m.key} className="surf-mote" style={m.style} />)}
    </div>
  )
}

// Today's date in HUD format: "19 APR 2026 · 10:42"
function formatStamp(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const day = String(date.getDate()).padStart(2, '0')
  const mon = months[date.getMonth()]
  const yr  = date.getFullYear()
  const hh  = String(date.getHours()).padStart(2, '0')
  const mm  = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} · ${hh}:${mm}`
}

function Wordmark() {
  return (
    <div className="wordmark">
      <div className="wordmark-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
        </svg>
      </div>
      <div className="wordmark-text">DEEP<span className="slash">/</span>DIVE</div>
    </div>
  )
}

export default function SummaryDashboard({ onDiveAgain }) {
  const {
    report,
    tabSwitches,
    startTime,
    endTime,
    events,
    assignment,
    cameraAways,
    phoneDetections,
  } = useSessionContext()

  // Flip to `go` shortly after mount so all the staggered entrance
  // animations (opacity + translate) kick off together.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  if (!report) {
    return (
      <div className="surf-loading">
        <div>
          <div className="spinner" />
          <div>Analyzing your dive…</div>
        </div>
      </div>
    )
  }

  const stamp = formatStamp(endTime ?? new Date())
  const fname = assignment || 'assignment'

  // Stagger helper — each step is 120ms apart.
  const stagger = (i) => ({ animationDelay: `${0.15 + i * 0.12}s` })

  return (
    <div className="surf-stage">
      <div className="surf-backdrop" />
      <div className="surf-grade" />
      <div className="surf-glow" />
      <SurfaceParticles />

      <div className="surf-creature-halo" />
      <img
        src="/assets/turtle.png"
        alt=""
        className="surf-creature"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />

      <div className="surf-noise" />

      <div className="surf-content">
        {/* ── Top bar — same structure as Setup/Lock ─────────────────── */}
        <div className={'surf-top surf-fade ' + (mounted ? 'go' : '')} style={stagger(0)}>
          <Wordmark />
          <div className="surf-top-meta">
            <div className="meta-item surfaced">
              <span className="seal-dot" />
              SESSION <span className="num">— COMPLETE</span>
            </div>
            <div className="meta-item">DEPTH <span className="num">0 M</span></div>
            <div className="meta-item">O₂ <span className="num">100%</span></div>
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className={'surf-hero surf-rise ' + (mounted ? 'go' : '')} style={stagger(1)}>
          <div className="kicker">ASCENT · COMPLETE</div>
          <h1>
            You <em>surfaced.</em><br />
            Here&apos;s your dive report.
          </h1>
          <div className="sub">
            <span className="accent">{fname}</span> &nbsp;·&nbsp; {stamp}
          </div>
        </div>

        {/* ── Row 1 — Performance ring + Assignment summary ──────────── */}
        <div className="surf-row-top">
          <div className={'surf-card perf-card surf-rise ' + (mounted ? 'go' : '')} style={stagger(2)}>
            <div className="surf-card-label"><span className="pip" /> Performance</div>
            <ScoreCard
              score={report.performance_score}
              status={report.completion_status}
            />
          </div>

          <div className={'surf-card assign-card surf-rise ' + (mounted ? 'go' : '')} style={stagger(3)}>
            <div className="surf-card-label"><span className="pip" /> Assignment Summary</div>
            <p>{report.assignment_summary}</p>
          </div>
        </div>

        {/* ── Row 2 — Strengths + Areas to Improve ───────────────────── */}
        <div className="surf-row-duo">
          <div className={'surf-card list-card strengths surf-rise ' + (mounted ? 'go' : '')} style={stagger(4)}>
            <div className="surf-card-label"><span className="pip" /> Strengths</div>
            <ul>
              {report.strengths.map((s, i) => (
                <li key={i}>
                  <span className="bullet">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={'surf-card list-card improve surf-rise ' + (mounted ? 'go' : '')} style={stagger(5)}>
            <div className="surf-card-label"><span className="pip" /> Areas to Improve</div>
            <ul>
              {report.areas_to_improve.map((a, i) => (
                <li key={i}>
                  <span className="bullet">→</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Row 3 — Metric tiles ───────────────────────────────────── */}
        <div className={'surf-rise ' + (mounted ? 'go' : '')} style={stagger(6)}>
          <MetricsRow
            startTime={startTime}
            endTime={endTime}
            tabSwitches={tabSwitches}
            events={events}
            cameraAways={cameraAways}
            phoneDetections={phoneDetections}
          />
        </div>

        {/* ── Row 4 — Focus timeline ─────────────────────────────────── */}
        <div className={'surf-card timeline-card surf-rise ' + (mounted ? 'go' : '')} style={stagger(7)}>
          <div className="surf-card-label"><span className="pip" /> Focus Timeline</div>
          <FocusTimeline events={events} startTime={startTime} endTime={endTime} />
        </div>

        {/* ── Row 5 — AI Study Insights ──────────────────────────────── */}
        <StudyInsights style={stagger(8)} />

        {/* ── Row 6 — From Coral (emotional highlight) ───────────────── */}
        <div className={'surf-card coral-card surf-rise ' + (mounted ? 'go' : '')} style={stagger(9)}>
          <div className="surf-card-label" style={{ justifyContent: 'center' }}>
            <span className="pip" /> From Coral
          </div>
          <div className="coral-rule" />
          <div className="coral-quote">&ldquo;{report.encouragement}&rdquo;</div>
          <div className="coral-signature">— Coral · Study buddy</div>
        </div>

        {/* ── Return CTA ─────────────────────────────────────────────── */}
        <div className={'surf-cta surf-rise ' + (mounted ? 'go' : '')} style={stagger(10)}>
          <button className="return-btn" onClick={onDiveAgain}>
            <span className="arrow back">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m11 18-6-6 6-6" />
              </svg>
            </span>
            <span>Return to Surface</span>
          </button>
        </div>

        {/* ── Footer coordinates ─────────────────────────────────────── */}
        <div className={'surf-foot surf-fade ' + (mounted ? 'go' : '')} style={stagger(11)}>
          <span>N 47°36′ · W 122°20′</span>
          <span className="line" />
          <span>PACIFIC TRENCH · SECTOR 07 · ASCENT COMPLETE</span>
        </div>
      </div>

      {/* Custom cursor — same dot + ring as Setup and Lock, unified feel. */}
      <Cursor hoverSelectors={SURF_HOVER_SELECTORS} />
    </div>
  )
}
