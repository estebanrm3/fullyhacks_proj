// Top-level app shell. Owns the phase machine that drives the whole experience:
//   setup      → the landing page with the file hatch
//   descending → the ~1.8s transition animation playing between screens
//   locked     → the sealed "you're underwater now" view
//
// Everything else (styles, subcomponents) hangs off of these three states.

import { useState } from 'react'
import SetupScreen from './components/setup/SetupScreen.jsx'
import LockScreen from './components/lock/LockScreen.jsx'
import './styles/lock.css'

// How long the descent animation runs. Needs to be long enough for the
// setup screen to fully sink out AND the lock screen to rise in —
// see `.stage.descending` and `.lock-stage.arriving` keyframes in lock.css.
const DESCENT_MS = 1800

export default function App() {
  const [phase, setPhase] = useState('setup')
  const [file, setFile] = useState(null)

  // Fired when the user clicks Dive In on the landing page.
  // Kicks off fullscreen + flips phases so the screens crossfade.
  const handleStart = async (f) => {
    if (phase !== 'setup') return // guard against double-clicks
    setFile(f)
    setPhase('descending')

    // Ask the browser to go fullscreen. Browsers require this to be
    // triggered from a real user click — which it is, since the click
    // handler chain hasn't broken yet.
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      }
    } catch {
      // If the user dismisses the prompt, we still descend — fullscreen
      // is a nice-to-have, not a blocker for the lock mechanic.
    }

    // After the descent animation wraps, commit fully to the locked view.
    setTimeout(() => setPhase('locked'), DESCENT_MS)
  }

  // We intentionally keep BOTH screens mounted during 'descending' so the
  // transition can cross-fade smoothly. Once 'locked' takes over we drop
  // the setup screen from the tree.
  return (
    <>
      {phase !== 'locked' && (
        <SetupScreen onStart={handleStart} descending={phase === 'descending'} />
      )}
      {phase !== 'setup' && (
        <LockScreen file={file} arriving={phase === 'descending'} />
      )}
      {/* Dark translucent sheet that sweeps down during the dive —
          gives the feeling of sinking through water. */}
      {phase === 'descending' && <div className="descent-veil go" />}
    </>
  )
}
