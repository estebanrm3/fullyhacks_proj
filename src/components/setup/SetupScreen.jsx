// SetupScreen — the landing page where the user drops their assignment file.
// This is Phase 1 of Deep Dive. Everything visible before the user hits
// "Dive In" lives here: the underwater backdrop, the jellyfish, the
// floating particles, the file-upload "hatch" card, and the gold dive button.

import { useState, useRef, useEffect, useMemo, Fragment } from 'react'

// Small circular compass-ish SVG that sits inside the empty hatch card.
// Kept as its own component so the JSX down in the render stays readable.
function PortalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
         strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" opacity="0.4" />
      <circle cx="12" cy="12" r="6" />
      <path d="M12 8v4l3 2" />
      <path d="M2 12h2M20 12h2M12 2v2M12 20v2" opacity="0.55" />
    </svg>
  )
}

// The 60 little glowing dots drifting up the screen. We compute random
// positions / sizes / colors ONCE with useMemo — they don't need to
// change between renders. CSS handles the actual upward drift animation.
function Particles() {
  const motes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 60; i++) {
      const size = 1.5 + Math.random() * 3.2
      const dur = 14 + Math.random() * 18          // how long one drift cycle takes
      const delay = -Math.random() * dur           // negative = already mid-flight on mount
      const dx = Math.random() * 100 - 50          // horizontal sway, passed to CSS var
      const tone = Math.random()
      // Most are seafoam blue, a few are lighter cyan, and ~10% are warm gold
      // to echo the dive button and add variety.
      const bg = tone < 0.7 ? '#48CAE4' : tone < 0.9 ? '#9BEDEF' : 'rgba(233,196,106,0.75)'
      const glow =
        tone < 0.7
          ? '0 0 8px #48CAE4, 0 0 14px rgba(72,202,228,0.4)'
          : tone < 0.9
          ? '0 0 8px #9BEDEF, 0 0 14px rgba(155,237,239,0.4)'
          : '0 0 8px rgba(233,196,106,0.8)'
      arr.push({
        key: i,
        style: {
          width: size + 'px',
          height: size + 'px',
          left: Math.random() * 100 + 'vw',
          top: 55 + Math.random() * 55 + 'vh',     // spawn in bottom half so they drift up
          animationDuration: dur + 's',
          animationDelay: delay + 's',
          background: bg,
          boxShadow: glow,
          '--dx': dx + 'px',                       // read by the @keyframes motedrift
        },
      })
    }
    return arr
  }, [])
  return (
    <div className="particles" aria-hidden="true">
      {motes.map((m) => (
        <div key={m.key} className="mote" style={m.style} />
      ))}
    </div>
  )
}

// Custom cursor: a small bright dot that snaps to the mouse + a larger
// ring that lags behind with easing. The ring also changes shape on
// hover / drag / error states. We use direct DOM writes via refs
// (instead of React state) so the cursor never drops a frame.
function Cursor({ hoverSelectors = [], dragActive, errorActive }) {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const [hovering, setHovering] = useState(false)

  // Keep the latest selector list in a ref so the useEffect below
  // can read it without having to re-subscribe every time the array
  // identity changes. (Prevents cursor jitter on parent re-renders.)
  const selectorsRef = useRef(hoverSelectors)
  selectorsRef.current = hoverSelectors

  useEffect(() => {
    // Current "settled" position for the lagging ring.
    let rx = window.innerWidth / 2
    let ry = window.innerHeight / 2
    // Raw mouse coords — where the dot snaps to.
    let mx = rx
    let my = ry
    let pendingDot = false

    // Mousemove just records the coords. We queue the actual DOM write
    // on the next animation frame so we only paint the cursor once per frame.
    const move = (e) => {
      mx = e.clientX
      my = e.clientY
      if (!pendingDot) {
        pendingDot = true
        requestAnimationFrame(() => {
          pendingDot = false
          if (dotRef.current) {
            dotRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%,-50%)`
          }
        })
      }
    }
    window.addEventListener('mousemove', move, { passive: true })

    // The ring smoothly chases the mouse with a simple lerp. Runs every frame.
    let raf
    const tick = () => {
      rx += (mx - rx) * 0.18
      ry += (my - ry) * 0.18
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%,-50%)`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()

    // When the mouse enters/leaves an "interactive" element (hatch, dive btn,
    // clear btn), flip the ring to its larger hover style.
    const over = (e) => {
      const sels = selectorsRef.current
      const match = sels.some((sel) => e.target.closest && e.target.closest(sel))
      setHovering((prev) => (prev === match ? prev : match))
    }
    document.addEventListener('mouseover', over, { passive: true })

    return () => {
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseover', over)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <Fragment>
      <div
        ref={ringRef}
        className={
          'cursor-ring' +
          (hovering ? ' hover' : '') +
          (dragActive ? ' drag' : '') +
          (errorActive ? ' err' : '')
        }
      />
      <div ref={dotRef} className="cursor-dot" />
    </Fragment>
  )
}

// Only accept PDF and .docx. We check both MIME type and filename
// extension because Windows especially is unreliable about MIME.
const ACCEPTED_EXT = /\.(pdf|docx)$/i

function isValidFile(f) {
  if (!f) return false
  if (f.type === 'application/pdf') return true
  if (f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true
  return ACCEPTED_EXT.test(f.name)
}

// Render bytes as something humans can read in the loaded-file row.
function prettySize(n) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

// Pull the file extension out of a filename for the little "PDF"/"DOCX" chip.
function getExt(name) {
  const m = /\.([^.]+)$/.exec(name || '')
  return m ? m[1].toUpperCase() : 'DOC'
}

// Stable array reference — passed to <Cursor>. If we inlined this as
// [...] in JSX it would be a new array each render, which would blow up
// the Cursor's useEffect dependency list and cause visual glitches.
const HOVER_SELECTORS = ['.hatch', '.dive-btn', '.clear-btn']

export default function SetupScreen({ onStart, descending = false }) {
  // File state + UI states for the hatch (drag hover, invalid flash, etc).
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [invalid, setInvalid] = useState(false)     // triggers the red shake animation
  const [errorMsg, setErrorMsg] = useState(null)    // the visible "wrong file type" block
  const [mounted, setMounted] = useState(false)     // flipped on after first paint to stagger the entrance animations
  const [parallax, setParallax] = useState({ x: 0, y: 0 })  // mouse-driven backdrop drift, -0.5..0.5
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })        // 3D card tilt in degrees
  const [ripples, setRipples] = useState([])                // circular splashes on the dive button
  const inputRef = useRef(null)
  const hatchRef = useRef(null)
  const errorTimerRef = useRef(null)

  // Flip `mounted` shortly after first paint so the CSS entrance
  // animations (opacity+translate) can start — creates the rise-in stagger.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Track mouse position across the whole window for the parallax effect.
  // We coalesce updates with rAF so we don't trigger a React render on
  // every single mousemove pixel (which used to glitch the cursor).
  useEffect(() => {
    let pending = false
    let nx = 0
    let ny = 0
    const handler = (e) => {
      nx = e.clientX / window.innerWidth - 0.5
      ny = e.clientY / window.innerHeight - 0.5
      if (!pending) {
        pending = true
        requestAnimationFrame(() => {
          pending = false
          setParallax({ x: nx, y: ny })
        })
      }
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  // Prevent the browser's default "open file in new tab" behavior when
  // the user drops anywhere on the page — we handle drops only on the hatch.
  useEffect(() => {
    const p = (e) => e.preventDefault()
    window.addEventListener('dragover', p)
    window.addEventListener('drop', p)
    return () => {
      window.removeEventListener('dragover', p)
      window.removeEventListener('drop', p)
    }
  }, [])

  // Clear any pending error-timer on unmount.
  useEffect(() => () => clearTimeout(errorTimerRef.current), [])

  // Briefly show the error UI (red shake + wrong-file block), then clear.
  const flashError = (msg) => {
    setInvalid(true)
    setErrorMsg(msg)
    clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => {
      setInvalid(false)
      setErrorMsg(null)
    }, 2400)
  }

  // Called by both drop and <input type=file> change. Accepts or bounces.
  const handleFiles = (files) => {
    const f = files && files[0]
    if (!f) return
    if (isValidFile(f)) {
      clearTimeout(errorTimerRef.current)
      setInvalid(false)
      setErrorMsg(null)
      setFile(f)
    } else {
      flashError('Only PDF or .docx files are accepted')
    }
  }

  // 3D tilt: when the mouse moves across the hatch card, tilt it slightly
  // toward the cursor to give a physical "hovering object" feel.
  const handleCardMove = (e) => {
    const el = hatchRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ ry: px * 6, rx: -py * 6 })
  }
  const handleCardLeave = () => setTilt({ rx: 0, ry: 0 })

  // Drag handlers for the hatch card. `onDragOver` fires continuously,
  // so we use it for both "enter" and "over" to keep the dragging flag true.
  const onDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }
  const onDragLeave = (e) => {
    e.preventDefault()
    setDragging(false)
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  // User clicked the gold Dive In button. Drop a ripple splash where they
  // clicked, then hand control back to App via onStart so it can kick off
  // the descent transition + fullscreen.
  const handleDive = (e) => {
    if (!file) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const id = Date.now()
    const size = Math.max(r.width, r.height)
    setRipples((rs) => [...rs, { id, x, y, size }])
    setTimeout(() => setRipples((rs) => rs.filter((rr) => rr.id !== id)), 700)
    onStart && onStart(file)
  }

  // Label in the top-right of the hatch. Reflects whichever state is active.
  const statusLabel = errorMsg
    ? 'Rejected'
    : file
    ? 'Sealed'
    : dragging
    ? 'Accepting…'
    : 'Ready'

  return (
    // `.stage.descending` triggers the sink-and-blur-out animation
    // that plays while App transitions us to the LockScreen.
    <div className={'stage' + (descending ? ' descending' : '')}>
      {/* The underwater photograph — slight parallax drift tied to mouse pos. */}
      <div
        className="backdrop"
        style={{ transform: `scale(1.06) translate(${parallax.x * -10}px, ${parallax.y * -6}px)` }}
      />
      {/* Color-grading layer that sinks the bottom of the backdrop darker. */}
      <div className="backdrop-grade" />
      {/* Soft warm light anchor near the top of the frame. */}
      <div className="surface-glow" />

      <Particles />

      {/* Massive faint italic "deeper" word watermark behind the content. */}
      <div
        className={'big-word fade ' + (mounted ? 'go' : '')}
        style={{
          animationDelay: '0.7s',
          '--to-op': 1,
          transform: `translate(${parallax.x * -14}px, ${parallax.y * -8}px)`,
        }}
      >
        deeper
      </div>

      {/* Soft teal aura sitting BEHIND the jellyfish so it glows against the water. */}
      <div
        className={'creature-halo fade ' + (mounted ? 'go' : '')}
        style={{
          animationDelay: '0.3s',
          '--to-op': 1,
          marginRight: `${parallax.x * 18}px`,
        }}
      />

      {/* The jellyfish hero photo. The luminance-key SVG filter defined in
          index.html (#jellyLuma) turns the black background of the PNG
          transparent so only the glowing body shows. */}
      <img
        src="/assets/jellyfish.png"
        alt=""
        className={'creature fade ' + (mounted ? 'go' : '')}
        style={{
          animationDelay: '0.4s',
          '--to-op': 1,
          transform: `translate(${parallax.x * -28}px, calc(-50% + ${parallax.y * -14}px))`,
        }}
      />

      {/* Film grain overlay for texture. */}
      <div className="noise" />

      {/* ---- Foreground UI ---- */}
      <div className="content">
        {/* Top bar: brand mark on the left + session metadata on the right. */}
        <div className={'topbar enter ' + (mounted ? 'go' : '')} style={{ animationDelay: '0.3s' }}>
          <div className="wordmark">
            <div className="wordmark-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
                <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
              </svg>
            </div>
            <div className="wordmark-text">DEEP<span className="slash">/</span>DIVE</div>
          </div>
          <div className="topbar-meta">
            <div className="meta-item">SESSION <span className="num">— PRE-DESCENT</span></div>
            <div className="meta-item">DEPTH <span className="num">0 M</span></div>
            <div className="meta-item">O₂ <span className="num">100%</span></div>
          </div>
        </div>

        {/* Two-column layout: left = editorial copy, right = upload + dive button. */}
        <div className="hero-grid">
          <div className="hero-left">
            <div className={'kicker enter ' + (mounted ? 'go' : '')} style={{ animationDelay: '0.55s' }} />
            <h1 className={'headline enter ' + (mounted ? 'go' : '')} style={{ animationDelay: '0.7s' }}>
              You dive in.<br />
              You don't return to the surface <em>until your work<br /> is done.</em>
            </h1>
            <p className={'sub enter ' + (mounted ? 'go' : '')} style={{ animationDelay: '0.9s' }}>
              Submit your assignment. The browser will seal into a focus session —
              <span className="accent"> Coral</span> will help you think, not solve.
              You return to the surface only when your work is complete.
            </p>
          </div>

          <div>
            {/* The hatch wrapper owns the pulse-ring animation ::before. */}
            <div
              className={
                'hatch-wrap enter ' + (mounted ? 'go ' : '') + (errorMsg ? 'invalid' : '')
              }
              style={{ animationDelay: '1.05s' }}
            >
              {/* The hatch itself. Three visual states in the body:
                    errorMsg → red "Wrong file type" block
                    file     → loaded-row with file name + clear btn
                    neither  → portal icon + "drop assignment here" prompt */}
              <div
                ref={hatchRef}
                className={
                  'hatch' +
                  (dragging ? ' dragging' : '') +
                  (invalid ? ' invalid' : '') +
                  (file ? ' loaded' : '')
                }
                onDragOver={onDragOver}
                onDragEnter={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onMouseMove={handleCardMove}
                onMouseLeave={handleCardLeave}
                onClick={(e) => {
                  // Don't re-trigger the file picker if they hit the clear btn
                  // or if a file is already loaded.
                  if (e.target.closest('.clear-btn')) return
                  if (file) return
                  inputRef.current && inputRef.current.click()
                }}
                style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
              >
                {/* Header strip: "Hatch / 01" on the left, status pip on the right. */}
                <div className="hatch-head">
                  <div className="ident">
                    <span className="bracket">⌐</span>
                    <span>Hatch / 01</span>
                  </div>
                  <div className={'status' + (errorMsg ? ' err' : '')}>
                    <span className="pip" />
                    <span>{statusLabel}</span>
                  </div>
                </div>

                {/* Main body — swaps content based on state. */}
                <div className="hatch-body">
                  {errorMsg && (
                    <div className="hatch-error">
                      <div className="err-icon">!</div>
                      <div className="err-title display">Wrong file type</div>
                      <div className="err-sub">{errorMsg}</div>
                    </div>
                  )}
                  {!errorMsg && !file && (
                    <Fragment>
                      <div className="portal"><PortalIcon /></div>
                      <div className="hatch-title display">
                        {dragging ? 'Release to seal' : 'Drop assignment here'}
                      </div>
                      <div className="hatch-sub">PDF or .docx — or click to browse the surface</div>
                    </Fragment>
                  )}
                  {!errorMsg && file && (
                    <div className="loaded-row">
                      <div className="left" style={{ flex: 1, minWidth: 0 }}>
                        <div className="filetype">{getExt(file.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="fname">{file.name}</div>
                          <div className="fmeta">{prettySize(file.size)} · sealed — ready to dive</div>
                        </div>
                      </div>
                      <button
                        className="clear-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          // Reset the native input value so the same file
                          // can be re-selected later if they want to.
                          if (inputRef.current) inputRef.current.value = ''
                        }}
                        aria-label="Remove file"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* The 1px bright line that sweeps across the card right after drop. */}
                  <div className="sweep" />
                </div>

                {/* Footer chips (PDF / DOCX pills + "local only" note). */}
                <div className="hatch-foot">
                  <span className="chip">PDF</span>
                  <span>Encryption · Local only</span>
                  <span className="chip">DOCX</span>
                </div>

                {/* Hidden native file input — triggered by the card click above. */}
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>

            {/* The gold Dive In button + its tiny supporting line. */}
            <div className={'launch-row enter ' + (mounted ? 'go' : '')} style={{ animationDelay: '1.2s' }}>
              <button
                type="button"
                className={'dive-btn display' + (file ? ' active' : '')}
                disabled={!file}
                onClick={handleDive}
              >
                <span>DIVE IN</span>
                <span className="arrow">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
                {/* Expanding circle splash on click — one span per active ripple. */}
                {ripples.map((r) => (
                  <span
                    key={r.id}
                    className="ripple"
                    style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                  />
                ))}
              </button>

              <div className="support-line">No account · Your file stays on device</div>
            </div>
          </div>
        </div>

        {/* Bottom-right editorial signature line ("N 47°36′ · W 122°20′"). */}
        <div className={'sig-mark fade ' + (mounted ? 'go' : '')} style={{ animationDelay: '1.6s', '--to-op': 1 }}>
          <span>N 47°36′ · W 122°20′</span>
          <span className="line" />
          <span>PACIFIC TRENCH · SECTOR 07</span>
        </div>
      </div>

      {/* Custom cursor mounted LAST so it overlays everything. */}
      <Cursor
        hoverSelectors={HOVER_SELECTORS}
        dragActive={dragging}
        errorActive={!!errorMsg}
      />
    </div>
  )
}
