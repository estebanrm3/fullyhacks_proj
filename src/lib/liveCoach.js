// Voice coach powered by Gemini Live API via a short-lived server-minted
// token. The browser never receives the root Gemini API key.

import {
  ActivityHandling,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
} from '@google/genai'

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'
const OUTPUT_SAMPLE_RATE = 24000   // what Gemini sends
const INPUT_SAMPLE_RATE = 16000    // what Gemini expects
const MIC_FRAME_MS = 100
const MIC_ACTIVE_RMS = 0.02
const MIC_HANGOVER_MS = 350
const MIC_IDLE_FLUSH_MS = 900

// Turns the structured assignment analysis + current work into a system
// instruction that keeps the coach from giving away answers.
function buildSystemInstruction(analysis, workText) {
  const a = analysis || {}
  const asList = (arr) => (arr && arr.length ? arr.join('; ') : '(not specified)')

  return `You are Coral, a warm, patient study buddy speaking aloud to a student through a voice interface. Sound like a real person, not a bot. Most replies should be 1 to 3 short sentences, and you should usually ask one gentle follow-up question so the exchange keeps moving.

STRICT RULES:
- Never reveal, state, hint at, or confirm any specific answer, numeric result, or solution.
- Never grade their work or tell them whether something is right or wrong.
- If they ask "is this correct?" -- decline kindly and redirect to process: "What makes you confident in that step?"
- Do respond directly to what they just said before nudging them forward.
- Do ask open, reflective questions about their reasoning.
- Do point them toward concepts to review, definitions to re-read, or approaches to try.
- Use process-oriented encouragement when they sound stuck.
- Stay conversational -- no lectures, no long explanations, no robotic phrasing.
- If they sound frustrated or overwhelmed, calm things down and help them choose one next step.
- Refer to yourself as Coral only if the student asks who you are.

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

If the student sounds unsure, help them break the task into one next step. If they share an idea, help them test it with reasoning questions instead of evaluating it for them.`
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

// Float32 mic PCM -> base64 16-bit little-endian PCM for Gemini Live input.
function float32ToBase64Pcm(f32) {
  const buf = new ArrayBuffer(f32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function getFrameRms(f32) {
  let sum = 0
  for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i]
  return Math.sqrt(sum / (f32.length || 1))
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
    userSpeaking: false,
    error: null,
  }
  const emit = () => onStateChange?.({ ...state })

  let session = null
  let playbackGain = null
  let playbackAnalyser = null
  let micMonitorGain = null
  let playbackSources = new Set()
  let nextPlaybackTime = 0
  let micStream = null
  let micSource = null
  let micWorkletNode = null
  let micAnalyser = null
  let mediaStreamForMute = null
  let micSpeechHoldMs = 0
  let micSilentMs = 0
  let streamEnded = false

  function syncMicState() {
    if (!mediaStreamForMute) return
    const enabled = !(state.muted || state.autoMuted || state.paused)
    mediaStreamForMute.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  function setUserSpeaking(speaking) {
    if (state.userSpeaking === speaking) return
    state.userSpeaking = speaking
    emit()
  }

  function resetMicActivity() {
    micSpeechHoldMs = 0
    micSilentMs = 0
    setUserSpeaking(false)
  }

  function markStreamActive() {
    streamEnded = false
  }

  function flushAudioStream() {
    if (!session || streamEnded) return
    try {
      session.sendRealtimeInput({ audioStreamEnd: true })
      streamEnded = true
    } catch (error) {
      console.error('[liveCoach] audioStreamEnd failed:', error)
    }
  }

  function setStatus(s) {
    const wasAutoMuted = state.autoMuted
    state.status = s
    state.autoMuted = s === 'speaking'
    if (!wasAutoMuted && state.autoMuted) {
      flushAudioStream()
      resetMicActivity()
    }
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

    // Keep the mic graph "live" for analysis/worklet processing without
    // feeding the user's microphone back through the speakers.
    micMonitorGain = audioCtx.createGain()
    micMonitorGain.gain.value = 0
    micMonitorGain.connect(audioCtx.destination)

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
    micAnalyser.connect(micMonitorGain)

    micWorkletNode = new AudioWorkletNode(audioCtx, 'mic-downsampler')
    micWorkletNode.port.onmessage = (e) => {
      if (state.muted || state.autoMuted || state.paused || !session) {
        flushAudioStream()
        resetMicActivity()
        return
      }

      const rms = getFrameRms(e.data)
      if (rms >= MIC_ACTIVE_RMS) {
        micSpeechHoldMs = MIC_HANGOVER_MS
        micSilentMs = 0
      } else {
        micSpeechHoldMs = Math.max(0, micSpeechHoldMs - MIC_FRAME_MS)
        micSilentMs += MIC_FRAME_MS
      }

      const userSpeaking = rms >= MIC_ACTIVE_RMS || micSpeechHoldMs > 0
      setUserSpeaking(userSpeaking)

      if (micSilentMs >= MIC_IDLE_FLUSH_MS && !userSpeaking) {
        flushAudioStream()
        return
      }

      const data = float32ToBase64Pcm(e.data)
      try {
        session.sendRealtimeInput({
          audio: {
            data,
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          },
        })
        markStreamActive()
      } catch (error) {
        console.error('[liveCoach] sendRealtimeInput failed:', error)
      }
    }
    micSource.connect(micWorkletNode)
    micWorkletNode.connect(micMonitorGain)
  }

  function stopMic() {
    flushAudioStream()
    try { micWorkletNode?.disconnect() } catch {}
    try { micSource?.disconnect() } catch {}
    try { micStream?.getTracks().forEach(t => t.stop()) } catch {}
    micWorkletNode = null
    micSource = null
    micStream = null
    mediaStreamForMute = null
    micAnalyser = null
    resetMicActivity()
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
          enableAffectiveDialog: true,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              prefixPaddingMs: 80,
              silenceDurationMs: 350,
            },
          },
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
              resetMicActivity()
              setStatus('listening')
            }

            if (msg?.serverContent?.inputTranscription?.finished && state.status !== 'speaking') {
              setUserSpeaking(false)
              setStatus('thinking')
            } else if (msg?.serverContent?.waitingForInput && state.status !== 'speaking') {
              setStatus('listening')
            }

            const parts = msg?.serverContent?.modelTurn?.parts ?? []
            for (const p of parts) {
              if (p.inlineData?.data) playAudioChunk(p.inlineData.data)
            }

            if (msg?.serverContent?.generationComplete && state.status !== 'speaking') {
              setStatus('listening')
            }

            if (
              msg?.serverContent?.turnComplete &&
              playbackSources.size === 0 &&
              state.status !== 'speaking'
            ) {
              setStatus('listening')
            }
          },
          onerror: (e) => {
            resetMicActivity()
            state.error = e?.message || 'Live API error'
            setStatus('error')
          },
          onclose: () => {
            resetMicActivity()
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
    if (m) {
      flushAudioStream()
      resetMicActivity()
    }
    syncMicState()
    emit()
  }

  function setPaused(p) {
    state.paused = p
    if (playbackGain) playbackGain.gain.value = p ? 0 : 1
    if (p) {
      flushAudioStream()
      resetMicActivity()
    }
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
    try { micMonitorGain?.disconnect() } catch {}
    playbackGain = null
    playbackAnalyser = null
    micMonitorGain = null
    nextPlaybackTime = 0
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null }
    if (state.status !== 'error') setStatus('closed')
  }

  function getAnalysers() {
    return { playback: playbackAnalyser, mic: micAnalyser }
  }

  return { start, stop, setMuted, setPaused, getAnalysers }
}
