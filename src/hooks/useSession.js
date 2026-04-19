import { useContext } from 'react'
import { supabase } from '../lib/supabase'
import { SessionContext } from '../context/SessionContext'

export function useSession() {
  const ctx = useContext(SessionContext)

  // Called by Person 1 when "Dive In" is clicked
  async function createSession(assignmentText) {
    const { data, error } = await supabase
      .from('sessions')
      .insert({ assignment: assignmentText, started_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) throw error

    ctx.setSessionId(data.id)
    ctx.setAssignment(assignmentText)
    ctx.setStartTime(new Date())
    return data.id
  }

  // Called on submit: saves submission + AI report + aggregate distraction counts
  async function finalizeSession(submissionText, aiReport) {
    const endTs = new Date().toISOString()

    const { error } = await supabase
      .from('sessions')
      .update({
        submission:       submissionText,
        ended_at:         endTs,
        ai_report:        aiReport,
        tab_switches:     ctx.tabSwitches,
        fullscreen_exits: ctx.fullscreenExits,
        pauses:           ctx.pauses,
      })
      .eq('id', ctx.sessionId)
    if (error) throw error

    ctx.setSubmission(submissionText)
    ctx.setReport(aiReport)
    ctx.setEndTime(new Date(endTs))
  }

  // Fetches session row + all events for the dashboard (used after finalizeSession)
  async function fetchSessionData(sessionId) {
    const [{ data: session, error: sErr }, { data: events, error: eErr }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('events').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true }),
    ])
    if (sErr) throw sErr
    if (eErr) throw eErr
    return { session, events: events ?? [] }
  }

  return { createSession, finalizeSession, fetchSessionData }
}
