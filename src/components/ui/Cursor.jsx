// Shared custom cursor — a crisp seafoam dot that snaps to the mouse and
// a larger ring that lags behind with an 18% lerp. Used on all three
// phases (Setup / Lock / Surface) so the whole app feels like one piece.
//
// Direct DOM writes via refs (not React state) so we never drop a frame,
// and we coalesce moves through requestAnimationFrame.

import { useEffect, useRef, useState, Fragment } from 'react'

export default function Cursor({ hoverSelectors = [], dragActive, errorActive }) {
  const dotRef  = useRef(null)
  const ringRef = useRef(null)
  const [hovering, setHovering] = useState(false)

  // Latest selector list kept in a ref so re-renders from the parent
  // don't tear the effect down and re-subscribe mid-motion.
  const selectorsRef = useRef(hoverSelectors)
  selectorsRef.current = hoverSelectors

  useEffect(() => {
    let rx = window.innerWidth  / 2
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
            dotRef.current.style.transform =
              `translate3d(${mx}px, ${my}px, 0) translate(-50%,-50%)`
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
        ringRef.current.style.transform =
          `translate3d(${rx}px, ${ry}px, 0) translate(-50%,-50%)`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()

    const over = (e) => {
      const sels = selectorsRef.current
      const match = sels.some(sel => e.target.closest && e.target.closest(sel))
      setHovering(prev => (prev === match ? prev : match))
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
          (hovering     ? ' hover' : '') +
          (dragActive   ? ' drag'  : '') +
          (errorActive  ? ' err'   : '')
        }
      />
      <div ref={dotRef} className="cursor-dot" />
    </Fragment>
  )
}
