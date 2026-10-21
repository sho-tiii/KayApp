import { Check, Lock, Sparkles } from 'lucide-react'

const W = 176
const H = 60
const GX = 76
const GY = 20
const PAD = 16

export default function PathMap({
  topics, edges, layer, status, focusId, lit, routeEdges, shakeId, minutes, darkMode, onPick, onHover,
}) {
  const cols = {}
  topics.forEach((t) => {
    const l = layer.get(t.id) || 0
    if (!cols[l]) cols[l] = []
    cols[l].push(t)
  })
  const maxCol = Math.max(0, ...Object.keys(cols).map(Number))
  const maxRows = Math.max(1, ...Object.values(cols).map((c) => c.length))
  const width = PAD * 2 + (maxCol + 1) * W + maxCol * GX
  const height = PAD * 2 + maxRows * H + (maxRows - 1) * GY

  const pos = {}
  Object.entries(cols).forEach(([l, list]) => {
    const colH = list.length * H + (list.length - 1) * GY
    const top = PAD + (height - PAD * 2 - colH) / 2
    list.forEach((t, i) => {
      pos[t.id] = { x: PAD + Number(l) * (W + GX), y: top + i * (H + GY) }
    })
  })

  const tone = {
    done: 'border-[#E6A51C] bg-[#F5B82E] text-[#173761] hover:-translate-y-0.5',
    ready: 'pm-ready border-[#F5B82E] bg-[#173761] text-white hover:-translate-y-0.5',
    locked: darkMode
      ? 'border-dashed border-[#2A3B51] bg-[#0B1525] text-slate-500'
      : 'border-dashed border-slate-300 bg-[#FAFAF7] text-slate-400',
  }
  const labels = { done: 'mastered', ready: 'ready to study', locked: 'locked' }

  return (
    <div className="overflow-x-auto pb-2">
      <style>{`
        @keyframes pmPulse { 0% { box-shadow: 0 0 0 0 rgba(245,184,46,.55) } 70% { box-shadow: 0 0 0 10px rgba(245,184,46,0) } 100% { box-shadow: 0 0 0 0 rgba(245,184,46,0) } }
        @keyframes pmShake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
        @keyframes pmPop { 0% { transform: scale(1) } 50% { transform: scale(1.07) } 100% { transform: scale(1) } }
        .pm-ready { animation: pmPulse 2s ease-out infinite; }
        .pm-shake { animation: pmShake .4s ease; }
        .pm-lit { animation: pmPop .5s ease both; box-shadow: 0 0 0 3px rgba(245,184,46,.7); }
        @media (prefers-reduced-motion: reduce) { .pm-ready, .pm-shake, .pm-lit { animation: none; } }
      `}</style>

      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
          {edges.map((e) => {
            const a = pos[e.from]
            const b = pos[e.to]
            if (!a || !b) return null
            const x1 = a.x + W
            const y1 = a.y + H / 2
            const x2 = b.x
            const y2 = b.y + H / 2
            const mx = (x1 + x2) / 2
            const onRoute = routeEdges.has(`${e.from}>${e.to}`)
            const isLit = (e.from === focusId || lit.has(e.from)) && lit.has(e.to)
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                strokeLinecap="round"
                strokeWidth={onRoute ? 4 : isLit ? 3 : 2}
                stroke={onRoute ? '#F5B82E' : isLit ? '#E6A51C' : darkMode ? '#2A3B51' : '#D5DAE1'}
                strokeDasharray={onRoute ? '0' : undefined}
                style={{ transition: 'stroke .25s, stroke-width .25s' }}
              />
            )
          })}
        </svg>

        {topics.map((t) => {
          const s = status[t.id]
          const p = pos[t.id]
          const isLit = lit.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={(ev) => onPick(t.id, ev.currentTarget)}
              onMouseEnter={() => onHover(t.id)}
              onMouseLeave={() => onHover('')}
              onFocus={() => onHover(t.id)}
              onBlur={() => onHover('')}
              aria-label={`${t.title}, ${labels[s]}`}
              style={{
                left: p.x,
                top: p.y,
                width: W,
                height: H,
                animationDelay: isLit ? `${lit.get(t.id) * 140}ms` : undefined,
              }}
              className={`absolute flex items-center gap-2.5 rounded-2xl border-2 px-3 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${tone[s]} ${
                isLit ? 'pm-lit' : ''
              } ${shakeId === t.id ? 'pm-shake' : ''}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  s === 'done'
                    ? 'bg-[#173761] text-[#F5B82E]'
                    : s === 'ready'
                    ? 'bg-[#F5B82E] text-[#173761]'
                    : darkMode ? 'bg-[#172840] text-slate-500' : 'bg-slate-200 text-slate-400'
                }`}
              >
                {s === 'done' ? <Check size={16} strokeWidth={3} /> : s === 'ready' ? <Sparkles size={15} /> : <Lock size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{t.title}</span>
                <span className="block text-[11px] opacity-70">{minutes[t.id]} min</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}