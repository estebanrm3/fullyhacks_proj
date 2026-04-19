import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessionContext } from '../../context/SessionContext.jsx'
import { useEventTracker } from '../../hooks/useEventTracker.js'
import { useSession } from '../../hooks/useSession.js'
import { verifySubmission } from '../../lib/gemini.js'
import { fileToGeminiParts } from '../../lib/fileUtils.js'
import Cursor from '../ui/Cursor.jsx'
import VoiceCoach from './VoiceCoach.jsx'
import '../../styles/voice-coach.css'

// Elements the custom cursor should visually "snap onto" — the ring
// expands to its hover size when the pointer enters any of these.
const LOCK_HOVER_SELECTORS = [
  'button',
  'textarea',
  '.surface-btn',
  '.skip-btn',
  '.vc-launch',
  '.vc-btn',
  '.vc-close',
  '.tooltip',
  'a',
]

function prettyTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function DeepParticles() {
  const motes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 45; i++) {
      const size = 1 + Math.random() * 2.4
      const dur  = 22 + Math.random() * 24
      const delay = -Math.random() * dur
      const dx   = Math.random() * 60 - 30
      arr.push({
        key: i,
        style: {
          width: size + 'px', height: size + 'px',
          left: Math.random() * 100 + 'vw',
          top: -5 + Math.random() * 20 + 'vh',
          animationDuration: dur + 's',
          animationDelay: delay + 's',
          '--dx': dx + 'px',
        },
      })
    }
    return arr
  }, [])
  return (
    <div className="lock-particles" aria-hidden="true">
      {motes.map(m => <div key={m.key} className="lock-mote" style={m.style} />)}
    </div>
  )
}

export default function LockScreen({ file, arriving, onSubmit }) {
  // ── display state ───────────────────────────────────────────────────────────
  const [mounted,  setMounted]  = useState(false)
  const [elapsed,  setElapsed]  = useState(0)
  const [depth,    setDepth]    = useState(640)
  const startRef = useRef(Date.now())

  // ── work state ──────────────────────────────────────────────────────────────
  const [workText,   setWorkText]   = useState('')
  const [autoSaved,  setAutoSaved]  = useState(false)
  const [verifying,  setVerifying]  = useState(false)
  const [skipping,   setSkipping]   = useState(false)
  const [blockMsg,   setBlockMsg]   = useState(null)
  const saveKey = useRef(`deepdive_work_${Date.now()}`)
  // Live ref so the voice coach can peek at the latest draft without forcing
  // a re-render of the panel every keystroke.
  const workTextRef = useRef('')
  useEffect(() => { workTextRef.current = workText }, [workText])

  // ── hooks ───────────────────────────────────────────────────────────────────
  const { analysis, tabSwitches, fullscreenExits, setReport, setEndTime } = useSessionContext()
  const { logEvent }        = useEventTracker()
  const { finalizeSession } = useSession()
  const logRef = useRef(logEvent)
  useEffect(() => { logRef.current = logEvent }, [logEvent])

  // ── mount + timers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let raf
    const tick = () => {
      const t = (Date.now() - startRef.current) / 1000
      setDepth(640 + Math.sin(t * 0.35) * 18 + t * 0.06)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── restore autosave on mount ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(saveKey.current)
    if (saved) { setWorkText(saved); setAutoSaved(true) }
  }, [])

  // ── autosave every 30s ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!workText) return
    const id = setInterval(() => {
      localStorage.setItem(saveKey.current, workText)
      setAutoSaved(true)
    }, 30000)
    return () => clearInterval(id)
  }, [workText])

  // ── distraction tracking ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.hidden) logRef.current('tab_switch')
      else                  logRef.current('tab_return')
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) logRef.current('fullscreen_exit') }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── submit ──────────────────────────────────────────────────────────────────
  const words = wordCount(workText)
  const canSubmit = words >= 20 && !verifying

  const handleSurface = async () => {
    if (!canSubmit) return
    setVerifying(true)
    setBlockMsg(null)

    // Save latest text before submitting
    localStorage.setItem(saveKey.current, workText)

    try {
      const assignmentParts = await fileToGeminiParts(file)
      const report = await verifySubmission(assignmentParts, [{ text: workText }])

      if (report.completion_status === 'complete') {
        setReport(report)
        setEndTime(new Date())
        finalizeSession(workText, report).catch(() => {})
        onSubmit()
      } else {
        const why = report.unlock_reason || ''
        setBlockMsg(
          report.completion_status === 'partial'
            ? `Almost there — ${why || 'some requirements still need more attention.'}`
            : `Not yet — ${why || "the assignment requirements haven't been fully addressed."}`
        )
        setVerifying(false)
      }
    } catch {
      setBlockMsg('Verification failed — please try again.')
      setVerifying(false)
    }
  }

  // Hard skip — runs the same critical analysis but surfaces regardless
  // of completion_status, so the dashboard reflects whatever the student
  // actually submitted (even if partial or incorrect).
  const handleSkip = async () => {
    if (verifying || skipping) return
    setSkipping(true)
    setBlockMsg(null)

    localStorage.setItem(saveKey.current, workText)

    try {
      const assignmentParts = await fileToGeminiParts(file)
      const submissionParts = workText.trim()
        ? [{ text: workText }]
        : [{ text: '(No work submitted.)' }]
      const report = await verifySubmission(assignmentParts, submissionParts)
      setReport(report)
      setEndTime(new Date())
      finalizeSession(workText, report).catch(() => {})
      onSubmit()
    } catch {
      // Even if analysis fails, proceed to the dashboard with a fallback
      // report so the skip is truly a hard skip.
      setReport({
        assignment_summary: 'Session ended early — analysis unavailable.',
        completion_status: 'incomplete',
        performance_score: 0,
        strengths: [],
        areas_to_improve: ['Submission was skipped before verification completed.'],
        encouragement: 'You chose to end the session early — review and try again when ready.',
        unlock_reason: 'Session skipped before evaluation finished.',
      })
      setEndTime(new Date())
      onSubmit()
    }
  }

  const fname = file?.name ?? 'assignment.pdf'
  const totalDistractions = tabSwitches + fullscreenExits

  return (
    <div className={'lock-stage ' + (mounted ? 'in ' : '') + (arriving ? 'arriving' : '')}>
      {/* ── backgrounds ──────────────────────────────────────────────────── */}
      <div className="lock-backdrop" />
      <div className="lock-grade" />
      <div className="lock-vignette" />
      <DeepParticles />
      <img
        src="/assets/deep-fish.png" alt=""
        className="deep-creature"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
      <div className="deep-creature-halo" />
      <div className="lock-noise" />

      <div className="lock-content">
        {/* ── top bar ──────────────────────────────────────────────────────── */}
        <div className="lock-top">
          <div className="wordmark">
            <div className="wordmark-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
                <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
              </svg>
            </div>
            <div className="wordmark-text">DEEP<span className="slash">/</span>DIVE</div>
          </div>

          <div className="lock-meta">
            <div className="lock-meta-item">
              <span className="k">STATUS</span>
              <span className="v seal">◉ UNDER SEAL</span>
            </div>
            <div className="lock-meta-item">
              <span className="k">DEPTH</span>
              <span className="v">−{depth.toFixed(1)} M</span>
            </div>
            <div className="lock-meta-item">
              <span className="k">ELAPSED</span>
              <span className="v mono">{prettyTime(elapsed)}</span>
            </div>
            <div className="lock-meta-item">
              <span className="k">DISTRACTIONS</span>
              <span className={'v' + (totalDistractions > 0 ? ' distracted' : '')}>{totalDistractions}</span>
            </div>
            <VoiceCoach analysis={analysis} workTextRef={workTextRef} />
          </div>
        </div>

        {/* ── center panels ────────────────────────────────────────────────── */}
        <div className="lock-center">
          <div className="lock-kicker">SESSION — IN PROGRESS · {fname}</div>

          <div className="lock-panels">
            {/* Left: assignment insights */}
            <div className="lock-panel lock-insights-panel">
              {analysis ? (
                <>
                  <div className="panel-header">
                    <span className="panel-tag">ASSIGNMENT BRIEF</span>
                    <span className={'difficulty-badge diff-' + (analysis.estimated_difficulty ?? 'medium').toLowerCase()}>
                      {(analysis.estimated_difficulty ?? 'medium').toUpperCase()}
                    </span>
                  </div>
                  <div className="panel-title">{analysis.title}</div>

                  {analysis.objectives?.length > 0 && (
                    <div className="insight-section">
                      <div className="insight-tag">OBJECTIVES</div>
                      <ul className="insight-list">
                        {analysis.objectives.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.key_concepts?.length > 0 && (
                    <div className="insight-section">
                      <div className="insight-tag">KEY CONCEPTS</div>
                      <ul className="insight-list">
                        {analysis.key_concepts.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.suggested_approach?.length > 0 && (
                    <div className="insight-section">
                      <div className="insight-tag">HOW TO APPROACH</div>
                      <ol className="insight-list">
                        {analysis.suggested_approach.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}
                  {analysis.things_to_research?.length > 0 && (
                    <div className="insight-section">
                      <div className="insight-tag">TOPICS TO REVIEW</div>
                      <ul className="insight-list">
                        {analysis.things_to_research.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.helpful_reminder && (
                    <div className="insight-reminder">{analysis.helpful_reminder}</div>
                  )}
                </>
              ) : (
                <div className="panel-loading">
                  <div className="panel-spinner" />
                  <div className="panel-loading-text">Analyzing your assignment…</div>
                </div>
              )}
            </div>

            {/* Right: work area */}
            <div className="lock-panel lock-work-panel">
              <div className="panel-header">
                <span className="panel-tag">YOUR WORK</span>
                <span className="work-wordcount">{words} word{words !== 1 ? 's' : ''}</span>
              </div>

              <textarea
                className="work-textarea"
                value={workText}
                onChange={e => { setWorkText(e.target.value); setBlockMsg(null) }}
                placeholder="Start writing your work here…"
                spellCheck
              />

              {blockMsg && (
                <div className="verify-blocked">
                  <span className="verify-dot">●</span>
                  <span>{blockMsg}</span>
                </div>
              )}

              <div className="work-footer">
                <span className="work-autosave">
                  {autoSaved ? '● Auto-saved' : words > 0 ? '○ Not saved yet' : ''}
                </span>
                <div className="work-actions">
                  <button
                    className={'skip-btn' + (skipping ? ' verifying' : '')}
                    disabled={verifying || skipping}
                    onClick={handleSkip}
                    title="Skip to dashboard with the work you've written so far"
                  >
                    {skipping
                      ? <><span className="surface-spinner" /> Skipping…</>
                      : 'Skip ⏭'
                    }
                  </button>
                  <button
                    className={'surface-btn' + (!canSubmit ? ' disabled' : '') + (verifying ? ' verifying' : '')}
                    disabled={!canSubmit || skipping}
                    onClick={handleSurface}
                    title={words < 20 ? 'Write at least 20 words to submit' : ''}
                  >
                    {verifying
                      ? <><span className="surface-spinner" /> Verifying…</>
                      : 'Surface 🌊'
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── bottom bar ───────────────────────────────────────────────────── */}
        <div className="lock-bottom">
          <div className="lock-warn">
            <span className="warn-dot" />
            <span>LEAVING THIS WINDOW IS NOT AN EXIT — IT IS SIMPLY DEEPER WATER.</span>
          </div>
          <div className="lock-sig">
            <span>N 47°36′ · W 122°20′</span>
            <span className="line" />
            <span>PACIFIC TRENCH · SECTOR 07 · DESCENT</span>
          </div>
        </div>
      </div>

      {/* Custom cursor — mounted last so it paints over everything. */}
      <Cursor hoverSelectors={LOCK_HOVER_SELECTORS} />
    </div>
  )
}
