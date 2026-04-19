const STATUS_CONFIG = {
  complete:   { label: 'Complete',   ringClass: 'text-green-400  border-green-400'  },
  partial:    { label: 'Partial',    ringClass: 'text-yellow-400 border-yellow-400' },
  incomplete: { label: 'Incomplete', ringClass: 'text-red-400    border-red-400'    },
}

function scoreRing(score) {
  if (score >= 80) return 'text-green-400  border-green-400'
  if (score >= 60) return 'text-yellow-400 border-yellow-400'
  return              'text-red-400    border-red-400'
}

export default function ScoreCard({ score, status }) {
  const ring   = scoreRing(score)
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.partial

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex items-center justify-center w-28 h-28 rounded-full border-4 ${ring}`}>
        <span className="text-4xl font-bold font-mono">{score}</span>
      </div>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${config.ringClass} bg-white/5`}>
        {config.label}
      </span>
    </div>
  )
}
