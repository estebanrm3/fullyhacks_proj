import { useContext } from 'react'
import { supabase } from '../lib/supabase'
import { SessionContext } from '../context/SessionContext'

export function useEventTracker() {
  const { sessionId, setTabSwitches, setFullscreenExits, setPauses, setEvents } =
    useContext(SessionContext)

  // Writes every distraction/pause event to BOTH local state AND Supabase simultaneously
  const logEvent = async (type) => {
    const event = { session_id: sessionId, type, timestamp: new Date().toISOString() }

    // Update local state immediately for live UI (distraction badge, focus timeline)
    setEvents(prev => [...prev, event])
    if (type === 'tab_switch')      setTabSwitches(n => n + 1)
    if (type === 'fullscreen_exit') setFullscreenExits(n => n + 1)
    if (type === 'pause')           setPauses(n => n + 1)

    // Local-only event types — used for time-away / timeline calculations but
    // not in the Supabase `events.type` check constraint, so skip persistence.
    if (['tab_return', 'camera_away', 'camera_return', 'phone_detected'].includes(type)) return

    // Persist to Supabase — fire and forget, log errors but don't block UI
    supabase.from('events').insert(event).then(({ error }) => {
      if (error) console.error('[useEventTracker] Failed to persist event:', error)
    })
  }

  return { logEvent }
}
