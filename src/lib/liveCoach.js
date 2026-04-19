// Voice coach powered by Gemini Live API (native audio) via a short-lived
// server-minted token. The browser never receives the root Gemini API key.

import { GoogleGenAI, Modality } from '@google/genai'

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const OUTPUT_SAMPLE_RATE = 24000   // what Gemini sends
const INPUT_SAMPLE_RATE = 16000    // what Gemini expects

// Turns the structured assignment analysis + current work into a system
// instruction that keeps the coach from giving away answers.
function buildSystemInstruction(analysis, workText) {
  const a = analysis || {}
  const asList = (arr) => (arr && arr.length ? arr.join('; ') : '(not specified)')

  return `You are a warm, patient study coach speaking aloud to a student through a voice interface. Keep each reply short -- one or two sentences -- so the conversation feels natural.

STRICT RULES:
- Never reveal, state, hint at, or confirm any specific answer, numeric result, or solution.
- Never grade their work or tell them whether something is right or wrong.
- If they ask "is this correct?" -- decline kindly and redirect to process: "What makes you confident in that step?"
- Do ask open, reflective questions about their reasoning.
- Do point them toward concepts to review, definitions to re-read, or approaches to try.
- Use process-oriented encouragement when they sound stuck.
- Stay conversational -- no lectures, no long explanations.

Context for THIS session (you already know this -- do not read it back verbatim):
ASSIGNMENT TITLE: ${a.title || 'Unknown'}
DIFFICULTY: ${a.estimated_difficulty || 'medium'}
LEARNING OBJECTIVES: ${asList(a.objectives)}
KEY CONCEPTS: ${asList(a.key_concepts)}
SUGGESTED APPROACH: ${asList(a.suggested_approach)}
TOPICS TO REVIEW: ${asList(a.things_to_research)}

The student's current draft so far (may be empty or in-progress):
<<<
${workText?.trim() || '(nothing written yet)'}
>>>

Open with a brief, friendly greeting (one short sentence) and ask what part of the assignment they want to think through together.`
}

// base64 -> Float32 PCM in [-1, 1]
function base64ToFloat32(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out = new Float32Array(bytes.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768
  }
  return out
}

// Float32 mic PCM -> base64 of 16-bit little-endian PCM
function float32ToBase64Pcm(f32) {
  const buf = new ArrayBuffer(f32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// Tiny AudioWorklet processor: downsamples mic audio to 16kHz mono and
// posts ~100ms frames back to the main thread.
const MIC_WORKLET_SRC = `
class MicDownsampler extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = []
    this._bufLen = 0
    this._targetRate = 16000
    this._frameSize = Math.floor(this._targetRate * 0.1) // 100ms chunks
  }
  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const channel = input[0]
    const ratio = sampleRate / this._targetRate
    const outLen = Math.floor(channel.length / ratio)
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      out[i] = channel[Math.floor(i * ratio)]
    }
    this._buf.push(out)
    this._bufLen += out.length
    while (this._bufLen >= this._frameSize) {
      const frame = new Float32Array(this._frameSize)
      let offset = 0
      let remaining = this._frameSize
      while (remaining > 0) {
        const chunk = this._buf[0]
        const take = Math.min(remaining, chunk.length)
        frame.set(chunk.subarray(0, take), offset)
        offset += take
        remaining -= take
        if (take === chunk.length) this._buf.shift()
        else this._buf[0] = chunk.subarray(take)
      }
      this._bufLen -= this._frameSize
      this.port.postMessage(frame, [frame.buffer])
    }
    return true
  }
}
registerProcessor('mic-downsampler', MicDownsampler)
`

export function createLiveCoach({ analysis, workText, onStateChange }) {
  let ai = null

  // Single AudioContext shared for playback + mic analysis, so the browser
  // only asks for audio permissions once and timing stays in sync.
  let audioCtx = null
  const state = {
    status: 'idle',       // 'idle' | 'connecting' | 'listening' | 'speaking' | 'error' | 'closed'
    muted: false,
    autoMuted: false,
    paused: false,
    error: null,
  }
  const emit = () => onStateChange?.({ ...state })

  let session = null
  let playbackGain = null
  let playbackAnalyser = null
  let playbackSources = new Set()
  let nextPlaybackTime = 0
  let micStream = null
  let micSource = null
  let micWorkletNode = null
  let micAnalyser = null
  let mediaStreamForMute = null

  function syncMicState() {
    if (!mediaStreamForMute) return
    const enabled = !(state.muted || state.autoMuted || state.paused)
    mediaStreamForMute.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  function setStatus(s) {
    state.status = s
    state.autoMuted = s === 'speaking'
    syncMicState()
    emit()
  }

  async function ensureAudioCtx() {
    if (audioCtx) return audioCtx
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE })
    if (audioCtx.state === 'suspended') await audioCtx.resume()

    playbackGain = audioCtx.createGain()
    playbackAnalyser = audioCtx.createAnalyser()
    playbackAnalyser.fftSize = 256
    playbackGain.connect(playbackAnalyser)
    playbackGain.connect(audioCtx.destination)

    // Register the mic worklet (URL.createObjectURL trick so we don't need a separate file)
    const blob = new Blob([MIC_WORKLET_SRC], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    await audioCtx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)

    return audioCtx
  }

  function stopPlayback() {
    nextPlaybackTime = audioCtx?.currentTime ?? 0
    for (const src of playbackSources) {
      try { src.onended = null } catch {}
      try { src.stop(0) } catch {}
      try { src.disconnect() } catch {}
    }
    playbackSources.clear()
  }

  function playAudioChunk(b64) {
    if (!audioCtx || !playbackGain) return
    const pcm = base64ToFloat32(b64)
    const buffer = audioCtx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE)
    buffer.copyToChannel(pcm, 0)
    const src = audioCtx.createBufferSource()
    src.buffer = buffer
    src.connect(playbackGain)
    const now = audioCtx.currentTime
    const start = Math.max(now, nextPlaybackTime)
    playbackSources.add(src)
    src.start(start)
    nextPlaybackTime = start + buffer.duration
    if (state.status !== 'speaking') setStatus('speaking')
    src.onended = () => {
      playbackSources.delete(src)
      try { src.disconnect() } catch {}
      // When queue drains, flip back to listening
      if (
        audioCtx &&
        playbackSources.size === 0 &&
        audioCtx.currentTime >= nextPlaybackTime - 0.02 &&
        state.status === 'speaking'
      ) {
        setStatus('listening')
      }
    }
  }

  async function startMic() {
    if (micStream) return
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    mediaStreamForMute = micStream
    syncMicState()
    micSource = audioCtx.createMediaStreamSource(micStream)

    micAnalyser = audioCtx.createAnalyser()
    micAnalyser.fftSize = 256
    micSource.connect(micAnalyser)

    micWorkletNode = new AudioWorkletNode(audioCtx, 'mic-downsampler')
    micWorkletNode.port.onmessage = (e) => {
      if (state.muted || state.autoMuted || state.paused || !session) return
      const data = float32ToBase64Pcm(e.data)
      try {
        session.sendRealtimeInput({
          audio: { data, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
        })
      } catch {}
    }
    micSource.connect(micWorkletNode)
  }

  function stopMic() {
    try { micWorkletNode?.disconnect() } catch {}
    try { micSource?.disconnect() } catch {}
    try { micStream?.getTracks().forEach(t => t.stop()) } catch {}
    micWorkletNode = null
    micSource = null
    micStream = null
    mediaStreamForMute = null
    micAnalyser = null
  }

  async function start() {
    if (session) return
    state.error = null
    setStatus('connecting')

    try {
      const tokenResponse = await fetch('/api/live-token', {
        method: 'POST',
      })
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => '')
        throw new Error(errorText || `Live token request failed with ${tokenResponse.status}`)
      }

      const { token } = await tokenResponse.json()
      if (!token) throw new Error('Live token was not returned by the server')

      ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      })
      await ensureAudioCtx()

      session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: buildSystemInstruction(analysis, workText) }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
        },
        callbacks: {
          onopen: () => {},
          onmessage: (msg) => {
            // Interruption -- agent stopped mid-sentence because user spoke
            if (msg?.serverContent?.interrupted) {
              stopPlayback()
              setStatus('listening')
            }
            const parts = msg?.serverContent?.modelTurn?.parts ?? []
            for (const p of parts) {
              if (p.inlineData?.data) playAudioChunk(p.inlineData.data)
            }
            if (msg?.serverContent?.turnComplete && state.status === 'speaking') {
              // Actual status flip happens in onended; this is just a hint
            }
          },
          onerror: (e) => {
            state.error = e?.message || 'Live API error'
            setStatus('error')
          },
          onclose: () => {
            if (state.status !== 'error') setStatus('closed')
          },
        },
      })

      await startMic()
      setStatus('listening')
    } catch (e) {
      state.error = e?.message || 'Failed to start voice coach'
      setStatus('error')
      stop()
    }
  }

  function setMuted(m) {
    state.muted = m
    syncMicState()
    emit()
  }

  function setPaused(p) {
    state.paused = p
    if (playbackGain) playbackGain.gain.value = p ? 0 : 1
    syncMicState()
    emit()
  }

  function stop() {
    try { session?.close() } catch {}
    session = null
    ai = null
    stopPlayback()
    stopMic()
    try { playbackGain?.disconnect() } catch {}
    try { playbackAnalyser?.disconnect() } catch {}
    playbackGain = null
    playbackAnalyser = null
    nextPlaybackTime = 0
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null }
    if (state.status !== 'error') setStatus('closed')
  }

  function getAnalysers() {
    return { playback: playbackAnalyser, mic: micAnalyser }
  }

  return { start, stop, setMuted, setPaused, getAnalysers }
}
