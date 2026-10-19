import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun } from 'lucide-react'
import kayappLogo from '../../assets/KAYAPP.png'

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#try', label: 'Try it' },
  { href: '#about', label: 'About' },
]

function Navbar({ darkMode, onToggleTheme, onOpenAuth }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeLink, setActiveLink] = useState('')
  const location = useLocation()

  const isLandingPage = location.pathname === '/'

  const linkClass = darkMode
    ? 'text-slate-300 hover:text-[#F5B82E]'
    : 'text-slate-600 hover:text-[#173761]'

  const themeControl = (
    <button
      type="button"
      onClick={onToggleTheme}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Light mode" : "Dark mode"}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
        darkMode
          ? 'text-slate-300 hover:bg-white/10 hover:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-[#173761]'
      }`}
    >
      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur transition-colors duration-300 ${
        darkMode
          ? 'border-white/10 bg-[#101D30]/95'
          : 'border-[#E9E9E3] bg-white/90'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            aria-label="KayApp home"
            onClick={() => setActiveLink('')}
            className="flex shrink-0 items-center"
          >
            <img
              src={kayappLogo}
              alt="KayApp"
              className="-ml-2 h-16 w-32 object-contain object-left"
            />
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {isLandingPage && navLinks.map((link) => {
            const isActive = activeLink === link.href

            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setActiveLink(link.href)}
                className={`group relative py-1 text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? darkMode
                      ? 'text-[#F5B82E]'
                      : 'text-[#173761]'
                    : linkClass
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-1/2 h-0.5 w-full -translate-x-1/2 rounded-full transition-all duration-300 ${
                    isActive
                      ? darkMode
                        ? 'bg-[#F5B82E] opacity-100'
                        : 'bg-[#173761] opacity-100'
                      : 'bg-transparent opacity-0 group-hover:bg-slate-300 group-hover:opacity-50'
                  }`}
                />
              </a>
            )
          })}
        </div>

        <div className="hidden flex-1 items-center justify-end gap-5 md:flex">
          {themeControl}

          <button
            onClick={() => onOpenAuth('login')}
            className={`text-sm font-semibold focus:outline-none transition-colors duration-200 ${linkClass}`}
          >
            Log in
          </button>

          <button
            onClick={() => onOpenAuth('signup')}
            className="rounded-lg bg-[#173761] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#244B7D] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E]"
          >
            Sign up
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 md:hidden">
          {themeControl}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${
              darkMode
                ? 'text-white hover:bg-white/10'
                : 'text-[#173761] hover:bg-slate-100'
            }`}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className={`space-y-1 border-t p-4 md:hidden ${
            darkMode
              ? 'border-white/10 bg-[#101D30]'
              : 'border-slate-100 bg-white'
          }`}
        >
          {isLandingPage && navLinks.map((link) => {
            const isActive = activeLink === link.href

            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => {
                  setActiveLink(link.href)
                  setMenuOpen(false)
                }}
                className={`block rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? darkMode
                      ? 'bg-white/10 text-[#F5B82E]'
                      : 'bg-slate-100 text-[#173761]'
                    : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'} ${linkClass}`
                }`}
              >
                {link.label}
              </a>
            )
          })}

          <div className="my-2 border-t border-slate-200 dark:border-white/10"></div>

          <button
            onClick={() => {
              setMenuOpen(false)
              onOpenAuth('login')
            }}
            className={`block w-full text-left rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
              darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
            } ${linkClass}`}
          >
            Log in
          </button>

          <button
            onClick={() => {
              setMenuOpen(false)
              onOpenAuth('signup')
            }}
            className="block w-full rounded-lg bg-[#173761] px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#244B7D]"
          >
            Sign up
          </button>
        </div>
      )}
    </header>
  )
}

export default Navbar