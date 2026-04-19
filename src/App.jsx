import SetupScreen from './components/setup/SetupScreen.jsx'

export default function App() {
  const handleStart = (file) => {
    // Phase 2 (lock screen) hooks in here — see context.md §2.
    // For now, log so it's obvious the pipeline works end-to-end.
    // eslint-disable-next-line no-console
    console.log('[deepdive] dive initiated with file:', file?.name, file?.size)
  }

  return <SetupScreen onStart={handleStart} />
}
