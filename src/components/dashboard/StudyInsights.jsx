import { useEffect, useState } from 'react'
import { generateStudyInsights } from '../../lib/gemini'
import { useSessionContext } from '../../context/SessionContext'

// Same time-away logic as MetricsRow but treats camera_away and phone_detected
// as distracted windows so the focus percentage reflects the full behavior set.
function calcFocusPct(events, startTime, endTime) {
  if (!startTime || !endTime) return 100
  const sessionMs = new Date(endTime) - new Date(startTime)
  if (sessionMs <= 0) return 100

  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let awayMs = 0
  let outAt  = null

  for (const e of sorted) {
    const t = new Date(e.timestamp).getTime()
    if (['tab_switch', 'fullscreen_exit', 'camera_away', 'phone_detected'].includes(e.type)) {
      if (outAt === null) outAt = t
    } else if (['tab_return', 'camera_return'].includes(e.type)) {
      if (outAt !== null) { awayMs += t - outAt; outAt = null }
    }
  }
  if (outAt !== null) awayMs += new Date(endTime).getTime() - outAt

  return Math.max(0, Math.round(((sessionMs - awayMs) / sessionMs) * 100))
}

export default function StudyInsights({ style }) {
  const {
    assignment, startTime, endTime, events,
    tabSwitches, fullscreenExits, cameraAways, phoneDetections,
    report, studyInsights, setStudyInsights,
  } = useSessionContext()

  const [loading, setLoading] = useState(!studyInsights)

  useEffect(() => {
    if (studyInsights || !report || !startTime || !endTime) return
    const sessionMs = new Date(endTime) - new Date(startTime)
    const focusPct  = calcFocusPct(events, startTime, endTime)

    generateStudyInsights({
      assignment,
      durationMs:       sessionMs,
      focusPct,
      tabSwitches,
      fullscreenExits,
      cameraAways,
      phoneDetections,
      performanceScore: report.performance_score,
      completionStatus: report.completion_status,
    }).then(data => {
      setStudyInsights(data)
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="surf-card insights-card surf-rise go" style={style}>
      <div className="surf-card-label"><span className="pip" /> Study Insights</div>

      {loading || !studyInsights ? (
        <div className="insights-loading">
          <div className="panel-spinner" />
          <span>Generating your personalized insights…</span>
        </div>
      ) : (
        <>
          {studyInsights.overall_assessment && (
            <p className="insights-assessment">{studyInsights.overall_assessment}</p>
          )}

          <div className="insights-grid">
            {studyInsights.insights.map((item, i) => (
              <div key={i} className="insight-item">
                <div className="insight-icon">{item.icon}</div>
                <div className="insight-content">
                  <div className="insight-category">{item.category}</div>
                  <div className="insight-title">{item.title}</div>
                  <div className="insight-body">{item.body}</div>
                </div>
              </div>
            ))}
          </div>

          {studyInsights.next_session_tip && (
            <div className="insights-tip">
              <span className="insights-tip-label">NEXT SESSION</span>
              {studyInsights.next_session_tip}
            </div>
          )}
        </>
      )}
    </div>
  )
}
