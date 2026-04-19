import { motion } from 'framer-motion'
import { useSessionContext } from '../../context/SessionContext'
import ScoreCard    from './ScoreCard'
import MetricsRow   from './MetricsRow'
import FocusTimeline from './FocusTimeline'

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
}

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function GlassCard({ children, className = '' }) {
  return (
    <motion.div
      variants={cardVariant}
      className={`rounded-2xl border border-seafoam/20 bg-white/5 backdrop-blur-md p-5 shadow-[0_0_30px_rgba(14,124,123,0.1)] ${className}`}
    >
      {children}
    </motion.div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-seafoam text-[10px] font-semibold uppercase tracking-[0.15em] mb-3">
      {children}
    </p>
  )
}

export default function SummaryDashboard({ onDiveAgain }) {
  const {
    report,
    tabSwitches,
    fullscreenExits,
    pauses,
    startTime,
    endTime,
    events,
  } = useSessionContext()

  if (!report) {
    return (
      <div className="min-h-screen bg-deep-navy flex items-center justify-center">
        <p className="text-seafoam text-sm animate-pulse">Analyzing your session...</p>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-b from-deep-navy via-[#0A1C38] to-ocean px-6 py-10" style={{ cursor: 'auto' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="text-5xl mb-3">🌊</div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Your Deep Dive Report</h1>
        <p className="text-seafoam/70 mt-2 text-sm">You made it to the surface! 🎉</p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-4"
      >
        {/* Row 1: Score + Assignment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="flex flex-col items-center justify-center gap-4">
            <SectionLabel>Performance</SectionLabel>
            <ScoreCard
              score={report.performance_score}
              status={report.completion_status}
            />
          </GlassCard>

          <GlassCard className="md:col-span-2">
            <SectionLabel>Assignment Summary</SectionLabel>
            <p className="text-white/80 text-sm leading-relaxed">{report.assignment_summary}</p>
          </GlassCard>
        </div>

        {/* Row 2: Strengths + Areas to Improve */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard>
            <SectionLabel>Strengths</SectionLabel>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/80">
                  <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <SectionLabel>Areas to Improve</SectionLabel>
            <ul className="space-y-2">
              {report.areas_to_improve.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/80">
                  <span className="text-sand mt-0.5 shrink-0">→</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

        {/* Row 3: Metrics */}
        <motion.div variants={cardVariant}>
          <MetricsRow
            startTime={startTime}
            endTime={endTime}
            tabSwitches={tabSwitches}
            fullscreenExits={fullscreenExits}
            pauses={pauses}
            events={events}
          />
        </motion.div>

        {/* Row 4: Focus Timeline */}
        <GlassCard>
          <SectionLabel>Focus Timeline</SectionLabel>
          <FocusTimeline events={events} startTime={startTime} endTime={endTime} />
          <div className="flex gap-5 mt-3 justify-end">
            {[
              { color: '#0E7C7B', label: 'Focused'    },
              { color: '#E9C46A', label: 'Paused'     },
              { color: '#EF4444', label: 'Distracted' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-white/50">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </GlassCard>

        {/* Row 5: Encouragement from Coral */}
        <GlassCard className="border-sand/30 bg-sand/5 text-center">
          <SectionLabel>From Coral</SectionLabel>
          <p className="text-white/90 italic text-base leading-relaxed">
            "{report.encouragement}"
          </p>
        </GlassCard>

        {/* Dive Again CTA */}
        <motion.div variants={cardVariant} className="text-center pb-6">
          <button
            onClick={onDiveAgain}
            className="px-10 py-3 rounded-full bg-sand text-deep-navy font-bold text-sm hover:brightness-110 active:scale-95 transition-all"
          >
            Dive Again 🤿
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
