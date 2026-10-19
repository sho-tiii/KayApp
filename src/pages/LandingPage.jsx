import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
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
  {
    icon: CalendarDays,
    title: 'Study Planner',
    description: 'Organize your study sessions, tasks, and deadlines in one place.',
    number: '01',
  },
  {
    icon: BookOpen,
    title: 'Subject Tracker',
    description: 'Keep track of your subjects, topics, and learning progress.',
    number: '02',
  },
  {
    icon: GitBranch,
    title: 'Learning Paths',
    description: 'Discover which topics to study first based on their prerequisites.',
    number: '03',
  },
]

const steps = [
  {
    icon: BookOpen,
    title: 'Add your subjects',
    text: "List what you're studying this term.",
  },
  {
    icon: CalendarDays,
    title: 'Plan your sessions',
    text: 'Set tasks and deadlines that fit your week.',
  },
  {
    icon: GitBranch,
    title: 'Follow your path',
    text: 'See what to study next, one topic at a time.',
  },
]

const rotatingWords = ['manageable', 'organized', 'doable']

const subjects = [
  'Mathematics',
  'Biology',
  'History',
  'Programming',
  'Chemistry',
  'Literature',
  'Physics',
  'Economics',
  'Psychology',
  'Languages',
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
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
    >
      <div
        ref={barRef}
        className="h-full origin-left bg-gradient-to-r from-[#F5B82E] to-[#E6A51C]"
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
          className={`lp-word shimmer-text col-start-1 row-start-1 ${
            i === index ? 'lp-word-in' : ''
          }`}
        >
          {word}.
        </span>
      ))}
    </span>
  )
}

/** Feature card with a gold glow that follows the cursor. */
function FeatureCard({ feature }) {
  const Icon = feature.icon

  const handleMove = (e) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--fx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--fy', `${e.clientY - rect.top}px`)
  }

  return (
    <article
      onMouseMove={handleMove}
      className="group relative h-full overflow-hidden rounded-xl border border-[#E7E9E5] bg-[#FAFAF7] p-6 transition duration-300 hover:-translate-y-1.5 hover:border-[#D6B75E] hover:bg-white hover:shadow-[0_20px_40px_-20px_rgba(23,55,97,0.3)]"
    >
      <div
        aria-hidden="true"
        className="lp-card-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAF0F7] text-[#173761] transition duration-300 group-hover:rotate-6 group-hover:bg-[#173761] group-hover:text-[#F5B82E]">
            <Icon size={21} strokeWidth={1.8} />
          </div>
          <span className="text-xs font-semibold text-slate-400 transition group-hover:text-[#B78116]">
            {feature.number}
          </span>
        </div>

        <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {feature.description}
        </p>
      </div>
    </article>
  )
}

/** Endless strip of subjects. Pauses on hover. */
function SubjectMarquee() {
  const group = (hidden) => (
    <ul
      className="flex shrink-0 items-center gap-10 pr-10"
      aria-hidden={hidden || undefined}
    >
      {subjects.map((s) => (
        <li
          key={s}
          className="flex items-center gap-10 whitespace-nowrap text-sm font-semibold text-[#173761]/70"
        >
          {s}
          <Sparkles size={14} className="text-[#E6A51C]" />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="border-y border-[#E9E9E3] bg-white py-5">
      <p className="mb-4 text-center text-xs font-bold uppercase tracking-[2px] text-slate-400">
        Plan any subject
      </p>

      <div className="lp-marquee-wrap overflow-hidden">
        <div className="lp-marquee">
          {group(false)}
          {group(true)}
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
  const [stepsRef, stepsInView] = useInView(0.35)

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

        /* Hero depth: tilt the planner, counter-move the floating chip */
        .lp-tilt {
          transform: perspective(1100px) rotateY(calc(var(--nx, 0) * 7deg)) rotateX(calc(var(--ny, 0) * -7deg));
          transition: transform .25s ease-out;
          will-change: transform;
        }
        .lp-counter {
          transform: translate3d(calc(var(--nx, 0) * -28px), calc(var(--ny, 0) * -28px), 0);
          transition: transform .25s ease-out;
        }
        @keyframes lpFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        .lp-float { animation: lpFloat 7s ease-in-out infinite; }

        /* Rotating headline word */
        .lp-word { opacity: 0; transform: translateY(0.45em); transition: opacity .5s ease, transform .5s ease; }
        .lp-word-in { opacity: 1; transform: none; }

        /* Button shine */
        .lp-shine { position: relative; overflow: hidden; }
        .lp-shine::after {
          content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
          transform: skewX(-20deg); transition: left .7s ease; pointer-events: none;
        }
        .lp-shine:hover::after { left: 130%; }

        /* Marquee */
        @keyframes lpMarquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .lp-marquee { display: flex; width: max-content; animation: lpMarquee 40s linear infinite; }
        .lp-marquee-wrap {
          -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
          mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
        }
        .lp-marquee-wrap:hover .lp-marquee { animation-play-state: paused; }

        /* Steps connector draws itself */
        .lp-line { transform: scaleX(0); transition: transform 1.6s cubic-bezier(.22,1,.36,1) .3s; }
        .lp-line-in { transform: scaleX(1); }

        /* Feature card cursor glow */
        .lp-card-glow {
          background: radial-gradient(260px circle at var(--fx, 50%) var(--fy, 0%), rgba(245,184,46,.2), transparent 70%);
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-drift, .lp-drift2, .lp-float, .lp-marquee { animation: none; }
          .lp-tilt, .lp-counter { transform: none; transition: none; }
          .lp-word { transition: none; }
          .lp-line { transform: scaleX(1); transition: none; }
          .lp-shine::after { display: none; }
        }
      `}</style>

      <ScrollProgress />

      {/* Hero */}
      <section
        id="about"
        ref={heroRef}
        onMouseMove={handleHeroMove}
        onMouseLeave={handleHeroLeave}
        className="relative overflow-hidden"
      >
        {/* Aurora blobs */}
        <div
          aria-hidden="true"
          className="lp-fade pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="lp-drift absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#F5B82E]/25 blur-3xl" />
          <div className="lp-drift2 absolute -top-10 right-0 h-96 w-96 rounded-full bg-[#7FA6D6]/25 blur-3xl" />
          <div className="lp-drift absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#173761]/10 blur-3xl" />
        </div>

        <div
          aria-hidden="true"
          className="spotlight fade-bottom pointer-events-none absolute inset-0"
        />

        <div
          aria-hidden="true"
          className="dot-grid fade-bottom pointer-events-none absolute inset-0 text-[#173761] opacity-[0.05]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#EBDDB0] bg-[#FFF8E3] px-3 py-1.5 text-xs font-bold uppercase tracking-[2px] text-[#B78116]">
                <Sparkles size={13} />
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
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
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
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </a>

                <a
                  href="#features"
                  className="rounded-lg px-4 py-3.5 text-sm font-semibold text-[#173761] transition hover:bg-[#173761]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173761]"
                >
                  Explore features
                </a>
              </div>

              <p className="mt-5 inline-flex items-center gap-2 text-sm text-slate-500">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[#F5B82E]"
                />
                Kaya mo ’yan. May plano ka na.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200} className="lg:pl-4">
            <div className="relative">
              {/* Floating chip (moves opposite to the tilt for depth) */}
              <div
                aria-hidden="true"
                className="lp-counter pointer-events-none absolute -top-10 left-2 z-10 hidden sm:block"
              >
                <div className="lp-float flex items-center gap-2 rounded-xl border border-[#E7E9E5] bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF4D6] text-[#B78116]">
                    <BookOpen size={14} />
                  </span>
                  <div>
                    <p className="text-[11px] leading-none text-slate-400">Biology</p>
                    <p className="mt-1 text-xs font-bold leading-none text-[#173761]">
                      3 topics left
                    </p>
                  </div>
                </div>
              </div>

              <div className="lp-tilt">
                <PlannerMock />
              </div>
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
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Three simple steps.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              From a messy to-do list to a clear plan, in minutes.
            </p>
          </div>
        </Reveal>

        <div
          ref={stepsRef}
          className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-6"
        >
          <div
            aria-hidden="true"
            className="absolute left-[17%] right-[17%] top-8 hidden md:block"
          >
            <div className="border-t-2 border-dashed border-[#DCC580]" />
            <div
              className={`lp-line absolute left-0 top-0 h-[2px] w-full origin-left bg-gradient-to-r from-[#F5B82E] to-[#E6A51C] ${
                stepsInView ? 'lp-line-in' : ''
              }`}
            />
          </div>

          {steps.map((s, i) => {
            const Icon = s.icon

            return (
              <Reveal key={s.title} delay={i * 120}>
                <div className="group relative flex flex-col items-center text-center">
                  <div className="relative">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173761] text-[#F5B82E] shadow-[0_14px_30px_-12px_rgba(23,55,97,0.6)] ring-8 ring-[#FAFAF7] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-3">
                      <Icon size={26} strokeWidth={1.8} />
                    </span>
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#F5B82E] text-xs font-bold text-[#173761] ring-2 ring-[#FAFAF7]">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 max-w-[16rem] text-sm leading-6 text-slate-600">
                    {s.text}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-[#E9E9E3] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <Reveal>
            <div className="mb-10 max-w-xl">
              <Eyebrow>What you can do</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything starts with a plan.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
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
          <div className="relative overflow-hidden rounded-3xl border border-[#EBDDB0] bg-gradient-to-br from-[#FFF8E3] to-[#FFFDF5] px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="lp-drift pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#F5B82E]/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="lp-drift2 pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[#7FA6D6]/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="dot-grid pointer-events-none absolute inset-0 text-[#173761] opacity-[0.05]"
            />

            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                Start your plan today.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
                One topic, one session, one step at a time.
              </p>
              <a
                href="#about"
                className="lp-shine group mt-8 inline-flex items-center gap-3 rounded-lg bg-[#173761] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(23,55,97,0.7)] transition hover:-translate-y-0.5 hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
              >
                Get Started
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}

export default LandingPage