import { GoogleGenAI } from '@google/genai'

const TEXT_MODEL = 'gemini-flash-latest'

const ANALYZE_PROMPT = `You are a study coach. Analyze this student assignment and provide structured guidance to help them understand what to do -- do NOT give direct answers or complete any of the work for them.

Return ONLY valid JSON with no markdown and no backticks:
{
  "title": "short descriptive title for this assignment",
  "objectives": ["what the student needs to accomplish -- 2 to 4 items"],
  "key_concepts": ["important concepts they need to understand -- 2 to 4 items"],
  "suggested_approach": ["how to approach this step by step -- 3 to 5 steps"],
  "things_to_research": ["topics they should look up or review -- 2 to 4 items"],
  "estimated_difficulty": "easy" | "medium" | "hard",
  "helpful_reminder": "one short encouraging tip for getting started"
}`

const PHONE_PROMPT = `Look carefully at this image. Is there a smartphone or mobile phone visible anywhere -- held in someone's hand, resting on a surface, or showing on a screen? Answer with ONLY "yes" or "no".`

const INSIGHTS_PROMPT_HEADER = `You are a study analytics coach. A student just finished a study session. Based on their actual behavior data, generate exactly 3 specific, actionable insights. Reference the real numbers -- don't be generic.

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
}

Session data:`

const VERIFY_PROMPT = `You are an academic evaluator. Compare the original assignment requirements with the student's submitted work.

Return ONLY valid JSON with no markdown and no backticks:
{
  "assignment_summary": "what the assignment required in 1-2 sentences",
  "completion_status": "complete" | "partial" | "incomplete",
  "performance_score": number 0-100,
  "strengths": ["what the student did well -- 2 to 3 items"],
  "areas_to_improve": ["what needs improvement -- 2 to 3 items"],
  "encouragement": "one sentence of genuine encouragement",
  "unlock_reason": "brief explanation of why this completion status was assigned"
}

Definitions:
- "complete" = all main requirements meaningfully addressed
- "partial" = some requirements addressed but significant gaps remain
- "incomplete" = requirements not meaningfully addressed

ORIGINAL ASSIGNMENT:`

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return apiKey
}

function createAi(options = {}) {
  return new GoogleGenAI({
    apiKey: getGeminiApiKey(),
    ...options,
  })
}

function normalizeParts(parts) {
  return Array.isArray(parts) ? parts : []
}

function parseModelJson(text) {
  return JSON.parse(String(text || '').replace(/```json[\s\S]*?```|```/g, '').trim())
}

async function runTextPrompt(parts) {
  const ai = createAi()
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{
      role: 'user',
      parts,
    }],
    config: {
      responseMimeType: 'application/json',
    },
  })

  return parseModelJson(response.text)
}

export async function analyzeAssignmentPayload(parts) {
  return runTextPrompt([{ text: ANALYZE_PROMPT }, ...normalizeParts(parts)])
}

export async function verifySubmissionPayload(assignmentParts, submissionParts) {
  return runTextPrompt([
    { text: VERIFY_PROMPT },
    ...normalizeParts(assignmentParts),
    { text: '\n\nSTUDENT SUBMISSION:' },
    ...normalizeParts(submissionParts),
  ])
}

// Single-image yes/no probe: returns { hasPhone: boolean }. Never throws —
// a failed call returns false so the proctor loop keeps running.
export async function detectPhonePayload(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { hasPhone: false }
  }
  try {
    const ai = createAi()
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: PHONE_PROMPT },
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
        ],
      }],
    })
    const raw = String(response.text || '').trim().toLowerCase()
    return { hasPhone: raw.startsWith('yes') }
  } catch (error) {
    console.error('[api/gemini] detectPhonePayload failed:', error)
    return { hasPhone: false }
  }
}

export async function generateInsightsPayload(metrics = {}) {
  const {
    assignment        = 'assignment',
    durationMs        = 0,
    focusPct          = 100,
    tabSwitches       = 0,
    fullscreenExits   = 0,
    cameraAways       = 0,
    phoneDetections   = 0,
    performanceScore  = 0,
    completionStatus  = 'incomplete',
  } = metrics

  const durationMin = Math.round(durationMs / 60000)

  const dataBlock = `
- Assignment: ${assignment}
- Duration: ${durationMin} minutes
- Focus Rate: ${focusPct}%
- Tab Switches: ${tabSwitches} (times left the browser tab)
- Fullscreen Exits: ${fullscreenExits}
- Times Off Camera: ${cameraAways} (left their desk/screen)
- Phone Detections: ${phoneDetections} (phone spotted on camera)
- Performance Score: ${performanceScore}/100
- Completion: ${completionStatus}`

  return runTextPrompt([{ text: INSIGHTS_PROMPT_HEADER + dataBlock }])
}

export async function createLiveTokenPayload() {
  const ai = createAi({ apiVersion: 'v1alpha' })
  const now = Date.now()
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      httpOptions: {
        apiVersion: 'v1alpha',
      },
    },
  })

  if (!token?.name) throw new Error('Live token was not returned by Gemini')
  return { token: token.name }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export async function handleGeminiHttp(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await readJsonBody(req)

    if (body.kind === 'analyze-assignment') {
      const analysis = await analyzeAssignmentPayload(body.parts)
      return sendJson(res, 200, analysis)
    }

    if (body.kind === 'verify-submission') {
      const report = await verifySubmissionPayload(body.assignmentParts, body.submissionParts)
      return sendJson(res, 200, report)
    }

    if (body.kind === 'detect-phone') {
      const result = await detectPhonePayload(body.imageBase64)
      return sendJson(res, 200, result)
    }

    if (body.kind === 'generate-insights') {
      const insights = await generateInsightsPayload(body.metrics || {})
      return sendJson(res, 200, insights)
    }

    return sendJson(res, 400, { error: 'Unsupported Gemini request kind' })
  } catch (error) {
    console.error('[api/gemini] request failed:', error)
    return sendJson(res, 500, { error: error?.message || 'Gemini request failed' })
  }
}

export async function handleLiveTokenHttp(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const payload = await createLiveTokenPayload()
    return sendJson(res, 200, payload)
  } catch (error) {
    console.error('[api/live-token] request failed:', error)
    return sendJson(res, 500, { error: error?.message || 'Live token request failed' })
  }
}
