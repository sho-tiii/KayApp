import { ArrowRight } from 'lucide-react'

const exploreLinks = [
  { href: '#about', label: 'About' },
  { href: '#features', label: 'Features' },
  { href: '#try', label: 'Try the demo' },
]

const productLinks = [
  { href: '#features', label: 'Study Planner' },
  { href: '#features', label: 'Subject Tracker' },
  { href: '#features', label: 'Learning Paths' },
]

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#173761] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#F5B82E]/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="h-1 w-full bg-gradient-to-r from-[#F5B82E] via-[#E6A51C] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <a href="#" className="text-2xl font-bold tracking-tight">
              Kay<span className="text-[#F5B82E]">App</span>
            </a>

            <p className="mt-3 max-w-xs text-sm leading-6 text-white/65">
              Smart Student Planner &amp; Learning Path. Plan your sessions,
              track your subjects, and always know what to study next.
            </p>

            <p className="mt-5 inline-block rounded-full border border-[#F5B82E]/40 bg-[#F5B82E]/10 px-4 py-1.5 text-sm font-semibold text-[#F5B82E]">
              Kaya mo ’yan. May plano ka na.
            </p>
          </div>

          <nav aria-label="Explore">
            <p className="text-xs font-bold uppercase tracking-[2px] text-white/45">
              Explore
            </p>

            <ul className="mt-4 space-y-3 text-sm">
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/75 transition hover:text-[#F5B82E]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Product">
            <p className="text-xs font-bold uppercase tracking-[2px] text-white/45">
              Product
            </p>

            <ul className="mt-4 space-y-3 text-sm">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/75 transition hover:text-[#F5B82E]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} KayApp. All rights reserved.
          </p>

          <a
            href="#"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 transition hover:text-[#F5B82E]"
          >
            Back to top
            <ArrowRight size={14} className="-rotate-90" />
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
