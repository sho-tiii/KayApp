import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import AuthModal from './components/auth/AuthModal'
import { supabase } from './lib/supabase'
import AdminDashboard from './pages/AdminDashboard'

function getSavedTheme() {
  try {
    return localStorage.getItem('kayapp-theme') === 'dark'
  } catch {
    return false
  }
}

function App() {
  const [darkMode, setDarkMode] = useState(getSavedTheme)
  const [authModal, setAuthModal] = useState({ isOpen: false, view: 'login' })
  const [session, setSession] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    // 1. Get the session when the app first loads
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsAuthLoading(false)
    })

    // 2. Listen for login, logout, and password recovery events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setIsAuthLoading(false)
      
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModal({ isOpen: true, view: 'update-password' })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const toggleTheme = () => {
    setDarkMode((current) => {
      const next = !current
      try {
        localStorage.setItem('kayapp-theme', next ? 'dark' : 'light')
      } catch {
        // Safe to ignore
      }
      return next
    })
  }

  const openAuthModal = (view) => {
    setAuthModal({ isOpen: true, view })
  }

  const closeAuthModal = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }))
  }

  return (
    <Router>
      <div
        className={`kayapp-theme min-h-screen scroll-smooth transition-colors duration-300 ${
          darkMode
            ? 'dark-theme bg-[#0B1525] text-slate-100'
            : 'bg-[#FAFAF7] text-[#173761]'
        }`}
      >
        <style>{`
          html { scroll-behavior: smooth; }
          section[id] { scroll-margin-top: 80px; }
          .kayapp-theme { min-height: 100vh; }
          .reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
          .reveal-in { opacity: 1; transform: none; }
          @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          .float-slow { animation: floaty 6s ease-in-out infinite; }
          .float-slower { animation: floaty 8s ease-in-out infinite reverse; }
          @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
          .shake { animation: shake .4s ease; }
          @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(245,184,46,.55); } 70% { box-shadow: 0 0 0 10px rgba(245,184,46,0); } 100% { box-shadow: 0 0 0 0 rgba(245,184,46,0); } }
          .pulse-ring { animation: pulseRing 2s infinite; }
          @keyframes fall { 0% { transform: translateY(-20px) rotate(0); opacity: 1; } 100% { transform: translateY(520px) rotate(540deg); opacity: 0; } }
          .confetti { position: absolute; top: 0; width: 8px; height: 14px; border-radius: 2px; animation: fall 2.2s ease-in forwards; }
          @keyframes shimmer { to { background-position: 200% center; } }
          .shimmer-text { background: linear-gradient(90deg, #E6A51C 0%, #F9D56E 30%, #E6A51C 60%, #F9D56E 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; animation: shimmer 5s linear infinite; }
          .dot-grid { background-image: radial-gradient(currentColor 1px, transparent 1px); background-size: 22px 22px; }
          .fade-bottom { -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); }
          .spotlight { background: radial-gradient(420px circle at var(--mx, 70%) var(--my, 20%), rgba(245,184,46,.16), transparent 60%); }
          .dark-theme { color: #F1F5F9; background-color: #0B1525; }
          .dark-theme [class~="bg-[#FAFAF7]"], .dark-theme [class~="bg-white"] { background-color: #111F33 !important; }
          .dark-theme [class~="bg-white/90"] { background-color: rgba(16, 29, 48, .95) !important; }
          .dark-theme [class~="bg-[#FFF8E3]"], .dark-theme [class~="bg-[#FFFDF5]"] { background-color: #202B3B !important; }
          .dark-theme [class~="bg-gradient-to-br"] { background-image: linear-gradient(to bottom right, #18283E, #111F33) !important; }
          .dark-theme [class~="ring-[#FAFAF7]"] { --tw-ring-color: #0B1525 !important; }
          .dark-theme [class~="bg-[#EAF0F7]"] { background-color: #172840 !important; }
          .dark-theme article { background-color: #111F33; border-color: #2A3B51; }
          .dark-theme article:hover { background-color: #172840; border-color: #D6B75E; }
          .dark-theme [class~="border-[#E9E9E3]"], .dark-theme [class~="border-[#E7E9E5]"], .dark-theme [class~="border-slate-100"] { border-color: #29384C !important; }
          .dark-theme [class~="border-[#EBDDB0]"] { border-color: #75622E !important; }
          .dark-theme [class~="text-[#173761]"] { color: #F1F5F9 !important; }
          .dark-theme [class~="text-slate-600"], .dark-theme [class~="text-slate-500"] { color: #B6C2D2 !important; }
          .dark-theme [class~="text-slate-400"] { color: #94A3B8 !important; }
          .dark-theme [class~="text-[#B78116]"] { color: #F5C95E !important; }
          .dark-theme a[class~="text-white"], .dark-theme button[class~="text-white"] { color: #FFFFFF !important; }
          .dark-theme .dot-grid { background-image: radial-gradient(currentColor 1px, transparent 1px); }
          .dark-theme .spotlight { background: radial-gradient(420px circle at var(--mx, 70%) var(--my, 20%), rgba(245,184,46,.12), transparent 60%); }
          @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .reveal { opacity: 1; transform: none; transition: none; } .float-slow, .float-slower, .pulse-ring, .shimmer-text, .confetti, .shake { animation: none; } .kayapp-theme { transition: none; } }
        `}</style>

        <AuthModal
          isOpen={authModal.isOpen}
          onClose={closeAuthModal}
          defaultView={authModal.view}
          darkMode={darkMode}
        />

        <Routes>
          {/* Public Landing Page */}
          <Route
            path="/"
            element={
              <>
                <Navbar
                  darkMode={darkMode}
                  onToggleTheme={toggleTheme}
                  onOpenAuth={openAuthModal}
                />
                <LandingPage />
                <Footer />
              </>
            }
          />
          
          {/* Protected Dashboard Route */}
          <Route
            path="/dashboard"
            element={
              isAuthLoading ? (
                <div className="flex min-h-screen items-center justify-center">
                  <p className="text-lg font-bold text-[#173761] dark:text-white">Loading...</p>
                </div>
              ) : session ? (
                <Dashboard 
                  session={session} 
                  darkMode={darkMode} 
                  onToggleTheme={toggleTheme} 
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* Protected Admin Route */}
          <Route
            path="/admin"
            element={
              isAuthLoading ? (
                <div className="flex min-h-screen items-center justify-center">
                  <p className="text-lg font-bold">Loading Admin...</p>
                </div>
              ) : session ? (
                <AdminDashboard session={session} darkMode={darkMode} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App