// Webcam proctor — runs during the lock screen. Two detection signals:
//   1. Face presence (MediaPipe blaze_face_short_range, every 1.5s)
//   2. Phone on camera (Gemini vision via /api/gemini proxy, every 3s)
// Both produce local-only events and optional audio beeping. The `enabled`
// flag fully tears down / spins up the pipeline so the UI can toggle the
// camera on and off without leaking streams or oscillators.

import { useEffect, useRef, useState } from 'react'
import { useSessionContext } from '../context/SessionContext'
import { detectPhoneInFrame } from '../lib/gemini'

const FACE_CHECK_MS     = 1500    // face presence check
const PHONE_CHECK_MS    = 3_000   // Gemini phone scan
const PHONE_COOLDOWN_MS = 20_000  // min gap between phone_detected log events
const AWAY_BEEP_MS      = 60_000  // 1 minute away → start away beeping

function ensureAudioCtx(ref) {
  if (!ref.current || ref.current.state === 'closed') {
    try { ref.current = new (window.AudioContext || window.webkitAudioContext)() }
    catch { ref.current = null }
  }
  return ref.current
}

// Slow low beep — plays when user is off screen
function playAwayBeep(audioCtxRef) {
  try {
    const ctx = ensureAudioCtx(audioCtxRef)
    if (!ctx) return
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

// Fast high beep — plays when phone is detected
function playPhoneBeep(audioCtxRef) {
  try {
    const ctx = ensureAudioCtx(audioCtxRef)
    if (!ctx) return
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1320, ctx.currentTime)
    gain.gain.setValueAtTime(0.45, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  } catch {}
}

export function useWebcamProctor({ enabled = true }) {
  const videoRef          = useRef(null)
  const streamRef         = useRef(null)
  const detectorRef       = useRef(null)
  const audioCtxRef       = useRef(null)
  const awayBeepTimerRef  = useRef(null)
  const phoneBeepTimerRef = useRef(null)

  const loopState = useRef({
    prevFacePresent: true,
    awayStart:       null,
    awayBeeping:     false,
    phonePresent:    false,
    lastPhoneCheck:  0,
    lastPhoneEvent:  0,
  })

  const [status,           setStatus]               = useState('off')
  const [awayMs,           setAwayMs]               = useState(0)
  const [cameraAways,      setCameraAwaysLocal]     = useState(0)
  const [phoneDetections,  setPhoneDetectionsLocal] = useState(0)
  const [permissionDenied, setPermissionDenied]     = useState(false)
  const [isBeeping,        setIsBeeping]            = useState(false)

  const {
    sessionId,
    setCameraAways:     setCtxAways,
    setPhoneDetections: setCtxPhones,
    setEvents,
  } = useSessionContext()

  const sessionIdRef = useRef(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  function startAwayBeeping() {
    if (awayBeepTimerRef.current) return
    playAwayBeep(audioCtxRef)
    awayBeepTimerRef.current = setInterval(() => playAwayBeep(audioCtxRef), 1500)
    setIsBeeping(true)
  }

  function stopAwayBeeping() {
    if (!awayBeepTimerRef.current) return
    clearInterval(awayBeepTimerRef.current)
    awayBeepTimerRef.current = null
    if (!phoneBeepTimerRef.current) setIsBeeping(false)
  }

  function startPhoneBeeping() {
    if (phoneBeepTimerRef.current) return
    playPhoneBeep(audioCtxRef)
    phoneBeepTimerRef.current = setInterval(() => playPhoneBeep(audioCtxRef), 500)
    setIsBeeping(true)
  }

  function stopPhoneBeeping() {
    if (!phoneBeepTimerRef.current) return
    clearInterval(phoneBeepTimerRef.current)
    phoneBeepTimerRef.current = null
    if (!awayBeepTimerRef.current) setIsBeeping(false)
  }

  // Manual kill-switch — exposed so the UI button can mute beeping without
  // disabling the camera itself.
  function stopAllBeeping() {
    if (awayBeepTimerRef.current)  clearInterval(awayBeepTimerRef.current)
    if (phoneBeepTimerRef.current) clearInterval(phoneBeepTimerRef.current)
    awayBeepTimerRef.current  = null
    phoneBeepTimerRef.current = null
    loopState.current.awayBeeping  = false
    loopState.current.phonePresent = false
    setIsBeeping(false)
  }

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      setAwayMs(0)
      setPermissionDenied(false)
      loopState.current = {
        prevFacePresent: true,
        awayStart:       null,
        awayBeeping:     false,
        phonePresent:    false,
        lastPhoneCheck:  0,
        lastPhoneEvent:  0,
      }
      return
    }

    let interval
    let mounted = true
    setStatus('loading')

    async function setup() {
      // ── 1. Init MediaPipe face detector ───────────────────────────────
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        )
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
        })
      } catch (err) {
        console.warn('[proctor] Face detector unavailable:', err)
      }

      if (!mounted) return

      // ── 2. Request webcam access ──────────────────────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        if (mounted) { setPermissionDenied(true); setStatus('error') }
        return
      }

      if (!mounted) return
      setStatus('present')

      // ── 3. Detection loop ─────────────────────────────────────────────
      interval = setInterval(async () => {
        if (!mounted || !videoRef.current || videoRef.current.readyState < 2) return

        const now = Date.now()
        const s   = loopState.current
        let facePresent = s.prevFacePresent

        if (detectorRef.current) {
          try {
            const res = detectorRef.current.detectForVideo(videoRef.current, now)
            facePresent = res.detections.length > 0
          } catch {}
        }

        // ── Went away ────────────────────────────────────────────────
        if (!facePresent && s.prevFacePresent) {
          s.awayStart = now
          setEvents(p => [...p, { session_id: sessionIdRef.current, type: 'camera_away', timestamp: new Date().toISOString() }])
          setCtxAways(n => n + 1)
          setCameraAwaysLocal(n => n + 1)
          setStatus('away')
        }

        // ── Came back ────────────────────────────────────────────────
        if (facePresent && !s.prevFacePresent) {
          stopAwayBeeping()
          setEvents(p => [...p, { session_id: sessionIdRef.current, type: 'camera_return', timestamp: new Date().toISOString() }])
          s.awayStart   = null
          s.awayBeeping = false
          setStatus(s.phonePresent ? 'phone' : 'present')
          setAwayMs(0)
        }

        s.prevFacePresent = facePresent

        // ── Away timer + beep gate ───────────────────────────────────
        if (!facePresent && s.awayStart) {
          const away = now - s.awayStart
          setAwayMs(away)
          if (away >= AWAY_BEEP_MS && !s.awayBeeping) {
            s.awayBeeping = true
            startAwayBeeping()
          }
        }

        // ── Phone detection every 3s for fast stop response ──────────
        if (now - s.lastPhoneCheck >= PHONE_CHECK_MS) {
          s.lastPhoneCheck = now
          const canvas = document.createElement('canvas')
          canvas.width  = videoRef.current.videoWidth  || 320
          canvas.height = videoRef.current.videoHeight || 240
          canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
          const frame = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

          detectPhoneInFrame(frame).then(hasPhone => {
            if (!mounted) return
            if (hasPhone && !s.phonePresent) {
              s.phonePresent = true
              startPhoneBeeping()
              setStatus('phone')
              const ts = Date.now()
              if (ts - s.lastPhoneEvent >= PHONE_COOLDOWN_MS) {
                s.lastPhoneEvent = ts
                setEvents(p => [...p, { session_id: sessionIdRef.current, type: 'phone_detected', timestamp: new Date().toISOString() }])
                setCtxPhones(n => n + 1)
                setPhoneDetectionsLocal(n => n + 1)
              }
            } else if (!hasPhone && s.phonePresent) {
              s.phonePresent = false
              stopPhoneBeeping()
              setStatus(s.prevFacePresent ? 'present' : 'away')
            }
          })
        }
      }, FACE_CHECK_MS)
    }

    setup()

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      stopAllBeeping()
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      try { detectorRef.current?.close?.() } catch {}
      detectorRef.current = null
      try { audioCtxRef.current?.close?.() } catch {}
      audioCtxRef.current = null
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    status,
    awayMs,
    cameraAways,
    phoneDetections,
    permissionDenied,
    isBeeping,
    stopAllBeeping,
  }
}
