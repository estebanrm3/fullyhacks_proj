\<div align="center">

# Deep Dive

**You dive in. You don't surface until the work is done.**

An AI-powered study accountability app that locks your browser into an underwater world until your homework is finished — with a bioluminescent jellyfish voice buddy to help you think through the hard parts.

[![Made with React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite)](https://vitejs.dev)
[![Powered by Gemini](https://img.shields.io/badge/Gemini-Live%20%2B%20Flash-4285F4?style=flat&logo=google)](https://ai.google.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![Recharts](https://img.shields.io/badge/Recharts-Timeline-22b8cf?style=flat)](https://recharts.org)

</div>

---

## What Is It

Deep Dive is a three-phase focus ritual disguised as a deep-sea expedition.

1. **Setup** — paste your assignment, set your intentions, hit *Dive In*.
2. **Lock Screen** — the browser snaps into fullscreen inside an underwater HUD. You can't leave without submitting. Tab switches, pauses, and fullscreen exits are all tracked as "distractions" in real time. A voice-powered AI buddy named **Coral** (a bioluminescent jellyfish) listens and nudges you — she helps you think, not cheat.
3. **Surface Report** — when you submit, Gemini verifies your work and you surface into a full dive report: a performance ring, focus rate, time-away tally, a bucketed focus timeline, and personalized encouragement.

---

## Highlights

- **Fullscreen lock w/ escape tracking** — tab-switches, fullscreen exits, and pauses are timestamped to Supabase so the post-session view can reconstruct exactly when attention drifted.
- **Voice-first AI buddy (Coral)** — Gemini Live powers a low-latency conversation loop. She asks Socratic questions instead of dropping answers.
- **AI verification gate** — Gemini Flash reviews the submission against the original assignment before the lock releases. No sneaking out with an empty doc.
- **Surface dashboard** — HUD-styled ocean-surface scene with a drifting bioluminescent sea turtle, an animated performance ring, five metric tiles, a time-based focus timeline, and a handwritten-style encouragement from Coral.
- **Cohesive visual language** — three separate screens (Setup / Lock / Surface) but one design DNA: Syne + DM Sans + Fraunces, corner-bracket HUD cards, teal / sand / danger token palette, god-ray ambient lighting.

---

## How It Works

```
1. Paste your assignment         →  Click "Dive In"
2. Browser locks fullscreen      →  Ocean HUD, voice AI, focus timer
3. Work in the center panel      →  Coral listens and asks questions
4. Click "Surface"               →  Gemini verifies your submission
5. Dashboard surfaces            →  Score, metrics, focus timeline, encouragement
6. "Return to Surface"           →  Back to the landing page for the next dive
```

---

## Screenshots

| Setup | Lock Screen | Surface Dashboard |
|---|---|---|
| `./docs/setup.png` | `./docs/lockscreen.png` | `./docs/dashboard.png` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 |
| Styling | Hand-rolled CSS (tokens + HUD chrome) |
| Charts | Recharts (focus timeline) |
| AI Voice | Gemini Live API (`gemini-3.1-flash-live-preview`) |
| AI Text | Gemini Flash (`gemini-flash-latest`) |
| Database | Supabase (Postgres + Row-Level Security) |
| Image Assets | nano-banana (Gemini image extension) |
| Hosting | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Gemini API key](https://ai.google.dev)
- A [Supabase](https://supabase.com) project (optional — the app degrades gracefully without one)

### Installation

```bash
git clone https://github.com/your-username/fullyhacks.git
cd fullyhacks

npm install
cp .env.example .env.local
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

`GEMINI_API_KEY` stays server-side. The browser only calls `/api/gemini` and `/api/live-token`, so the root Gemini key is not bundled into the client.

### Database Schema

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

create table events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  type        text check (type in ('tab_switch','tab_return','fullscreen_exit','pause','resume')),
  timestamp   timestamptz default now()
);
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── components/
│   ├── setup/          # Phase 1 — landing + assignment input
│   ├── lock/           # Phase 2 — fullscreen ocean HUD + Coral voice
│   └── dashboard/      # Phase 3 — surface report
│       ├── SummaryDashboard.jsx   # page shell, animations, turtle ambiance
│       ├── ScoreCard.jsx          # animated performance ring
│       ├── MetricsRow.jsx         # 4 HUD tiles (duration / away / switches / focus)
│       └── FocusTimeline.jsx      # stacked % bar + 30s Recharts buckets
├── hooks/              # useLockScreen, useSession, useEventTracker, useCoral
├── lib/                # supabase.js, gemini.js, geminiLive.js
├── context/            # SessionContext — global session state
└── styles/
    ├── ocean.css       # landing + lock screen — bubble/jellyfish ambiance
    └── dashboard.css   # surface report — HUD cards, turtle, god-rays
public/
└── assets/             # backdrop.png, jellyfish.png, surface-bg.png, turtle.png
```

Full architecture notes, API patterns, and component ownership → [`context.md`](./context.md)

---

## Recent Changes

- **Surface dashboard rebuild** — Phase 3 now matches the visual DNA of the Setup and Lock screens. Corner-bracket HUD cards, staggered entrance animations, editorial italics hero, and a `surface-bg.png` looking up at the ocean surface with god-rays.
- **Sea turtle ambient asset** — replaced the decorative fish with a bioluminescent teal sea turtle generated via nano-banana. An inverse-luminance SVG filter (`#turtleLuma` in `index.html`) dissolves the white studio backdrop at runtime so the turtle blends into the god-ray scene — same trick the jellyfish uses on the landing page, but mirrored for a light background.
- **Time-based focus math** — the stacked focus bar on the timeline now agrees with the Focus Rate tile. Both sum real elapsed milliseconds per state (focused / paused / distracted) by walking the event log chronologically, instead of counting 30-second buckets.
- **Metrics row slimmed to 4 tiles** — Session Duration, Time Away, Tab Switches, Focus Rate. Fullscreen Exits was folded in.
- **End-of-session reliability** — `endTime` is now set the moment the user hits *Surface*, independent of whether Supabase `finalizeSession` succeeds. Fixes the "—" duration and `0%` focus rate that appeared when Supabase wasn't configured.
- **Single, honest CTA** — the dashboard now ends with one ghost-seafoam pill, *Return to Surface*, that takes you back to the landing page.
- **AI verification error surfacing** — both catch blocks in `lib/gemini.js` log the underlying error so "Verification service unavailable" is diagnosable instead of mysterious.

---

## Design System (tl;dr)

| Token | Role |
|---|---|
| `Syne` | Display — headings, HUD labels, CTA copy |
| `DM Sans` | Body — stats, legend, readouts |
| `Fraunces` (italic) | Editorial moments — "you *surfaced*" |
| `--teal-bright` `#15b4b2` | "Focused" / primary accent |
| `--seafoam` `#48caE4` | HUD chrome, ghost buttons |
| `--sand` `#E9C46A` | "Paused" / gold CTA |
| `#ff7b7b` | "Distracted" / danger |
| Corner brackets | Every card has HUD brackets via `::before` / `::after` |

---

## Contributing

This started as a hackathon project. If you want to hack on it:

1. Read [`context.md`](./context.md) first — it captures architectural decisions and the visual language.
2. Keep the three phases (Setup / Lock / Surface) feeling like one app — same fonts, same tokens, same HUD chrome.
3. Never commit `.env.local`.
4. New ambient assets go through nano-banana (the Gemini CLI extension) for consistency with the existing jellyfish + turtle look.

---

## License

MIT — do whatever you want with it.

---

<div align="center">
Built at a hackathon with the ocean on the brain and too much coffee
</div>
