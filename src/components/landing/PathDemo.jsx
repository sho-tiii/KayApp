
import { useMemo, useState } from 'react'
import { Check, GitBranch, Lock, RotateCcw, Sparkles } from 'lucide-react'

const topics = [
  { id: 'arith', label: 'Arithmetic', level: 0, needs: [] },
  { id: 'algebra', label: 'Algebra', level: 1, needs: ['arith'] },
  { id: 'geometry', label: 'Geometry', level: 1, needs: ['arith'] },
  { id: 'functions', label: 'Functions', level: 2, needs: ['algebra'] },
  {
    id: 'trig',
    label: 'Trigonometry',
    level: 2,
    needs: ['algebra', 'geometry'],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    level: 3,
    needs: ['functions', 'trig'],
  },
]

const labelOf = (id) => topics.find((topic) => topic.id === id)?.label ?? id

export default function PathDemo() {
  const [done, setDone] = useState([])
  const [shakeId, setShakeId] = useState(null)
  const [note, setNote] = useState('Pick an open topic to get started.')

  const statusOf = (topic) => {
    if (done.includes(topic.id)) return 'done'

    return topic.needs.every((id) => done.includes(id))
      ? 'open'
      : 'locked'
  }

  const total = topics.length
  const pct = Math.round((done.length / total) * 100)
  const finished = done.length === total

  const columns = useMemo(
    () =>
      [0, 1, 2, 3].map((level) => ({
        level,
        items: topics.filter((topic) => topic.level === level),
      })),
    [],
  )

  const handleClick = (topic) => {
    const status = statusOf(topic)

    if (status === 'locked') {
      const missing = topic.needs
        .filter((id) => !done.includes(id))
        .map(labelOf)

      setNote(`Finish ${missing.join(' and ')} before ${topic.label}.`)
      setShakeId(topic.id)
      setTimeout(() => setShakeId(null), 450)
      return
    }

    if (status === 'done') {
      const dependents = topics.filter(
        (item) => item.needs.includes(topic.id) && done.includes(item.id),
      )

      if (dependents.length > 0) {
        setNote(
          `Can't undo — ${dependents
            .map((item) => item.label)
            .join(', ')} depends on it.`,
        )
        setShakeId(topic.id)
        setTimeout(() => setShakeId(null), 450)
        return
      }

      setDone((current) => current.filter((id) => id !== topic.id))
      setNote(`${topic.label} marked as not done.`)
      return
    }

    const next = [...done, topic.id]
    setDone(next)

    const unlocked = topics.filter(
      (item) =>
        !next.includes(item.id) &&
        item.needs.includes(topic.id) &&
        item.needs.every((id) => next.includes(id)),
    )

    if (next.length === total) {
      setNote('You finished the whole path!')
    } else if (unlocked.length > 0) {
      setNote(
        `Nice! Unlocked: ${unlocked
          .map((item) => item.label)
          .join(', ')}.`,
      )
    } else {
      setNote(`Nice! ${topic.label} done.`)
    }
  }

  const reset = () => {
    setDone([])
    setNote('Pick an open topic to get started.')
    setShakeId(null)
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#173761] p-6 text-white shadow-[0_30px_80px_-30px_rgba(23,55,97,0.6)] sm:p-10">
      {/* Decorative glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#F5B82E]/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 opacity-[0.07]"
      />

      {/* Completion confetti */}
      {finished && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="confetti"
              style={{
                left: `${(index * 37) % 100}%`,
                animationDelay: `${(index % 6) * 120}ms`,
                background:
                  index % 3 === 0
                    ? '#F5B82E'
                    : index % 3 === 1
                      ? '#FFFFFF'
                      : '#7FA6D6',
              }}
            />
          ))}
        </div>
      )}

      <div className="relative">
        {/* Heading */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[2px] text-[#F5B82E]">
              Try it · Learning Path
            </p>

            <h3 className="mt-2 text-2xl font-bold sm:text-3xl">
              See what to study first.
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/70">
              Tap a topic to complete it. Topics with prerequisites unlock
              as soon as you've finished the ones they depend on.
            </p>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>

        {/* Progress */}
        <div className="mt-6 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Learning path progress"
          >
            <div
              className="h-full rounded-full bg-[#F5B82E] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <span className="w-20 text-right text-xs font-semibold text-white/70">
            {done.length}/{total} topics
          </span>
        </div>

        {/* Topic columns */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {columns.map((column) => (
            <div
              key={column.level}
              className="flex flex-col gap-3 md:justify-center"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                Step {column.level + 1}
              </p>

              {column.items.map((topic) => {
                const status = statusOf(topic)
                const isDone = status === 'done'
                const isOpen = status === 'open'

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleClick(topic)}
                    aria-disabled={status === 'locked'}
                    aria-label={`${topic.label} — ${status}`}
                    className={[
                      'group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]',
                      shakeId === topic.id ? 'shake' : '',
                      isDone
                        ? 'border-[#F5B82E] bg-[#F5B82E] text-[#173761]'
                        : isOpen
                          ? 'pulse-ring border-white/40 bg-white/10 hover:bg-white/20'
                          : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/40',
                    ].join(' ')}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isDone
                          ? 'bg-[#173761] text-[#F5B82E]'
                          : isOpen
                            ? 'bg-white/15'
                            : 'bg-white/5'
                      }`}
                    >
                      {isDone ? (
                        <Check size={15} strokeWidth={3} />
                      ) : isOpen ? (
                        <Sparkles size={14} />
                      ) : (
                        <Lock size={13} />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {topic.label}
                      </span>

                      <span
                        className={`block truncate text-[11px] ${
                          isDone
                            ? 'text-[#173761]/70'
                            : 'text-white/45'
                        }`}
                      >
                        {topic.needs.length > 0
                          ? `Needs: ${topic.needs.map(labelOf).join(' + ')}`
                          : 'Start here'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Accessible status message */}
        <p
          aria-live="polite"
          className="mt-6 min-h-[1.5rem] rounded-lg bg-white/5 px-4 py-3 text-sm text-white/80"
        >
          {note}
        </p>
      </div>
    </div>
  )
}
