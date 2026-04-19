const DEFAULT_ANALYSIS = {
  title: 'Assignment',
  objectives: ['Complete the assignment requirements'],
  key_concepts: [],
  suggested_approach: ['Read carefully', 'Break it into steps', 'Start with what you know'],
  things_to_research: [],
  estimated_difficulty: 'medium',
  helpful_reminder: "Take it one step at a time -- you've got this!",
}

const DEFAULT_REPORT = {
  assignment_summary: 'Unable to analyze the assignment at this time.',
  completion_status: 'partial',
  performance_score: 50,
  strengths: ['Work was submitted'],
  areas_to_improve: ['Please try resubmitting for a full analysis'],
  encouragement: "Technical issues happen -- your effort still counts. Great work finishing the session!",
  unlock_reason: 'Verification service unavailable',
}

const DEFAULT_INSIGHTS = {
  insights: [
    {
      category: 'Progress',
      icon: '🎯',
      title: 'Session Complete',
      body: 'You finished your study session. Review the metrics above to spot patterns in your focus habits.',
    },
  ],
  overall_assessment: 'Session data recorded successfully.',
  next_session_tip: 'Minimize distractions in your environment to improve your focus rate next time.',
}

async function callGeminiApi(payload) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `Gemini API request failed with ${response.status}`)
  }

  return response.json()
}

export async function analyzeAssignment(parts) {
  try {
    return await callGeminiApi({
      kind: 'analyze-assignment',
      parts,
    })
  } catch (err) {
    console.error('[gemini] analyzeAssignment failed:', err)
    return DEFAULT_ANALYSIS
  }
}

export async function verifySubmission(assignmentParts, submissionParts) {
  try {
    return await callGeminiApi({
      kind: 'verify-submission',
      assignmentParts,
      submissionParts,
    })
  } catch (err) {
    console.error('[gemini] verifySubmission failed:', err)
    return DEFAULT_REPORT
  }
}

// Fire-and-forget phone probe. Returns false on any failure so the proctor
// loop never throws — a transient network/API blip shouldn't break detection.
export async function detectPhoneInFrame(imageBase64) {
  try {
    const { hasPhone } = await callGeminiApi({
      kind: 'detect-phone',
      imageBase64,
    })
    return Boolean(hasPhone)
  } catch (err) {
    console.error('[gemini] detectPhoneInFrame failed:', err)
    return false
  }
}

export async function generateStudyInsights(metrics) {
  try {
    return await callGeminiApi({
      kind: 'generate-insights',
      metrics,
    })
  } catch (err) {
    console.error('[gemini] generateStudyInsights failed:', err)
    return DEFAULT_INSIGHTS
  }
}
