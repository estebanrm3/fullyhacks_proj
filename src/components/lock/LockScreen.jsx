// LockScreen — the sealed "you're underwater now" view shown after the
// user hits Dive In. Conceptually: the browser is locked into focus mode
// and the user only resurfaces when their assignment is done. Visually:
// a much darker abyss backdrop, an anglerfish floating on the left,
// live elapsed-time + depth readouts, and a card displaying the file.

import { useEffect, useMemo, useRef, useState } from 'react'

// Format a number of ms as HH:MM:SS for the elapsed-time readout.
function prettyTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

// The lock screen's own particle field. Unlike the setup particles these
// drift DOWNWARD (marine snow), fewer of them, more subdued — it should
// feel quieter and deeper than the landing page.
function DeepParticles() {
  const motes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 45; i++) {
      const size = 1 + Math.random() * 2.4
      const dur = 22 + Math.random() * 24          // slower than landing motes
      const delay = -Math.random() * dur
      const dx = Math.random() * 60 - 30
      arr.push({
        key: i,
        style: {
          width: size + 'px',
          height: size + 'px',
          left: Math.random() * 100 + 'vw',
          top: -5 + Math.random() * 20 + 'vh',     // spawn near the top so they drift down
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
      {motes.map((m) => (
        <div key={m.key} className="lock-mote" style={m.style} />
      ))}
    </div>
  )
}

// Props:
//   file     — the File object the user uploaded on the landing page
//   arriving — true during the 1.8s descent transition; toggles the
//              `.arriving` CSS class that plays the "dive in from above"
//              keyframes. Goes false once we've fully settled in `locked`.
export default function LockScreen({ file, arriving }) {
  const [mounted, setMounted] = useState(false)
  const [elapsed, setElapsed] = useState(0)        // ms since the lock started
  const [depth, setDepth] = useState(640)          // fake depth readout in meters
  const startRef = useRef(Date.now())              // locked-at timestamp

  // Flip `mounted` shortly after first paint so the stage fades in via
  // the `.in` class in lock.css (opacity 0 → 1 over 1.4s).
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(t)
  }, [])

  // Every second, bump the elapsed-time display.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - startRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Depth readout oscillates gently around 640m with a tiny drift upward
  // over time — sells the "hovering in the deep" feeling. Runs on rAF
  // so it's smooth without eating a timer slot.
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

  // Fallback name in case the upstream file prop is somehow missing.
  const fname = file?.name || 'assignment.pdf'

  return (
    // `.in` fades the whole stage in. `.arriving` plays the dive-from-above
    // keyframes. Both classes are driven by React state, not CSS hover.
    <div className={'lock-stage ' + (mounted ? 'in ' : '') + (arriving ? 'arriving' : '')}>
      {/* Deep-ocean backdrop photo. */}
      <div className="lock-backdrop" />
      {/* Darkening gradient over the backdrop — sinks the bottom to near-black. */}
      <div className="lock-grade" />
      {/* Radial vignette to pull focus toward the center of the screen. */}
      <div className="lock-vignette" />

      <DeepParticles />

      {/* Anglerfish photo, run through the same luminance-key filter as
          the jellyfish (defined in index.html) so its black background
          goes transparent and only the bioluminescence shines through. */}
      <img
        src="/assets/deep-fish.png"
        alt=""
        className="deep-creature"
        // If the asset is ever missing, just hide the img instead of
        // showing a broken icon — the scene still reads without it.
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      {/* Teal aura behind the fish for extra bloom. */}
      <div className="deep-creature-halo" />

      {/* Film grain — same trick as the landing page. */}
      <div className="lock-noise" />

      <div className="lock-content">
        {/* Top bar: brand mark + status/depth/elapsed readouts. */}
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
          </div>
        </div>

        {/* Middle block — editorial copy + the assignment card. */}
        <div className="lock-center">
          <div className="lock-kicker">SESSION — IN PROGRESS</div>
          <h1 className="lock-headline">
            You're <em>down here</em> now.
          </h1>
          <p className="lock-sub">
            The hatch is sealed. <span className="accent">Coral</span> is watching.
            You surface only when the work is done — not a second sooner.
          </p>

          {/* Glass card showing the filename + an indefinite sweeping
              progress bar. Progress is ornamental for now — Phase 3 will
              swap this for a real completion signal. */}
          <div className="lock-file">
            <div className="lock-file-head">
              <span className="tag">ASSIGNMENT</span>
              <span className="dot" />
              <span className="pulse">SEALED</span>
            </div>
            <div className="lock-file-name">{fname}</div>
            <div className="lock-file-bar">
              <div className="lock-file-bar-fill" />
            </div>
            <div className="lock-file-foot">
              <span>DESCENT LOCKED</span>
              <span className="mono">∞ — awaiting completion</span>
            </div>
          </div>
        </div>

        {/* Bottom row: warning line on the left, coords signature on the right. */}
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
    </div>
  )
}
