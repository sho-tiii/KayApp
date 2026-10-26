import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  GitBranch,
  Sparkles,
} from 'lucide-react'

import Reveal from '../components/common/Reveal'
import Eyebrow from '../components/common/Eyebrow'
import PlannerMock from '../components/landing/PlannerMock'
import PathDemo from '../components/landing/PathDemo'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const features = [
  { icon: CalendarDays, title: 'Study Planner', description: 'Organize your study sessions, tasks, and deadlines in one place.', number: '01' },
  { icon: BookOpen, title: 'Subject Tracker', description: 'Keep track of your subjects, topics, and learning progress.', number: '02' },
  { icon: GitBranch, title: 'Learning Paths', description: 'Discover which topics to study first based on their prerequisites.', number: '03' },
]

const steps = [
  { icon: BookOpen, title: 'Add your subjects', text: "List what you're studying this term." },
  { icon: CalendarDays, title: 'Plan your sessions', text: 'Set tasks and deadlines that fit your week.' },
  { icon: GitBranch, title: 'Follow your path', text: 'See what to study next, one topic at a time.' },
]

const rotatingWords = ['manageable', 'organized', 'doable']

const subjects = [
  'Mathematics', 'Biology', 'History', 'Programming', 'Chemistry',
  'Literature', 'Physics', 'Economics', 'Psychology', 'Languages',
]

const mottos = [
  'Kaya mo ’yan. May plano ka na.',
  'Isang topic lang muna. Konti-konti lang.',
  'Pahinga muna, tapos tuloy ulit.',
  'Malapit ka na. Laban lang!',
]

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function useInView(threshold = 0.3) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return [ref, inView]
}

/**
 * Real confetti: a full-screen canvas with physics (gravity, drag, spin,
 * paper-flip). `fireRef.current({ x, y, count, angle, spread, power })`
 * shoots pieces from a point. Runs only while pieces are alive.
 */
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

    fireRef.current = ({ x, y, count = 60, angle = -90, spread = 360, power = 11 }) => {
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
          life: 150 + Math.random() * 90,
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
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[80] h-full w-full"
    />
  )
}

/** Two cannons + a center burst, aimed at the Learning Path card. */
function celebrate(fire, section) {
  if (!fire) return
  const r = section.getBoundingClientRect()
  const y = Math.min(Math.max(r.top + r.height * 0.72, 120), window.innerHeight - 40)
  const left = Math.max(r.left, 0) + 56
  const right = Math.min(r.right, window.innerWidth) - 56
  const cx = (left + right) / 2
  const cy = Math.min(Math.max(r.top + r.height * 0.3, 80), window.innerHeight - 200)

  const volley = () => {
    fire({ x: left, y, count: 70, angle: -58, spread: 50, power: 17 })
    fire({ x: right, y, count: 70, angle: -122, spread: 50, power: 17 })
  }
  volley()
  setTimeout(volley, 220)
  setTimeout(() => fire({ x: cx, y: cy, count: 90, angle: -90, spread: 360, power: 10 }), 420)
}

/** Thin gold bar at the very top that fills as you scroll. */
function ScrollProgress() {
  const barRef = useRef(null)

  useEffect(() => {
    let raf = 0

    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const p = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        ref={barRef}
        className="h-full origin-left bg-gradient-to-r from-[#F5B82E] to-[#E6A51C] shadow-[0_0_12px_#F5B82E]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}

/** Headline word that cycles: manageable → organized → doable. */
function RotatingWord({ words }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const id = setInterval(() => setIndex((n) => (n + 1) % words.length), 2600)
    return () => clearInterval(id)
  }, [words.length])

  return (
    <span className="relative inline-grid align-bottom">
      <span className="sr-only">{words[0]}.</span>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden="true"
          className={`lp-word shimmer-text col-start-1 row-start-1 ${i === index ? 'lp-word-in' : ''}`}
        >
          {word}.
        </span>
      ))}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 10"
        preserveAspectRatio="none"
        className="lp-scribble absolute -bottom-1 left-0 h-2 w-full text-[#F5B82E]"
      >
        <path d="M2 6 C 40 1, 80 10, 120 4 S 180 3, 198 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** Feature card with a gentle tilt and a gold glow that follows the cursor. */
function FeatureCard({ feature }) {
  const Icon = feature.icon

  const handleMove = (e) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    el.style.setProperty('--fx', `${x}px`)
    el.style.setProperty('--fy', `${y}px`)
    el.style.setProperty('--ry', `${((x / rect.width - 0.5) * 5).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((y / rect.height - 0.5) * -5).toFixed(2)}deg`)
  }

  const handleLeave = (e) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  return (
    <article
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="lp-tilt-card group relative h-full overflow-hidden rounded-xl border border-[#E7E9E5] bg-[#FAFAF7] p-6 hover:border-[#D6B75E] hover:bg-white hover:shadow-[0_20px_40px_-20px_rgba(23,55,97,0.3)] dark:border-[#2A3B51] dark:bg-[#111F33] dark:hover:border-[#D6B75E] dark:hover:bg-[#172840]"
    >
      <div
        aria-hidden="true"
        className="lp-card-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAF0F7] text-[#173761] transition duration-300 group-hover:rotate-6 group-hover:bg-[#173761] group-hover:text-[#F5B82E] dark:bg-[#172840] dark:text-slate-300">
            <Icon size={21} strokeWidth={1.8} />
          </div>
          <span className="text-xs font-semibold text-slate-400 transition group-hover:text-[#B78116] dark:text-slate-500">
            {feature.number}
          </span>
        </div>

        <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{feature.description}</p>
      </div>
    </article>
  )
}

/** Two endless strips of subjects, opposite directions. Pause on hover. */
function SubjectMarquee() {
  const group = (list, hidden) => (
    <ul className="flex shrink-0 items-center gap-4 pr-4" aria-hidden={hidden || undefined}>
      {list.map((s) => (
        <li
          key={s}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#E9E9E3] bg-[#FAFAF7] px-4 py-1.5 text-sm font-semibold text-[#173761]/70 transition duration-200 hover:scale-105 hover:border-[#F5B82E] hover:bg-[#FFF8E3] hover:text-[#173761] dark:border-[#2A3B51] dark:bg-[#0B1525] dark:text-slate-300 dark:hover:border-[#F5B82E] dark:hover:bg-[#172840] dark:hover:text-[#F5B82E]"
        >
          <Sparkles size={13} className="text-[#E6A51C]" />
          {s}
        </li>
      ))}
    </ul>
  )
  const reversed = [...subjects].reverse()

  return (
    <div className="border-y border-[#E9E9E3] bg-white py-5 dark:border-[#2A3B51] dark:bg-[#111F33]">
      <p className="mb-4 text-center text-xs font-bold uppercase tracking-[2px] text-slate-400">
        Plan any subject
      </p>

      <div className="lp-marquee-wrap overflow-hidden">
        <div className="lp-marquee">
          {group(subjects, false)}
          {group(subjects, true)}
        </div>
      </div>
      <div className="lp-marquee-wrap mt-3 overflow-hidden">
        <div className="lp-marquee lp-marquee-rev">
          {group(reversed, true)}
          {group(reversed, true)}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LandingPage() {
  const heroRef = useRef(null)
  const fireRef = useRef(null)
  const [stepsRef, stepsInView] = useInView(0.35)
  const [mottoIdx, setMottoIdx] = useState(0)
  const [done, setDone] = useState([false, false, false])
  const doneCount = done.filter(Boolean).length

  const pop = (x, y, count = 30) =>
    fireRef.current?.({ x, y, count, angle: -90, spread: 360, power: 8 })

  /* Real confetti when the Learning Path demo hits 100%.
     Watches the demo's own "n/n topics" counter, so PathDemo stays untouched. */
  useEffect(() => {
    const sec = document.getElementById('try')
    if (!sec) return

    const isComplete = () => {
      const text = sec.textContent || ''
      const m = text.match(/(\d+)\s*\/\s*(\d+)\s*topics/i)
      return m ? m[1] === m[2] && Number(m[2]) > 0 : /finished the whole path/i.test(text)
    }

    let was = isComplete()
    const mo = new MutationObserver(() => {
      const now = isComplete()
      if (now && !was) celebrate(fireRef.current, sec)
      was = now
    })
    mo.observe(sec, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [])

  const handleHeroMove = (e) => {
    const el = heroRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    el.style.setProperty('--mx', `${x}px`)
    el.style.setProperty('--my', `${y}px`)
    el.style.setProperty('--nx', (x / rect.width - 0.5).toFixed(3))
    el.style.setProperty('--ny', (y / rect.height - 0.5).toFixed(3))
  }

  const handleHeroLeave = () => {
    const el = heroRef.current
    if (!el) return
    el.style.setProperty('--nx', '0')
    el.style.setProperty('--ny', '0')
  }

  const handleMotto = (e) => {
    pop(e.clientX, e.clientY, 24)
    setMottoIdx((n) => (n + 1) % mottos.length)
  }

  const toggleStep = (i, e) => {
    setDone((d) => d.map((v, j) => (j === i ? !v : v)))
    if (!done[i]) pop(e.clientX, e.clientY, 28)
  }

  const handleGetStarted = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    fireRef.current?.({ x, y, count: 60, angle: -90, spread: 120, power: 15 })
    fireRef.current?.({ x, y, count: 40, angle: -90, spread: 360, power: 8 })
  }

  return (
    <main>
      <style>{`
        /* Aurora blobs */
        @keyframes lpDrift   { from { transform: translate3d(0,0,0) scale(1) } to { transform: translate3d(48px,36px,0) scale(1.18) } }
        @keyframes lpDrift2  { from { transform: translate3d(0,0,0) scale(1.1) } to { transform: translate3d(-56px,28px,0) scale(0.92) } }
        .lp-drift  { animation: lpDrift 14s ease-in-out infinite alternate; }
        .lp-drift2 { animation: lpDrift2 17s ease-in-out infinite alternate; }

        .lp-fade {
          -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
        }

        /* Cursor-following gold light in the hero */
        .lp-cursor-glow {
          background: radial-gradient(380px circle at var(--mx, 70%) var(--my, 30%), rgba(245,184,46,.22), transparent 65%);
        }

        /* Planner tilt */
        .lp-tilt {
          transform: perspective(1100px) rotateY(calc(var(--nx, 0) * 7deg)) rotateX(calc(var(--ny, 0) * -7deg));
          transition: transform .25s ease-out;
          will-change: transform;
        }

        /* Rotating headline word + hand-drawn underline */
        .lp-word { opacity: 0; transform: translateY(0.45em); transition: opacity .5s ease, transform .5s ease; }
        .lp-word-in { opacity: 1; transform: none; }
        @keyframes lpDraw { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
        .lp-scribble { animation: lpDraw 1.1s .9s cubic-bezier(.22,1,.36,1) both; }

        /* Button shine */
        .lp-shine { position: relative; overflow: hidden; }
        .lp-shine::after {
          content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
          transform: skewX(-20deg); transition: left .7s ease; pointer-events: none;
        }
        .lp-shine:hover::after { left: 130%; }

        /* Final CTA: a gold light that circles the button's border */
        @keyframes lpSpin { to { transform: rotate(360deg) } }
        .lp-beam-ring { position: absolute; inset: 0; overflow: hidden; border-radius: 14px; background: rgba(23,55,97,.18); }
        .lp-beam-ring::before {
          content: ''; position: absolute; left: 50%; top: 50%; width: 220%; aspect-ratio: 1; translate: -50% -50%;
          background: conic-gradient(from 0deg, transparent 0 55%, #F5B82E 82%, #FFF1C2 92%, transparent 100%);
          animation: lpSpin 2.8s linear infinite;
        }
        .lp-beam:hover .lp-beam-ring::before { animation-duration: 1.2s; }

        /* Motto swap */
        @keyframes lpMotto { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        .lp-motto { animation: lpMotto .4s ease both; }

        /* Marquee (keeps moving even with reduced-motion; it is slow and pauses on hover) */
        @keyframes lpMarquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .lp-marquee { display: flex; width: max-content; will-change: transform; animation: lpMarquee 40s linear infinite; }
        .lp-marquee-rev { animation-direction: reverse; animation-duration: 48s; }
        .lp-marquee-wrap {
          -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
          mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
        }
        .lp-marquee-wrap:hover .lp-marquee { animation-play-state: paused; }

        /* Steps connector draws itself, then fills with progress */
        .lp-line { transform: scaleX(0); transition: transform 1.6s cubic-bezier(.22,1,.36,1) .3s; }
        .lp-line-in { transform: scaleX(1); }
        .lp-progress { transition: transform .6s cubic-bezier(.22,1,.36,1); }

        /* Feature card: subtle tilt + cursor glow */
        .lp-tilt-card {
          transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          transition: transform .2s ease-out, border-color .3s, background-color .3s, box-shadow .3s;
        }
        .lp-tilt-card:hover { transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateY(-4px); }
        .lp-card-glow {
          background: radial-gradient(260px circle at var(--fx, 50%) var(--fy, 0%), rgba(245,184,46,.2), transparent 70%);
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-drift, .lp-drift2, .lp-scribble, .lp-motto { animation: none; }
          .lp-tilt, .lp-tilt-card, .lp-tilt-card:hover { transform: none; transition: none; }
          .lp-word { transition: none; }
          .lp-line { transform: scaleX(1); transition: none; }
          .lp-shine::after { display: none; }
        }
      `}</style>

      <ScrollProgress />
      <ConfettiCanvas fireRef={fireRef} />

      {/* Hero */}
      <section
        id="about"
        ref={heroRef}
        onMouseMove={handleHeroMove}
        onMouseLeave={handleHeroLeave}
        className="relative overflow-hidden"
      >
        {/* Aurora blobs */}
        <div aria-hidden="true" className="lp-fade pointer-events-none absolute inset-0 overflow-hidden">
          <div className="lp-drift absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#F5B82E]/25 blur-3xl" />
          <div className="lp-drift2 absolute -top-10 right-0 h-96 w-96 rounded-full bg-[#7FA6D6]/25 blur-3xl" />
          <div className="lp-drift absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#173761]/10 blur-3xl" />
        </div>

        <div aria-hidden="true" className="spotlight fade-bottom pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="lp-cursor-glow pointer-events-none absolute inset-0" />

        <div
          aria-hidden="true"
          className="dot-grid fade-bottom pointer-events-none absolute inset-0 text-[#173761] opacity-[0.06] dark:text-slate-100"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#EBDDB0] bg-[#FFF8E3] px-3 py-1.5 text-xs font-bold uppercase tracking-[2px] text-[#B78116] dark:border-[#75622E] dark:bg-[#202B3B] dark:text-[#F5B82E]">
                <Sparkles size={13} className="animate-pulse" />
                Your personal student planner
              </p>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
                Make studying
                <br />
                feel more <RotatingWord words={rotatingWords} />
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-400">
                Plan your study sessions, organize your subjects, and find your next
                learning step — all in one place.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div id="get-started" className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#try"
                  className="lp-shine group inline-flex items-center gap-3 rounded-lg bg-[#173761] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(23,55,97,0.7)] transition hover:-translate-y-0.5 hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  Try the Learning Path
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>

                <a
                  href="#features"
                  className="rounded-lg px-4 py-3.5 text-sm font-semibold text-[#173761] transition hover:bg-[#173761]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173761] dark:text-slate-100 dark:hover:bg-white/5"
                >
                  Explore features
                </a>
              </div>

              <button
                type="button"
                onClick={handleMotto}
                title="Click mo ako!"
                className="mt-5 inline-flex items-center gap-2 rounded-full text-left text-sm text-slate-500 transition hover:text-[#173761] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] dark:hover:text-slate-300"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-ping rounded-full bg-[#F5B82E]" />
                <span key={mottoIdx} className="lp-motto">{mottos[mottoIdx]}</span>
              </button>
            </Reveal>
          </div>

          <Reveal delay={200} className="flex items-center justify-center self-stretch">
            <div className="lp-tilt">
              <PlannerMock />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Subject marquee */}
      <SubjectMarquee />

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-20">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Three simple steps.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
              From a messy to-do list to a clear plan, in minutes.
            </p>
          </div>
        </Reveal>

        <div ref={stepsRef} className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-6">
          <div aria-hidden="true" className="absolute left-[17%] right-[17%] top-8 hidden md:block">
            <div className="border-t-2 border-dashed border-[#DCC580]" />
            <div
              className={`lp-line absolute left-0 top-0 h-[2px] w-full origin-left bg-gradient-to-r from-[#F5B82E] to-[#E6A51C] ${
                stepsInView ? 'lp-line-in' : ''
              }`}
            />
            <div
              className="lp-progress absolute -top-[1px] left-0 h-1 w-full origin-left rounded bg-[#173761]"
              style={{ transform: `scaleX(${doneCount / 3})` }}
            />
          </div>

          {steps.map((s, i) => {
            const Icon = s.icon
            const isDone = done[i]

            return (
              <Reveal key={s.title} delay={i * 120}>
                <button
                  type="button"
                  onClick={(e) => toggleStep(i, e)}
                  aria-pressed={isDone}
                  className="group relative flex w-full flex-col items-center rounded-2xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
                >
                  <div className="relative">
                    <span
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_14px_30px_-12px_rgba(23,55,97,0.6)] ring-8 ring-[#FAFAF7] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-3 group-active:scale-90 dark:ring-[#0B1525] ${
                        isDone ? 'bg-[#F5B82E] text-[#173761]' : 'bg-[#173761] text-[#F5B82E]'
                      }`}
                    >
                      {isDone ? <Check size={28} strokeWidth={2.4} /> : <Icon size={26} strokeWidth={1.8} />}
                    </span>
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#F5B82E] text-xs font-bold text-[#173761] ring-2 ring-[#FAFAF7] dark:ring-[#0B1525]">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className={`mt-6 text-lg font-bold transition ${isDone ? 'text-[#B78116] dark:text-[#F5B82E]' : ''}`}>
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-[16rem] text-sm leading-6 text-slate-600 dark:text-slate-400">{s.text}</p>
                </button>
              </Reveal>
            )
          })}
        </div>

        <p aria-live="polite" className="mt-10 text-center text-sm font-semibold text-[#173761]/70 dark:text-slate-300">
          {doneCount === 3 ? 'Handa ka na. Tara, simulan na!' : `Tap a step to check it off · ${doneCount}/3`}
        </p>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-[#E9E9E3] bg-white dark:border-[#2A3B51] dark:bg-[#111F33]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <Reveal>
            <div className="mb-10 max-w-xl">
              <Eyebrow>What you can do</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything starts with a plan.</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
                A simpler way to manage your academic workload and make progress one
                topic at a time.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal key={feature.number} delay={i * 100}>
                <FeatureCard feature={feature} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive learning path demo */}
      <section id="try" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal>
          <PathDemo />
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-[#EBDDB0] bg-gradient-to-br from-[#FFF8E3] to-[#FFFDF5] px-6 py-14 text-center sm:px-12 dark:border-[#75622E] dark:from-[#202B3B] dark:to-[#111F33]">
            <div aria-hidden="true" className="lp-drift pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#F5B82E]/30 blur-3xl" />
            <div aria-hidden="true" className="lp-drift2 pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[#7FA6D6]/25 blur-3xl" />
            <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 text-[#173761] opacity-[0.05] dark:text-slate-100" />

            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Start your plan today.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
                One topic, one session, one step at a time.
              </p>
              <a
                href="#about"
                onClick={handleGetStarted}
                className="lp-beam group relative mt-8 inline-flex rounded-[14px] p-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] focus-visible:ring-offset-2"
              >
                <span aria-hidden="true" className="lp-beam-ring" />
                <span className="lp-shine relative inline-flex items-center gap-3 rounded-xl bg-[#173761] px-7 py-3.5 text-sm font-semibold text-white transition group-hover:bg-[#244B7D]">
                  Get Started
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </span>
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}

export default LandingPage