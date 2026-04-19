import { useState } from 'react'
import { useWebcamProctor } from '../../hooks/useWebcamProctor'

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

const STATUS_LABELS = {
  off:     'CAMERA OFF',
  loading: 'INITIALIZING',
  present: 'ON SCREEN',
  away:    'AWAY',
  phone:   'PHONE DETECTED',
  error:   'CAM OFFLINE',
}

export default function WebcamProctor() {
  const [cameraOn, setCameraOn] = useState(true)

  const {
    videoRef, status, awayMs, cameraAways, phoneDetections,
    permissionDenied, isBeeping, stopAllBeeping,
  } = useWebcamProctor({ enabled: cameraOn })

  // If the browser denied permission, offer a re-enable button instead of
  // just disappearing — the student can grant it later and flip it on.
  const off = !cameraOn || status === 'off'

  return (
    <div className="proctor-widget">
      {isBeeping && (
        <button className="proctor-stop-btn" onClick={stopAllBeeping}>
          ◼ STOP BEEPING
        </button>
      )}

      <div className={'proctor-video-wrap' + (off ? ' is-off' : '')}>
        <video ref={videoRef} className="proctor-video" muted playsInline />
        {off && (
          <div className="proctor-off-overlay">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </div>
        )}
        <div className={`proctor-dot status-${off ? 'off' : status}`} />
      </div>

      <div className="proctor-info">
        <div className={`proctor-label status-${off ? 'off' : status}`}>
          {off ? STATUS_LABELS.off : (STATUS_LABELS[status] ?? String(status).toUpperCase())}
          {!off && status === 'away' && awayMs > 1000 && ` — ${fmtMs(awayMs)}`}
          {off && permissionDenied && ' — PERMISSION DENIED'}
        </div>

        {(cameraAways > 0 || phoneDetections > 0) && (
          <div className="proctor-counts">
            {cameraAways > 0 && `${cameraAways} off-screen`}
            {cameraAways > 0 && phoneDetections > 0 && ' · '}
            {phoneDetections > 0 && `${phoneDetections} phone`}
          </div>
        )}
      </div>

      <button
        className={'proctor-toggle-btn' + (cameraOn ? ' is-on' : ' is-off')}
        onClick={() => setCameraOn(v => !v)}
        title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
      >
        {cameraOn ? '● CAMERA ON' : '○ CAMERA OFF'}
      </button>
    </div>
  )
}
