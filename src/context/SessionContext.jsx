import { createContext, useContext, useState } from 'react'

export const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionId,        setSessionId]        = useState(null)
  const [assignment,       setAssignment]        = useState('')
  const [analysis,         setAnalysis]          = useState(null)  // Gemini assignment analysis
  const [submission,       setSubmission]        = useState('')
  const [tabSwitches,      setTabSwitches]       = useState(0)
  const [fullscreenExits,  setFullscreenExits]   = useState(0)
  const [pauses,           setPauses]            = useState(0)
  const [startTime,        setStartTime]         = useState(null)
  const [endTime,          setEndTime]           = useState(null)
  const [report,           setReport]            = useState(null)
  const [events,           setEvents]            = useState([])
  // Webcam proctor — counts mirrored out of the hook so the dashboard
  // can keep reading them after the lock screen unmounts.
  const [cameraAways,      setCameraAways]       = useState(0)
  const [phoneDetections,  setPhoneDetections]   = useState(0)
  // Post-session AI insights — cached so the dashboard only asks Gemini once.
  const [studyInsights,    setStudyInsights]     = useState(null)

  return (
    <SessionContext.Provider
      value={{
        sessionId,       setSessionId,
        assignment,      setAssignment,
        analysis,        setAnalysis,
        submission,      setSubmission,
        tabSwitches,     setTabSwitches,
        fullscreenExits, setFullscreenExits,
        pauses,          setPauses,
        startTime,       setStartTime,
        endTime,         setEndTime,
        report,          setReport,
        events,          setEvents,
        cameraAways,     setCameraAways,
        phoneDetections, setPhoneDetections,
        studyInsights,   setStudyInsights,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export const useSessionContext = () => useContext(SessionContext)
