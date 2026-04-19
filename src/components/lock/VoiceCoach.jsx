import { useEffect, useRef, useState } from 'react'
import { createLiveCoach } from '../../lib/liveCoach.js'

// Dual visualizer: left bars show YOU, right bars show the COACH. Whichever
// side is louder is the one currently holding the floor.
function Visualizer({ analysers, coachState }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const { playback, mic } = analysers() || {}
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const paintSide = (analyser, xStart, xEnd, color, active) => {
        const bars = 22
        const gap = 3 * dpr
        const slot = (xEnd - xStart) / bars
        let buf
        if (analyser) {
          buf = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(buf)
        }
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * (buf?.length ?? 0))
          const v = buf ? buf[idx] / 255 : 0
          // Baseline pulse so idle side still breathes a bit.
          const baseline = active ? 0.08 + 0.05 * Math.sin(Date.now() / 280 + i * 0.5) : 0.04
          const amp = Math.max(baseline, v)
          const barH = Math.max(2 * dpr, amp * h * 0.85)
          const x = xStart + i * slot + gap / 2
          const y = (h - barH) / 2
          ctx.fillStyle = color
          ctx.globalAlpha = active ? 0.9 : 0.35
          ctx.fillRect(x, y, slot - gap, barH)
        }
        ctx.globalAlpha = 1
      }

      const mid = w / 2
      const userActive =
        coachState.status === 'listening' &&
        !coachState.muted &&
        !coachState.autoMuted &&
        !coachState.paused
      const coachActive = coachState.status === 'speaking' && !coachState.paused

      paintSide(mic, 0, mid - 6 * dpr, '#90e0ef', userActive)
      paintSide(playback, mid + 6 * dpr, w, '#e9c46a', coachActive)

      // Divider dot.
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(mid, h / 2, 2 * dpr, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [analysers, coachState])

  return <canvas ref={canvasRef} className="vc-viz" aria-hidden="true" />
}

function StatusLine({ state }) {
  let label = 'Tap to talk with Coral'
  let dot = 'idle'

  if (state.status === 'connecting') {
    label = 'Bringing Coral online...'
    dot = 'connecting'
  } else if (state.status === 'error') {
    label = state.error || 'Voice coach unavailable'
    dot = 'error'
  } else if (state.status === 'closed') {
    label = 'Coral offline'
    dot = 'idle'
  } else if (state.paused) {
    label = 'Paused'
    dot = 'paused'
  } else if (state.status === 'speaking') {
    label = 'Coral is speaking - mic muted automatically'
    dot = 'coach'
  } else if (state.status === 'listening') {
    label = state.muted ? 'Mic muted - tap to unmute' : 'Your turn - just talk'
    dot = state.muted ? 'muted' : 'you'
  }

  return (
    <div className="vc-status">
      <span className={'vc-status-dot ' + dot} />
      <span className="vc-status-label">{label}</span>
    </div>
  )
}

export default function VoiceCoach({ analysis, workTextRef }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({
    status: 'idle',
    muted: false,
    autoMuted: false,
    paused: false,
    error: null,
  })
  const coachRef = useRef(null)

  // Always hand the coach the freshest workText and analysis at start time.
  const handleToggle = async () => {
    if (state.status === 'speaking' || state.status === 'listening' || state.status === 'connecting') {
      coachRef.current?.stop()
      coachRef.current = null
      return
    }

    setOpen(true)
    const coach = createLiveCoach({
      analysis,
      workText: workTextRef.current ?? '',
      onStateChange: (nextState) => setState(nextState),
    })
    coachRef.current = coach
    await coach.start()
  }

  const active =
    state.status === 'listening' ||
    state.status === 'speaking' ||
    state.status === 'connecting'

  useEffect(() => () => {
    coachRef.current?.stop()
  }, [])

  const analysers = () => coachRef.current?.getAnalysers() ?? {}

  return (
    <div className={'vc-root' + (open ? ' open' : '')}>
      <button
        className={'vc-launch' + (active ? ' live' : '')}
        onClick={handleToggle}
        title={active ? 'End Coral' : 'Talk With Coral'}
      >
        <span className="vc-launch-ring" />
        <svg
          className="vc-launch-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
        <span className="vc-launch-label">
          {active ? 'END CORAL' : 'TALK WITH CORAL'}
        </span>
      </button>

      {open && (
        <div className="vc-panel" role="dialog" aria-label="Voice coach">
          <div className="vc-panel-head">
            <div className="vc-panel-title">
              <span className="vc-panel-kicker">LIVE TUTOR</span>
              <span className="vc-panel-sub">Ask. Reflect. Think out loud.</span>
            </div>
            <button
              className="vc-close"
              onClick={() => {
                coachRef.current?.stop()
                coachRef.current = null
                setOpen(false)
              }}
              aria-label="Close coach panel"
            >
              x
            </button>
          </div>

          <Visualizer analysers={analysers} coachState={state} />

          <StatusLine state={state} />

          <div className="vc-controls">
            <button
              className={'vc-btn' + (state.muted ? ' on' : '')}
              onClick={() => coachRef.current?.setMuted(!state.muted)}
              disabled={!active}
              title={state.muted ? 'Unmute mic' : 'Mute mic'}
            >
              {state.muted ? 'UNMUTE' : 'MUTE'}
            </button>
            <button
              className={'vc-btn' + (state.paused ? ' on' : '')}
              onClick={() => coachRef.current?.setPaused(!state.paused)}
              disabled={!active}
              title={state.paused ? 'Resume' : 'Pause'}
            >
              {state.paused ? 'RESUME' : 'PAUSE'}
            </button>
            <button
              className="vc-btn danger"
              onClick={() => {
                coachRef.current?.stop()
                coachRef.current = null
              }}
              disabled={!active}
            >
              END CORAL
            </button>
          </div>

          <div className="vc-footnote">
            Your coach knows the assignment and your draft - but it will never give you the answer.
          </div>
        </div>
      )}
    </div>
  )
}
