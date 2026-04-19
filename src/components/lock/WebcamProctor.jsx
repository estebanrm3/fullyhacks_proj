import { useWebcamProctor } from '../../hooks/useWebcamProctor'

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

const STATUS_LABELS = {
  loading: 'INITIALIZING',
  present: 'ON SCREEN',
  away:    'AWAY',
  phone:   'PHONE DETECTED',
  error:   'CAM OFFLINE',
}

export default function WebcamProctor() {
  const { videoRef, status, awayMs, cameraAways, phoneDetections, permissionDenied, isBeeping, stopAllBeeping } =
    useWebcamProctor({ enabled: true })

  if (permissionDenied) return null

  return (
    <div className="proctor-widget">
      {/* Stop beeping button — only visible when beeping is active */}
      {isBeeping && (
        <button className="proctor-stop-btn" onClick={stopAllBeeping}>
          ◼ STOP BEEPING
        </button>
      )}

      <div className="proctor-video-wrap">
        <video ref={videoRef} className="proctor-video" muted playsInline />
        <div className={`proctor-dot status-${status}`} />
      </div>

      <div className="proctor-info">
        <div className={`proctor-label status-${status}`}>
          {STATUS_LABELS[status] ?? status.toUpperCase()}
          {status === 'away' && awayMs > 1000 && ` — ${fmtMs(awayMs)}`}
        </div>
        {(cameraAways > 0 || phoneDetections > 0) && (
          <div className="proctor-counts">
            {cameraAways > 0 && `${cameraAways} off-screen`}
            {cameraAways > 0 && phoneDetections > 0 && ' · '}
            {phoneDetections > 0 && `${phoneDetections} phone`}
          </div>
        )}
      </div>
    </div>
  )
}
