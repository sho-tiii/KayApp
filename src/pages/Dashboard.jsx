import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, Check, Trash2, CalendarDays, Sun, Moon, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import kayappLogo from '../assets/KAYAPP.png'
import SubjectManager from '../components/dashboard/SubjectManager'

/* ------------------------------------------------------------------ */
/* Confetti (same engine as the landing page)                          */
/* ------------------------------------------------------------------ */

function ConfettiCanvas({ fireRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const colors = ['#F5B82E', '#E6A51C', '#173761', '#7FA6D6', '#FFFFFF', '#FFD878']
    let parts = []
    let raf = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      parts = parts.filter((p) => p.life > 0 && p.y < window.innerHeight + 40)
      for (const p of parts) {
        p.vx *= 0.985
        p.vy = p.vy * 0.985 + 0.28
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.wob += 0.18
        p.life -= 1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.cos(p.wob))
        ctx.globalAlpha = Math.min(1, p.life / 40)
        ctx.fillStyle = p.c
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        ctx.restore()
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0
      if (!parts.length) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }

    fireRef.current = ({ x, y, count = 40, angle = -90, spread = 360, power = 9 }) => {
      for (let i = 0; i < count; i++) {
        const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180
        const s = power * (0.45 + Math.random() * 0.75)
        parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 7,
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 0.4,
          wob: Math.random() * 6.28,
          c: colors[(Math.random() * colors.length) | 0],
          round: Math.random() < 0.2,
          life: 130 + Math.random() * 80,
        })
      }
      if (!raf) raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (raf) cancelAnimationFrame(raf)
      fireRef.current = null
    }
  }, [fireRef])

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />
  )
}

/* ------------------------------------------------------------------ */
/* Progress ring                                                       */
/* ------------------------------------------------------------------ */

function ProgressRing({ percent }) {
  const r = 38
  const c = 2 * Math.PI * r
  return (
    <div
      role="progressbar"
      aria-label="Tasks completed"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="relative h-24 w-24 shrink-0"
    >
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke="#F5B82E" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * percent) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
        {percent}%
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Dashboard({ session, darkMode, onToggleTheme }) {
  const navigate = useNavigate()
  const fireRef = useRef(null)
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (session) {
      fetchTasks()
    }
  }, [session])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title: newTask, user_id: session.user.id }])
        .select()

      if (error) throw error
      setTasks([data[0], ...tasks])
      setNewTask('')
    } catch (error) {
      console.error('Error adding task:', error.message)
    }
  }

  const toggleTask = async (id, currentStatus, e) => {
    // grab the checkbox position before the await (the event is gone afterwards)
    const rect = e?.currentTarget?.getBoundingClientRect()
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_done: !currentStatus })
        .eq('id', id)

      if (error) throw error
      setTasks(tasks.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t))

      if (!currentStatus && rect && fireRef.current) {
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const allDone = tasks.every(t => (t.id === id ? true : t.is_done))
        if (allDone) {
          fireRef.current({ x: 0, y: window.innerHeight, count: 90, angle: -55, spread: 40, power: 22 })
          fireRef.current({ x: window.innerWidth, y: window.innerHeight, count: 90, angle: -125, spread: 40, power: 22 })
          fireRef.current({ x, y, count: 60, power: 10 })
        } else {
          fireRef.current({ x, y, count: 26, power: 7 })
        }
      }
    } catch (error) {
      console.error('Error updating task:', error.message)
    }
  }

  const deleteTask = async (id) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTasks(tasks.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting task:', error.message)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  /* ---------- derived ---------- */
  const total = tasks.length
  const doneCount = tasks.filter(t => t.is_done).length
  const leftCount = total - doneCount
  const percent = total ? Math.round((doneCount / total) * 100) : 0
  const visible = tasks.filter(t => filter === 'all' ? true : filter === 'done' ? t.is_done : !t.is_done)

  const email = session?.user?.email || ''
  const meta = session?.user?.user_metadata || {}
  const fullName = (
    meta.full_name || meta.name || meta.display_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ')
  ).trim()
  const firstName = fullName.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
  const message = !total
    ? 'No tasks yet. Add your first one below.'
    : leftCount === 0
    ? 'All tasks done. Time to rest.'
    : `${leftCount} left. You've got this.`

  /* ---------- theme ---------- */
  const bgClass = darkMode ? 'bg-[#0B1525] text-slate-100' : 'bg-[#FAFAF7] text-[#173761]'
  const headerBg = darkMode ? 'border-white/10 bg-[#101D30]/95' : 'border-[#E9E9E3] bg-white/90'
  const cardBg = darkMode ? 'bg-[#111F33] border-[#2A3B51]' : 'bg-white border-[#E7E9E5]'
  const inputBg = darkMode
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]'
    : 'bg-[#FAFAF7] border-[#E7E9E5] text-[#173761] focus:border-[#F5B82E]'
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500'

  const filters = [
    { key: 'all', label: 'All', n: total },
    { key: 'todo', label: 'To do', n: leftCount },
    { key: 'done', label: 'Done', n: doneCount },
  ]

  return (
    <div className={`relative min-h-screen ${bgClass}`}>
      <style>{`
        @keyframes kdIn  { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes kdPop { 0% { transform: scale(1) } 45% { transform: scale(1.3) } 100% { transform: scale(1) } }
        @keyframes kdDrift { from { transform: translate3d(0,0,0) } to { transform: translate3d(40px,24px,0) } }
        .kd-in { animation: kdIn .35s ease both; }
        .kd-pop { animation: kdPop .35s ease; }
        .kd-drift { animation: kdDrift 14s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) { .kd-in, .kd-pop, .kd-drift { animation: none; } }
      `}</style>

      <ConfettiCanvas fireRef={fireRef} />

      {/* Soft background glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className={`kd-drift absolute -left-20 top-10 h-72 w-72 rounded-full blur-3xl ${darkMode ? 'bg-[#F5B82E]/10' : 'bg-[#F5B82E]/20'}`} />
        <div className={`kd-drift absolute -right-10 top-0 h-80 w-80 rounded-full blur-3xl ${darkMode ? 'bg-[#7FA6D6]/10' : 'bg-[#7FA6D6]/20'}`} />
      </div>

      {/* Private Dashboard Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur transition-colors duration-300 px-6 py-3 ${headerBg}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={kayappLogo} alt="KayApp" className="h-10 w-20 object-contain object-left" />
            <span className={`hidden sm:block text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-[#F5B82E]' : 'text-[#B78116]'}`}>
              Student Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5B82E] text-sm font-bold uppercase text-[#173761]">
                {(fullName || email).charAt(0) || '?'}
              </span>
              <span className={`text-sm ${muted}`}>{fullName || email}</span>
            </div>

            <button
              onClick={onToggleTheme}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Light mode" : "Dark mode"}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                darkMode
                  ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#173761]'
              }`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleSignOut}
              className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                darkMode ? 'hover:bg-white/10 text-red-400' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <LogOut size={16} />
              <span className="hidden sm:block">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Greeting + progress */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#173761] to-[#244B7D] p-6 text-white shadow-[0_24px_50px_-24px_rgba(23,55,97,0.8)] sm:p-8">
          <div aria-hidden="true" className="kd-drift pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#F5B82E]/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#F5B82E]">
                <Sparkles size={14} aria-hidden="true" />
                {today}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting}{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="mt-2 text-sm text-white/70">{message}</p>

              <dl className="mt-5 flex gap-3">
                {[
                  ['Total', total],
                  ['Done', doneCount],
                  ['Left', leftCount],
                ].map(([label, n]) => (
                  <div key={label} className="min-w-[72px] rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
                    <dt className="text-[11px] text-white/60">{label}</dt>
                    <dd className="text-xl font-bold">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <ProgressRing percent={percent} />
          </div>
        </section>

        {/* Subjects, Topics and Learning Path */}
        <SubjectManager session={session} darkMode={darkMode} />

        {/* Real Task Manager Section */}
        <div className={`rounded-2xl border p-6 shadow-sm transition-colors duration-300 ${cardBg}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays size={20} className={darkMode ? 'text-[#F5B82E]' : 'text-[#173761]'} />
              Upcoming Tasks
            </h2>

            <div role="tablist" aria-label="Filter tasks" className={`flex gap-1 rounded-lg p-1 ${darkMode ? 'bg-[#0B1525]' : 'bg-[#F1F2EE]'}`}>
              {filters.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`h-9 rounded-md px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                    filter === f.key
                      ? 'bg-[#173761] text-white shadow-sm'
                      : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-[#173761]'
                  }`}
                >
                  {f.label} <span className="opacity-60">{f.n}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={addTask} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What do you need to study?"
              aria-label="New task"
              className={`h-10 flex-1 rounded-lg border px-4 text-sm transition focus:outline-none focus:ring-1 focus:ring-[#F5B82E] ${inputBg}`}
            />
            <button
              type="submit"
              disabled={!newTask.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173761] px-5 text-sm font-semibold text-white transition hover:bg-[#244B7D] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-50"
            >
              <Plus size={16} />
              <span>Add Task</span>
            </button>
          </form>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-14 animate-pulse rounded-xl ${darkMode ? 'bg-[#0B1525]' : 'bg-[#F1F2EE]'}`} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className={`rounded-xl border border-dashed py-10 text-center ${darkMode ? 'border-[#2A3B51] bg-[#0B1525]' : 'border-slate-300 bg-[#FAFAF7]'}`}>
                <p className={`text-sm ${muted}`}>
                  {tasks.length === 0
                    ? 'No tasks yet. Create your first study plan above!'
                    : filter === 'done'
                    ? 'Nothing done yet. Start with just one.'
                    : 'Nothing left to do. Nice work!'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((task) => (
                  <li
                    key={task.id}
                    className={`kd-in group flex items-center justify-between rounded-xl border p-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                      darkMode ? 'border-[#2A3B51] bg-[#0B1525] hover:border-[#D6B75E]' : 'border-[#E7E9E5] bg-[#FAFAF7] hover:border-[#D6B75E]'
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-3 overflow-hidden">
                      <button
                        onClick={(e) => toggleTask(task.id, task.is_done, e)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                          task.is_done
                            ? 'kd-pop border-[#F5B82E] bg-[#F5B82E] text-[#173761]'
                            : darkMode
                            ? 'border-slate-600 bg-transparent text-transparent group-hover:border-[#F5B82E]'
                            : 'border-slate-300 bg-white text-transparent group-hover:border-[#173761]'
                        }`}
                        aria-label={task.is_done ? "Mark as undone" : "Mark as done"}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>

                      <span className={`truncate text-sm transition ${
                        task.is_done
                          ? (darkMode ? 'text-slate-500 line-through' : 'text-slate-400 line-through')
                          : (darkMode ? 'text-slate-200' : 'text-[#173761]')
                      }`}>
                        {task.title}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className={`ml-2 shrink-0 rounded-lg p-2 opacity-60 transition group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
                        darkMode ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                      aria-label="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}