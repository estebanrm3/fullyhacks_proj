import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const DEFAULT_ANALYSIS = {
  title: 'Assignment',
  objectives: ['Complete the assignment requirements'],
  key_concepts: [],
  suggested_approach: ['Read carefully', 'Break it into steps', 'Start with what you know'],
  things_to_research: [],
  estimated_difficulty: 'medium',
  helpful_reminder: "Take it one step at a time — you've got this!",
}

const DEFAULT_REPORT = {
  assignment_summary: 'Unable to analyze the assignment at this time.',
  completion_status: 'partial',
  performance_score: 50,
  strengths: ['Work was submitted'],
  areas_to_improve: ['Please try resubmitting for a full analysis'],
  encouragement: "Technical issues happen — your effort still counts. Great work finishing the session!",
  unlock_reason: 'Verification service unavailable',
}

// Analyze the assignment and return structured insights (no answers, coach-only guidance)
export async function analyzeAssignment(parts) {
  const prompt = `You are a study coach. Analyze this student assignment and provide structured guidance to help them understand what to do — do NOT give direct answers or complete any of the work for them.

Return ONLY valid JSON with no markdown and no backticks:
{
  "title": "short descriptive title for this assignment",
  "objectives": ["what the student needs to accomplish — 2 to 4 items"],
  "key_concepts": ["important concepts they need to understand — 2 to 4 items"],
  "suggested_approach": ["how to approach this step by step — 3 to 5 steps"],
  "things_to_research": ["topics they should look up or review — 2 to 4 items"],
  "estimated_difficulty": "easy" | "medium" | "hard",
  "helpful_reminder": "one short encouraging tip for getting started"
}`

  try {
    const result = await model.generateContent([prompt, ...parts])
    const raw = result.response.text()
    return JSON.parse(raw.replace(/```json[\s\S]*?```|```/g, '').trim())
  } catch (err) {
    console.error('[gemini] analyzeAssignment failed:', err)
    return DEFAULT_ANALYSIS
  }
}


// Detect if a mobile phone is visible in a webcam frame — held in hand, on desk, or on screen
export async function detectPhoneInFrame(imageBase64) {
  try {
    const result = await model.generateContent([
      'Look carefully at this image. Is there a smartphone or mobile phone visible anywhere — held in someone\'s hand, resting on a surface, or showing on a screen? Answer with ONLY "yes" or "no".',
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    ])
    return result.response.text().trim().toLowerCase().startsWith('yes')
  } catch (err) {
    console.error('[gemini] detectPhoneInFrame failed:', err)
    return false
  }
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

// Generate personalized AI insights from session behavioral data
export async function generateStudyInsights({
  assignment,
  durationMs,
  focusPct,
  tabSwitches,
  fullscreenExits,
  cameraAways,
  phoneDetections,
  performanceScore,
  completionStatus,
}) {
  const durationMin = Math.round(durationMs / 60000)

  const prompt = `You are a study analytics coach. A student just finished a study session. Based on their actual behavior data, generate exactly 3 specific, actionable insights. Reference the real numbers — don't be generic.

Session data:
- Assignment: ${assignment}
- Duration: ${durationMin} minutes
- Focus Rate: ${focusPct}%
- Tab Switches: ${tabSwitches} (times left the browser tab)
- Fullscreen Exits: ${fullscreenExits}
- Times Off Camera: ${cameraAways} (left their desk/screen)
- Phone Detections: ${phoneDetections} (phone spotted on camera)
- Performance Score: ${performanceScore}/100
- Completion: ${completionStatus}

Return ONLY valid JSON with no markdown and no backticks:
{
  "insights": [
    {
      "category": "Focus" | "Behavior" | "Performance" | "Environment" | "Progress",
      "icon": "single emoji",
      "title": "punchy 4-6 word title",
      "body": "1-2 sentences of specific, actionable insight referencing their actual numbers"
    }
  ],
  "overall_assessment": "1 sentence summary of their study habits based on the data",
  "next_session_tip": "one specific, concrete tip for next time"
}`

  try {
    const result = await model.generateContent([prompt])
    const raw = result.response.text()
    return JSON.parse(raw.replace(/```json[\s\S]*?```|```/g, '').trim())
  } catch (err) {
    console.error('[gemini] generateStudyInsights failed:', err)
    return DEFAULT_INSIGHTS
  }
}

// Verify the student's submission against the original assignment.
// Returns a report; only completion_status === 'complete' should unlock surfacing.
export async function verifySubmission(assignmentParts, submissionParts) {
  const prompt = `You are an academic evaluator. Compare the original assignment requirements with the student's submitted work.

Return ONLY valid JSON with no markdown and no backticks:
{
  "assignment_summary": "what the assignment required in 1-2 sentences",
  "completion_status": "complete" | "partial" | "incomplete",
  "performance_score": number 0-100,
  "strengths": ["what the student did well — 2 to 3 items"],
  "areas_to_improve": ["what needs improvement — 2 to 3 items"],
  "encouragement": "one sentence of genuine encouragement",
  "unlock_reason": "brief explanation of why this completion status was assigned"
}

Definitions:
- "complete" = all main requirements meaningfully addressed
- "partial" = some requirements addressed but significant gaps remain
- "incomplete" = requirements not meaningfully addressed

ORIGINAL ASSIGNMENT:`

  try {
    const result = await model.generateContent([
      prompt,
      ...assignmentParts,
      '\n\nSTUDENT SUBMISSION:',
      ...submissionParts,
    ])
    const raw = result.response.text()
    return JSON.parse(raw.replace(/```json[\s\S]*?```|```/g, '').trim())
  } catch (err) {
    console.error('[gemini] verifySubmission failed:', err)
    return DEFAULT_REPORT
  }
}
