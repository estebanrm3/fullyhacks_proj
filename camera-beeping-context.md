# Camera & Beeping System — Context

## Overview
The webcam proctoring system runs during the lock screen (study session) and tracks two distraction signals: the user leaving the desk and a phone appearing on camera. Both trigger audio alerts.

---

## Files Involved

| File | Role |
|---|---|
| `src/hooks/useWebcamProctor.js` | Core hook — all detection + audio logic |
| `src/components/lock/WebcamProctor.jsx` | UI widget rendered in bottom-right of lock screen |
| `src/styles/proctor.css` | Styles for the widget and stop button |
| `src/lib/gemini.js` → `detectPhoneInFrame()` | Gemini vision call for phone detection |
| `src/context/SessionContext.jsx` | Stores `cameraAways` and `phoneDetections` counts |
| `src/components/dashboard/MetricsRow.jsx` | Displays Off Camera + Phone Spotted tiles |
| `src/components/dashboard/FocusTimeline.jsx` | Renders `camera_away` and `phone_detected` as distracted buckets |
| `src/components/dashboard/StudyInsights.jsx` | Passes camera/phone data to Gemini for AI insights |

---

## Detection Logic

### Face Detection (MediaPipe)
- **Library**: `@mediapipe/tasks-vision` — loaded via CDN, no local model files
- **Model**: `blaze_face_short_range` (lightweight, GPU-accelerated)
- **Interval**: every **1.5 seconds**
- **Away event**: fires once when face disappears (`camera_away`)
- **Return event**: fires once when face reappears (`camera_return`)

### Phone Detection (Gemini Vision)
- **Interval**: every **3 seconds** (runs regardless of face presence)
- **Prompt**: asks Gemini if a smartphone is visible — held in hand, on surface, or on screen
- **State**: tracks `phonePresent` to distinguish "just appeared" vs "still here"
- **Log cooldown**: `phone_detected` events are logged max once every **20 seconds** to avoid spam

---

## Audio Alerts

### Away Beep (slow)
- **Triggers**: after **1 minute** continuously off screen
- **Sound**: 880Hz sine wave, 0.25s duration
- **Rate**: every **1.5 seconds**
- **Stops**: immediately when face reappears, or manually via stop button

### Phone Beep (fast)
- **Triggers**: as soon as phone is detected on camera
- **Sound**: 1320Hz sine wave, 0.1s duration (higher pitch = more urgent)
- **Rate**: every **0.5 seconds**
- **Stops**: within ~3 seconds of phone leaving frame (next scan), or manually via stop button

Both beeps use the **Web Audio API** — no audio files, generated programmatically.

---

## Stop Button
A `◼ STOP BEEPING` button appears in the proctor widget (bottom-right) whenever either beep is active. Clicking it:
1. Clears both beep intervals immediately
2. Resets `awayBeeping` and `phonePresent` flags so detection resumes cleanly
3. The next detection cycle will restart beeping if the condition is still true

---

## Event Types (local-only, not persisted to Supabase)
| Event | Meaning |
|---|---|
| `camera_away` | User's face left the camera frame |
| `camera_return` | User's face reappeared |
| `phone_detected` | Phone spotted in frame (with 20s cooldown) |

These events feed directly into `FocusTimeline` (distracted buckets) and `MetricsRow` tile counts.

---

## Dashboard Impact
- **Off Camera** tile — count of `camera_away` events, color-coded (warn >0, bad >2)
- **Phone Spotted** tile — count of logged `phone_detected` events
- **Focus Timeline** — `camera_away` and `phone_detected` mark 30s buckets as distracted
- **Study Insights** — Gemini receives `cameraAways` and `phoneDetections` counts when generating personalized post-session insights
