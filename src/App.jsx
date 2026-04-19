import { useState } from 'react'
import SetupScreen      from './components/setup/SetupScreen.jsx'
import LockScreen       from './components/lock/LockScreen.jsx'
import SummaryDashboard from './components/dashboard/SummaryDashboard.jsx'
import { useSessionContext } from './context/SessionContext.jsx'
import { useSession } from './hooks/useSession.js'
import { analyzeAssignment } from './lib/gemini.js'
import { fileToGeminiParts } from './lib/fileUtils.js'
import './styles/lock.css'

const DESCENT_MS = 1800

export default function App() {
  const [phase, setPhase]               = useState('setup')
  const [assignmentFile, setAssignmentFile] = useState(null)

  const { setAnalysis, setAssignment, setStartTime } = useSessionContext()
  const { createSession } = useSession()

  const handleStart = async (file) => {
    if (phase !== 'setup') return
    setAssignmentFile(file)
    setAssignment(file.name)
    setStartTime(new Date())
    setPhase('descending')

    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      }
    } catch {}

    // Analyze assignment in background — lock screen shows a loading spinner until ready
    fileToGeminiParts(file)
      .then(parts => analyzeAssignment(parts))
      .then(analysis => setAnalysis(analysis))
      .catch(() => setAnalysis(null))

    // Persist session to Supabase (non-blocking — app works without it)
    createSession(file.name).catch(() => {})

    setTimeout(() => setPhase('locked'), DESCENT_MS)
  }

  const handleSubmit = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setPhase('dashboard')
  }

  const handleDiveAgain = () => {
    setAssignmentFile(null)
    setAnalysis(null)
    setPhase('setup')
  }

  return (
    <>
      {phase !== 'locked' && phase !== 'dashboard' && (
        <SetupScreen onStart={handleStart} descending={phase === 'descending'} />
      )}
      {(phase === 'descending' || phase === 'locked') && (
        <LockScreen
          file={assignmentFile}
          arriving={phase === 'descending'}
          onSubmit={handleSubmit}
        />
      )}
      {phase === 'descending' && <div className="descent-veil go" />}
      {phase === 'dashboard' && (
        <SummaryDashboard onDiveAgain={handleDiveAgain} />
      )}
    </>
  )
}
