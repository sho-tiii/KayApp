import { useState } from 'react'
import { Check } from 'lucide-react'

const initialTasks = [
  { id: 1, text: 'Review Algebra notes', time: '4:00 PM', done: true },
  { id: 2, text: 'Finish Physics worksheet', time: '6:30 PM', done: false },
  { id: 3, text: 'Read Chapter 5 — History', time: '8:00 PM', done: false },
]

export default function PlannerMock() {
  const [tasks, setTasks] = useState(initialTasks)

  const doneCount = tasks.filter((task) => task.done).length
  const pct = Math.round((doneCount / tasks.length) * 100)

  const toggle = (id) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-sm sm:pb-20">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-[#F5B82E]/30 via-transparent to-[#173761]/10 blur-2xl"
      />

      <div className="float-slow relative rounded-2xl border border-[#E7E9E5] bg-white p-5 shadow-[0_20px_60px_-20px_rgba(23,55,97,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Today
            </p>
            <p className="text-lg font-bold">Study plan</p>
          </div>

          <span className="rounded-full bg-[#FFF4D6] px-3 py-1 text-xs font-bold text-[#8A5F0B]">
            {doneCount}/{tasks.length} done
          </span>
        </div>

        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9EDF2]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F5B82E] to-[#E6A51C] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="mt-4 space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => toggle(task.id)}
                aria-pressed={task.done}
                className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent bg-[#FAFAF7] px-3 py-3 text-left transition hover:border-[#D6B75E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173761]"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    task.done
                      ? 'border-[#173761] bg-[#173761] text-white'
                      : 'border-slate-300 bg-white text-transparent group-hover:border-[#173761]'
                  }`}
                >
                  <Check size={13} strokeWidth={3} />
                </span>

                <span
                  className={`min-w-0 flex-1 text-sm transition ${
                    task.done
                      ? 'text-slate-400 line-through'
                      : 'text-[#173761]'
                  }`}
                >
                  {task.text}
                </span>

                <span className="shrink-0 text-xs text-slate-400">
                  {task.time}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-xs text-slate-400">
          Try it — tap a task
        </p>
      </div>
    </div>
  )
}