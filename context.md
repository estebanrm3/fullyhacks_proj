# 🌊 DEEP DIVE — Agent Context Document

> **This file is the single source of truth for all AI agents and developers working on Deep Dive.**
> Read this entire document before writing a single line of code. Every architectural decision,
> naming convention, UI rule, and API pattern is documented here. Do not guess — check here first.

---

## Table of Contents

1. [What Is Deep Dive](#1-what-is-deep-dive)
2. [Core User Journey](#2-core-user-journey)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema (Supabase)](#6-database-schema-supabase)
7. [Gemini API Usage](#7-gemini-api-usage)
8. [Lock Screen Mechanics](#8-lock-screen-mechanics)
9. [Visual Theme & Design System](#9-visual-theme--design-system)
10. [Component Architecture](#10-component-architecture)
11. [State Management](#11-state-management)
12. [Event Tracking](#12-event-tracking)
13. [Summary Dashboard](#13-summary-dashboard)
14. [Critical Rules for Agents](#14-critical-rules-for-agents)
15. [Known Constraints & Limitations](#15-known-constraints--limitations)
16. [Hackathon Scope vs. Stretch Features](#16-hackathon-scope-vs-stretch-features)

---

## 1. What Is Deep Dive

Deep Dive is a **browser-based AI study accountability app**. A student submits their homework assignment, the browser enters a fullscreen deep-sea themed lock environment, and they cannot leave until they submit completed work which is then verified by Gemini AI. A real-time AI voice buddy named **Coral** assists them throughout the session without doing the work for them. After submission, a summary dashboard shows their performance, focus quality, and a timeline of distractions.

### The One-Sentence Pitch
> *"You dive in — you don't surface until the work is done."*

### Problem It Solves
- Students compulsively switch tabs and avoid starting work
- Traditional focus timers are easy to dismiss with zero consequences
- Students get stuck on problems with no one to help them think it through
- After studying, students have no data on how focused they actually were

### Who Uses It
High school and college students who self-identify as easily distracted and want an accountability tool with an AI tutor built in.

---

## 2. Core User Journey

The app has exactly **three phases**. Never conflate them. Every component belongs to one phase.

```
┌─────────────────┐      ┌─────────────────────────┐      ┌──────────────────────┐
│   PHASE 1       │      │       PHASE 2            │      │      PHASE 3         │
│   Setup Screen  │ ───▶ │   Lock Screen /          │ ───▶ │  Summary Dashboard   │
│                 │      │   Study Mode             │      │                      │
│ - Paste assign. │      │ - Fullscreen lock        │      │ - AI performance     │
│ - Set duration  │      │ - Deep sea environment   │      │   report             │
│ - Click Dive In │      │ - Coral voice buddy      │      │ - Session metrics    │
│                 │      │ - Live timer             │      │ - Focus timeline     │
│                 │      │ - Tab switch tracking    │      │ - Encouragement      │
└─────────────────┘      └─────────────────────────┘      └──────────────────────┘
```

### Phase 1 — Setup Screen
- Text area for pasting the assignment/homework prompt
- Optional: target duration input (in minutes)
- "Dive In 🤿" button triggers:
  1. `requestFullscreen()` on the root element
  2. Supabase `sessions` row INSERT with `assignment` text and `started_at` timestamp
  3. React state transitions to Phase 2
  4. Gemini Flash called to summarize the assignment for Coral's context

### Phase 2 — Lock Screen (The Core Experience)
Three-panel layout inside a fullscreen deep-sea overlay:
- **Left panel**: Read-only assignment text (reference)
- **Center panel**: Student's answer textarea (auto-saves to `localStorage` every 30s)
- **Right panel**: Coral voice buddy — waveform animation, transcript log, pause button
- **Top bar**: Timer, distraction badge, pause AI button, Submit button

Background: animated deep-sea scene with bioluminescent particles, drifting fish SVGs, and rising bubbles.

The session is tracked continuously — all tab switches, fullscreen exits, and pauses are written to Supabase in real time.

### Phase 3 — Summary Dashboard
Triggered on submit:
1. Student's submission + original assignment sent to Gemini Flash
2. Gemini returns structured JSON report
3. Combined with Supabase session metrics
4. "Surfacing" transition animation plays
5. Dashboard renders all data

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | React 18 (Vite) | Fast dev server, easy component splitting for team parallelism |
| Styling | Tailwind CSS v3 | Utility-first, rapid deep-sea theme implementation |
| Animations | Framer Motion | Lock/unlock transitions, ocean particle motion |
| Charts | Recharts | Focus timeline and session analytics on dashboard |
| AI Voice | Gemini Live API | Real-time bidirectional voice — the study buddy |
| AI Text | Gemini Flash API | Assignment summarization + submission verification |
| Database | Supabase (Postgres) | Instant REST client, no custom server needed |
| Hosting | Vercel | Free tier, GitHub deploys, perfect for hackathon |

### What We Are NOT Using
- No custom Express/Node backend — Supabase handles all DB operations
- No Redux or Zustand — plain `useState` and `useContext` is sufficient
- No Next.js — plain Vite React, simpler for a team hackathon
- No iOS/Android native locking — this is a web app, soft-lock only

---

## 4. Project Structure

```
deep-dive/
├── public/
│   ├── manifest.json          # PWA manifest (stretch goal)
│   └── fish.svg               # Deep sea fish silhouettes
├── src/
│   ├── main.jsx
│   ├── App.jsx                # Phase state machine lives here
│   ├── components/
│   │   ├── setup/
│   │   │   └── SetupScreen.jsx
│   │   ├── lock/
│   │   │   ├── LockScreen.jsx         # Root lock overlay
│   │   │   ├── AssignmentPanel.jsx    # Left: read-only assignment
│   │   │   ├── WorkPanel.jsx          # Center: student textarea
│   │   │   ├── CoralPanel.jsx         # Right: voice buddy UI
│   │   │   ├── SessionTopBar.jsx      # Timer, distraction count, submit
│   │   │   └── OceanBackground.jsx    # Animated deep-sea canvas/CSS
│   │   └── dashboard/
│   │       ├── SummaryDashboard.jsx
│   │       ├── FocusTimeline.jsx      # Recharts horizontal bar
│   │       ├── ScoreCard.jsx
│   │       └── MetricsRow.jsx
│   ├── hooks/
│   │   ├── useSession.js       # Supabase session CRUD
│   │   ├── useLockScreen.js    # Fullscreen + visibility APIs
│   │   ├── useEventTracker.js  # Tab switch / fullscreen exit logging
│   │   └── useCoral.js         # Gemini Live voice connection
│   ├── lib/
│   │   ├── supabase.js         # Supabase client init
│   │   ├── gemini.js           # Gemini Flash API calls
│   │   └── geminiLive.js       # Gemini Live (voice) connection
│   ├── context/
│   │   └── SessionContext.jsx  # Global session state
│   └── styles/
│       └── ocean.css           # Custom CSS animations (bubbles, particles)
├── .env.local
├── context.md                  # THIS FILE
└── vite.config.js
```

---

## 5. Environment Variables

All keys go in `.env.local`. Never hardcode them. Never commit `.env.local`.

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Access in code:
```js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const geminiKey   = import.meta.env.VITE_GEMINI_API_KEY
```

> ⚠️ For production/demo, move Gemini calls behind a Vercel serverless function (`/api/gemini.js`) so the API key is never exposed in the browser bundle. For hackathon dev, `VITE_` prefix is acceptable.

---

## 6. Database Schema (Supabase)

### Table: `sessions`

```sql
create table sessions (
  id                uuid primary key default gen_random_uuid(),
  assignment        text not null,
  submission        text,
  started_at        timestamptz default now(),
  ended_at          timestamptz,
  tab_switches      int default 0,
  fullscreen_exits  int default 0,
  pauses            int default 0,
  ai_report         jsonb
);
```

### Table: `events`

```sql
create table events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  type        text check (type in ('tab_switch','fullscreen_exit','pause','resume')),
  timestamp   timestamptz default now()
);
```

### Supabase Client Init (`src/lib/supabase.js`)

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Key DB Operations

```js
// Start session
const { data } = await supabase
  .from('sessions')
  .insert({ assignment: text, started_at: new Date().toISOString() })
  .select()
  .single()

// Log distraction event
await supabase.from('events').insert({
  session_id: sessionId,
  type: 'tab_switch',
  timestamp: new Date().toISOString()
})

// Increment counter (use RPC or read-modify-write)
await supabase
  .from('sessions')
  .update({ tab_switches: currentCount + 1 })
  .eq('id', sessionId)

// Close session with submission + AI report
await supabase
  .from('sessions')
  .update({
    submission: submissionText,
    ended_at: new Date().toISOString(),
    ai_report: geminiReport
  })
  .eq('id', sessionId)
```

---

## 7. Gemini API Usage

We use **two different Gemini products** for two different jobs. Never mix them up.

### 7a. Gemini Flash — Text Tasks (`src/lib/gemini.js`)

Used for:
1. **Assignment summarization** at session start (gives Coral context)
2. **Submission verification** at session end (generates the JSON report)

```js
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// 1. Summarize assignment for Coral's context
export async function summarizeAssignment(assignmentText) {
  const prompt = `Summarize this homework assignment in 2-3 sentences so a study coach understands what the student needs to do:\n\n${assignmentText}`
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// 2. Verify submission and generate report
export async function verifySubmission(assignment, submission) {
  const prompt = `
You are an academic evaluator. Compare the assignment and the student's submission.
Return ONLY valid JSON with no markdown, no backticks, no explanation. Just the JSON object.

{
  "assignment_summary": "string - what the assignment asked for",
  "completion_status": "complete" | "partial" | "incomplete",
  "performance_score": number between 0 and 100,
  "strengths": ["string", "string"],
  "areas_to_improve": ["string", "string"],
  "encouragement": "string - one sentence of genuine encouragement"
}

Assignment:
${assignment}

Student Submission:
${submission}
`
  const result = await model.generateContent(prompt)
  const raw = result.response.text()
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}
```

> ⚠️ Always wrap `JSON.parse` in try/catch. Gemini occasionally returns malformed JSON. Fall back to a default report object if parsing fails.

### 7b. Gemini Live API — Voice Buddy (`src/lib/geminiLive.js`)

Used for real-time voice conversation with Coral during Phase 2.

The system prompt for Coral must always include:
1. The assignment summary (from the Flash summarization call)
2. The persona rules below

**Coral's System Prompt:**
```
You are Coral, a calm and encouraging AI study buddy helping a student complete their homework.
The student is locked in a focus session until they finish. Your job is to:
- Help them THINK through problems by asking guiding questions
- Explain concepts they don't understand in simple terms
- NEVER give direct answers or write their work for them
- Keep them calm if they get frustrated
- Celebrate small wins and keep energy positive
- Be concise — students are working, not chatting

The assignment they are working on:
[INSERT ASSIGNMENT SUMMARY HERE]
```

**Voice pipeline:**
```
Browser mic → MediaRecorder API → Gemini Live API (audio in)
                                        ↓
                              Gemini Live API (audio out)
                                        ↓
                              Web Audio API → speaker playback
```

**Coral panel state machine:**
```
idle → listening → thinking → speaking → idle
```
Each state has a distinct waveform animation. `idle` = slow pulse, `listening` = reactive bars, `thinking` = spinning ring, `speaking` = active waveform.

---

## 8. Lock Screen Mechanics

### The Three-Layer Soft Lock

Since this is a web app we cannot lock the OS. We implement three layers that stack together:

```
Layer 1: Fullscreen API
  document.documentElement.requestFullscreen()
  → removes browser chrome (tabs, address bar, bookmarks)

Layer 2: Fixed Overlay
  position: fixed; inset: 0; z-index: 9999;
  → intercepts all pointer events, covers 100vw × 100vh

Layer 3: beforeunload
  window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = '' })
  → fires native browser "Leave this page?" dialog on close attempt
```

### `useLockScreen.js` Hook — Core Logic

```js
export function useLockScreen({ onTabSwitch, onFullscreenExit }) {

  // Request fullscreen
  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch(console.error)
  }

  // Detect fullscreen escape
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        onFullscreenExit()
        // Re-request after 2s with warning animation
        setTimeout(() => document.documentElement.requestFullscreen(), 2000)
      }
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Detect tab switch
  useEffect(() => {
    const handler = () => {
      if (document.hidden) onTabSwitch()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // beforeunload warning
  useEffect(() => {
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return { enterFullscreen }
}
```

### Distraction Warning UI Behavior
- **Tab switch detected**: Top bar distraction badge increments with a red flash animation. A brief overlay message appears: *"You surfaced early! Diving back down... 🌊"*
- **Fullscreen exit detected**: Same message + 2-second countdown before fullscreen is re-requested
- **Neither blocks the student from their work** — they always land back on their textarea

### Auto-save
The student's textarea content is saved to `localStorage` every 30 seconds under the key `deepdive_autosave_${sessionId}`. On Phase 2 mount, check for existing autosave and restore it.

```js
// Save
localStorage.setItem(`deepdive_autosave_${sessionId}`, workText)

// Restore
const saved = localStorage.getItem(`deepdive_autosave_${sessionId}`)
if (saved) setWorkText(saved)
```

---

## 9. Visual Theme & Design System

### The Deep Sea Aesthetic
The lock screen must feel like the student has literally descended underwater. It is calm, immersive, and slightly otherworldly — not dark and oppressive. Think bioluminescent ocean trench, not haunted house.

### Color Tokens (define as CSS variables and Tailwind config)

```css
:root {
  --color-deep-navy:   #0A1628;  /* Primary background */
  --color-ocean:       #0D3B6B;  /* Panel fills, secondary bg */
  --color-teal:        #0E7C7B;  /* Accents, borders, glow */
  --color-seafoam:     #48CAE4;  /* Highlights, particle color */
  --color-sand:        #E9C46A;  /* CTA buttons, achievement gold */
  --color-surface:     #FFFFFF;  /* Text on dark */
  --color-muted:       #B0BEC5;  /* Secondary text */
}
```

Add to `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      'deep-navy': '#0A1628',
      'ocean':     '#0D3B6B',
      'teal':      '#0E7C7B',
      'seafoam':   '#48CAE4',
      'sand':      '#E9C46A',
    }
  }
}
```

### Typography
- **Display / Headings**: `'Syne'` or `'Space Mono'` — monospace/technical for the timer feels like dive gear instrumentation
- **Body / UI**: `'DM Sans'` or `'Outfit'` — clean, readable on dark backgrounds
- **Load from Google Fonts** in `index.html`

### Glass Panel Style (all three lock screen panels)
```css
.ocean-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(72, 202, 228, 0.2);
  border-radius: 16px;
  box-shadow: 0 0 30px rgba(14, 124, 123, 0.15);
}
```

### Animated Ocean Background (`OceanBackground.jsx`)
Use a `<canvas>` element or CSS keyframe animations for:
- **Bioluminescent particles**: 40-60 small dots (2-4px), seafoam/teal color, randomly placed, slow vertical drift upward, fade in/out on loop. Each has a random `animation-delay` and `animation-duration` between 6s–14s.
- **Fish silhouettes**: 3-5 SVG fish at different depths, drifting horizontally at varying speeds (20s–50s), opacity 0.15–0.3
- **Bubble trail**: thin column of rising circles on the far left or right edge, slow rise, opacity 0.1

Keep the background layer at `z-index: 0`. All UI panels sit above it.

### Animations
- **Dive In transition**: the setup screen "sinks" downward (translateY +100vh) as the lock screen rises from below
- **Surface transition**: lock screen rises and fades out upward, dashboard fades in
- **Distraction warning**: red vignette pulse around screen edges (box-shadow inset animation)
- **Submit button**: sand/gold glow pulse when hovered

### Copy & Microcopy
| Action | Text |
|---|---|
| Start button | `Dive In 🤿` |
| Submit button | `Surface 🌊` |
| AI paused | `Coral is resting...` |
| Tab switch warning | `You surfaced early! Diving back down... 🌊` |
| Session complete | `You made it to the surface! 🎉` |
| Dashboard title | `Your Deep Dive Report` |

---

## 10. Component Architecture

### `App.jsx` — Phase State Machine
```jsx
const PHASES = { SETUP: 'setup', LOCK: 'lock', DASHBOARD: 'dashboard' }

export default function App() {
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [sessionId, setSessionId] = useState(null)
  const [report, setReport] = useState(null)

  return (
    <SessionContext.Provider value={{ sessionId, setSessionId, report, setReport }}>
      {phase === PHASES.SETUP    && <SetupScreen    onStart={() => setPhase(PHASES.LOCK)} />}
      {phase === PHASES.LOCK     && <LockScreen     onSubmit={() => setPhase(PHASES.DASHBOARD)} />}
      {phase === PHASES.DASHBOARD && <SummaryDashboard />}
    </SessionContext.Provider>
  )
}
```

### `LockScreen.jsx` — Layout
```jsx
// Full-viewport fixed overlay
// Grid: [assignment panel] [work panel] [coral panel]
// Top bar spans full width above the grid
<div className="fixed inset-0 z-50 bg-deep-navy flex flex-col">
  <OceanBackground />           {/* z-0, absolute */}
  <SessionTopBar />             {/* z-10, relative */}
  <div className="flex flex-1 gap-4 p-4 relative z-10">
    <AssignmentPanel />         {/* w-1/4 */}
    <WorkPanel />               {/* w-1/2 */}
    <CoralPanel />              {/* w-1/4 */}
  </div>
</div>
```

### `SessionTopBar.jsx`
Props/state it needs: `elapsedSeconds`, `distractionCount`, `onPause`, `onSubmit`

Must display:
- ⏱ Timer formatted as `MM:SS` in monospace font
- 👀 Distraction count badge (red if > 0)
- ⏸ Pause Coral button
- 🌊 Surface (submit) button in sand/gold

### `CoralPanel.jsx`
Internal state: `coralState` (`idle | listening | thinking | speaking`)

Shows:
- Waveform animation that reacts to `coralState`
- Scrollable transcript of the conversation
- Mute/pause toggle
- Coral avatar (simple SVG fish or circle with name)

---

## 11. State Management

Use **React Context + useState only**. No external state library needed.

### `SessionContext.jsx`
```jsx
export const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionId, setSessionId]         = useState(null)
  const [assignment, setAssignment]       = useState('')
  const [submission, setSubmission]       = useState('')
  const [tabSwitches, setTabSwitches]     = useState(0)
  const [fullscreenExits, setFullscreenExits] = useState(0)
  const [pauses, setPauses]               = useState(0)
  const [startTime, setStartTime]         = useState(null)
  const [report, setReport]               = useState(null)
  const [events, setEvents]               = useState([]) // local event log

  return (
    <SessionContext.Provider value={{
      sessionId, setSessionId,
      assignment, setAssignment,
      submission, setSubmission,
      tabSwitches, setTabSwitches,
      fullscreenExits, setFullscreenExits,
      pauses, setPauses,
      startTime, setStartTime,
      report, setReport,
      events, setEvents,
    }}>
      {children}
    </SessionContext.Provider>
  )
}
```

All distraction events increment both local state (for immediate UI update) AND write to Supabase (for persistence). Do both — don't choose one.

---

## 12. Event Tracking

Every distraction event is tracked in two places simultaneously:

1. **Local state** — `SessionContext.events` array — used for the Focus Timeline chart
2. **Supabase** — `events` table — persisted even if browser closes

### Event object shape (local + DB)
```js
{
  session_id: string,
  type: 'tab_switch' | 'fullscreen_exit' | 'pause' | 'resume',
  timestamp: ISO string
}
```

### `useEventTracker.js`
```js
export function useEventTracker(sessionId) {
  const { setTabSwitches, setFullscreenExits, setEvents } = useContext(SessionContext)

  const logEvent = async (type) => {
    const event = { session_id: sessionId, type, timestamp: new Date().toISOString() }

    // Update local state immediately
    setEvents(prev => [...prev, event])
    if (type === 'tab_switch')      setTabSwitches(n => n + 1)
    if (type === 'fullscreen_exit') setFullscreenExits(n => n + 1)

    // Persist to Supabase (fire and forget)
    await supabase.from('events').insert(event)
  }

  return { logEvent }
}
```

---

## 13. Summary Dashboard

### Data Sources
The dashboard combines two data sources:
1. **Gemini Flash JSON report** — AI-generated insights
2. **Supabase session + events data** — raw behavioral metrics

### Gemini Report Shape
```ts
interface GeminiReport {
  assignment_summary: string
  completion_status: 'complete' | 'partial' | 'incomplete'
  performance_score: number        // 0–100
  strengths: string[]
  areas_to_improve: string[]
  encouragement: string
}
```

### Dashboard Cards
| Card | Data Source | Notes |
|---|---|---|
| Assignment Summary | `report.assignment_summary` | 2-3 sentence recap |
| Score Badge | `report.performance_score` | Green ≥80, Yellow ≥60, Red <60 |
| Completion Status | `report.completion_status` | Pill badge |
| Strengths | `report.strengths` | Bulleted list |
| Areas to Improve | `report.areas_to_improve` | Bulleted list |
| Encouragement | `report.encouragement` | Styled callout box |
| Total Time | `session.ended_at - session.started_at` | Formatted as Xh Xm Xs |
| Tab Switches | `session.tab_switches` | Raw number |
| Fullscreen Exits | `session.fullscreen_exits` | Raw number |
| Focus Timeline | `events` array | Recharts horizontal bar |

### Focus Timeline Chart
This is the standout visual. Build it in `FocusTimeline.jsx` using Recharts.

Logic:
- X axis = time (seconds from 0 to session duration)
- Each event in the events array creates a "distraction marker" at that timestamp
- Render as a horizontal bar: green segments = focused, red segments = distraction occurred
- Use `Recharts` `BarChart` with a custom color function or a simple `ComposedChart`

```jsx
// Simplified shape of data for Recharts
const timelineData = buildTimeline(events, sessionDuration)
// Returns: [{ start: 0, end: 120, type: 'focus' }, { start: 120, end: 125, type: 'distraction' }, ...]
```

---

## 14. Critical Rules for Agents

Read these before touching any file. These rules exist because of explicit decisions made during design.

### ❌ Never Do
- **Never use Next.js** — this is plain Vite React
- **Never use Redux or Zustand** — use React Context only
- **Never hardcode API keys** — always use `import.meta.env.VITE_*`
- **Never attempt OS-level locking** — web app, browser soft-lock only
- **Never let Coral give direct answers** — the system prompt must always say "never give direct answers"
- **Never allow the submit button to unlock without Gemini verification** — submission must go through `verifySubmission()` first; only after a successful parse of the JSON report does Phase 3 activate
- **Never use `WidthType.PERCENTAGE`** in any docx generation — always DXA
- **Never put API keys in git** — `.env.local` is gitignored

### ✅ Always Do
- **Always write distraction events to both local state AND Supabase** — don't skip either
- **Always auto-save the student's work to localStorage** every 30 seconds
- **Always restore from localStorage autosave** on LockScreen mount
- **Always wrap Gemini JSON.parse in try/catch** with a default fallback report
- **Always use the deep-sea color tokens** defined in the design system — never inline arbitrary hex colors
- **Always keep animations subtle on the background** — particles should be calming, not distracting
- **Always use `requestFullscreen` on the root `document.documentElement`** — not on a child div

### Component Ownership
If you're working on your assigned component, do not touch files outside your workstream's directory without flagging it to the team first.

| Directory | Owner |
|---|---|
| `src/components/setup/` | Person 1 |
| `src/components/lock/` | Person 1 + Person 2 |
| `src/lib/geminiLive.js` + `src/hooks/useCoral.js` | Person 2 |
| `src/components/dashboard/` + `src/lib/gemini.js` | Person 3 |
| `src/lib/supabase.js` + `src/hooks/useSession.js` | Person 3 |
| `src/context/SessionContext.jsx` | All — coordinate before editing |
| `App.jsx` | All — coordinate before editing |

---

## 15. Known Constraints & Limitations

### Web Platform Limits
- **Cannot lock the entire device** — this is a web app. The soft-lock (fullscreen + overlay + beforeunload) is the full extent of locking capability.
- **Escape key always exits fullscreen** — this is a browser security requirement and cannot be overridden. The app re-requests fullscreen after 2 seconds and logs the event.
- **Gemini Live API requires WebRTC / WebSocket** — test this early. Some browsers or network environments may block the connection.
- **Autoplay audio policy** — browsers block audio autoplay until the user has interacted with the page. Coral's first message may need to be triggered by a user click (the "Dive In" button counts as interaction).

### Hackathon Constraints
- **No auth system** — sessions are anonymous. No login, no user accounts. Session ID is stored in React state and localStorage.
- **Single session per browser tab** — no multi-session support.
- **Supabase free tier** — 500MB database, 50MB file storage. More than sufficient for demo.

---

## 16. Hackathon Scope vs. Stretch Features

### In Scope (Must Ship)
- [x] Setup screen with assignment input
- [x] Fullscreen deep-sea lock overlay
- [x] Session timer in top bar
- [x] Tab switch + fullscreen exit detection and logging
- [x] Coral voice buddy (Gemini Live) with pause/mute
- [x] Assignment + work panels
- [x] Submit → Gemini Flash verification
- [x] Summary dashboard with score, metrics, and focus timeline
- [x] Supabase sessions + events persistence

### Stretch Features (Only If Time Allows)
- [ ] **PWA manifest** — install Deep Dive as a standalone app (no browser chrome at all)
- [ ] **Ambient ocean sounds** — Web Audio API, soft underwater ambience during session
- [ ] **Session history** — view last 5 sessions with scores
- [ ] **Parent/teacher unlock code** — require external code to exit early
- [ ] **Supabase Realtime** — live event streaming for a potential observer dashboard
- [ ] **Confetti / celebration animation** on unlock when score ≥ 80

---

*Last updated: 2026 — Deep Dive Hackathon Build*
*Maintained by the Deep Dive team. All agents: read before building.*
