import { useState, useRef, useEffect, useMemo, Fragment } from 'react'

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

function Particles() {
  const motes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 60; i++) {
      const size = 1.5 + Math.random() * 3.2
      const dur = 14 + Math.random() * 18
      const delay = -Math.random() * dur
      const dx = Math.random() * 100 - 50
      const tone = Math.random()
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
          top: 55 + Math.random() * 55 + 'vh',
          animationDuration: dur + 's',
          animationDelay: delay + 's',
          background: bg,
          boxShadow: glow,
          '--dx': dx + 'px',
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

function Cursor({ hoverSelectors = [], dragActive, errorActive }) {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const [hovering, setHovering] = useState(false)
  const selectorsRef = useRef(hoverSelectors)
  selectorsRef.current = hoverSelectors

  useEffect(() => {
    let rx = window.innerWidth / 2
    let ry = window.innerHeight / 2
    let mx = rx
    let my = ry
    let pendingDot = false

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

const ACCEPTED_EXT = /\.(pdf|docx)$/i

function isValidFile(f) {
  if (!f) return false
  if (f.type === 'application/pdf') return true
  if (f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true
  return ACCEPTED_EXT.test(f.name)
}

function prettySize(n) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

function getExt(name) {
  const m = /\.([^.]+)$/.exec(name || '')
  return m ? m[1].toUpperCase() : 'DOC'
}

const HOVER_SELECTORS = ['.hatch', '.dive-btn', '.clear-btn']

export default function SetupScreen({ onStart }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [ripples, setRipples] = useState([])
  const inputRef = useRef(null)
  const hatchRef = useRef(null)
  const errorTimerRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

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

  useEffect(() => {
    const p = (e) => e.preventDefault()
    window.addEventListener('dragover', p)
    window.addEventListener('drop', p)
    return () => {
      window.removeEventListener('dragover', p)
      window.removeEventListener('drop', p)
    }
  }, [])

  useEffect(() => () => clearTimeout(errorTimerRef.current), [])

  const flashError = (msg) => {
    setInvalid(true)
    setErrorMsg(msg)
    clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => {
      setInvalid(false)
      setErrorMsg(null)
    }, 2400)
  }

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

  const handleCardMove = (e) => {
    const el = hatchRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ ry: px * 6, rx: -py * 6 })
  }
  const handleCardLeave = () => setTilt({ rx: 0, ry: 0 })

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

  const statusLabel = errorMsg
    ? 'Rejected'
    : file
    ? 'Sealed'
    : dragging
    ? 'Accepting…'
    : 'Ready'

  return (
    <div className="stage">
      <div
        className="backdrop"
        style={{ transform: `scale(1.06) translate(${parallax.x * -10}px, ${parallax.y * -6}px)` }}
      />
      <div className="backdrop-grade" />
      <div className="surface-glow" />

      <Particles />

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

      <div
        className={'creature-halo fade ' + (mounted ? 'go' : '')}
        style={{
          animationDelay: '0.3s',
          '--to-op': 1,
          marginRight: `${parallax.x * 18}px`,
        }}
      />

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

      <div className="noise" />

      <div className="content">
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
            <div
              className={
                'hatch-wrap enter ' + (mounted ? 'go ' : '') + (errorMsg ? 'invalid' : '')
              }
              style={{ animationDelay: '1.05s' }}
            >
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
                  if (e.target.closest('.clear-btn')) return
                  if (file) return
                  inputRef.current && inputRef.current.click()
                }}
                style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
              >
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

                  <div className="sweep" />
                </div>

                <div className="hatch-foot">
                  <span className="chip">PDF</span>
                  <span>Encryption · Local only</span>
                  <span className="chip">DOCX</span>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>

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

        <div className={'sig-mark fade ' + (mounted ? 'go' : '')} style={{ animationDelay: '1.6s', '--to-op': 1 }}>
          <span>N 47°36′ · W 122°20′</span>
          <span className="line" />
          <span>PACIFIC TRENCH · SECTOR 07</span>
        </div>
      </div>

      <Cursor
        hoverSelectors={HOVER_SELECTORS}
        dragActive={dragging}
        errorActive={!!errorMsg}
      />
    </div>
  )
}
