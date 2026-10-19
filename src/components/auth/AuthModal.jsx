import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, X, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AuthModal({ isOpen, onClose, defaultView = 'login', darkMode }) {
  const navigate = useNavigate()
  const [view, setView] = useState(defaultView) // 'login', 'signup', 'forgot', 'verify-otp', or 'update-password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setView(defaultView)
      setEmail('')
      setPassword('')
      setOtp('')
      setShowPassword(false)
      setError(null)
      setSuccessMessage('')
    }
  }, [isOpen, defaultView])

  if (!isOpen) return null

  const switchView = (newView) => {
    setView(newView)
    setError(null)
    setSuccessMessage('')
    setPassword('')
    setOtp('')
    setShowPassword(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage('')

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
        navigate('/dashboard')
      } else if (view === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMessage('Please check your email for a confirmation link.')
      } else if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        // Switch to OTP view
        setView('verify-otp')
        setSuccessMessage('OTP sent! Please check your email for the 8-digit code.')
      } else if (view === 'verify-otp') {
        // Verify the 8-digit code
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'recovery'
        })
        if (error) throw error
        // If correct, move to password change view
        setSuccessMessage('')
        setView('update-password')
      } else if (view === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setSuccessMessage('Password updated successfully! Redirecting...')
        setTimeout(() => {
          onClose()
          navigate('/dashboard')
        }, 2000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const modalBg = darkMode ? 'bg-[#111F33] border-[#2A3B51]' : 'bg-white border-[#E7E9E5]'
  const titleColor = darkMode ? 'text-[#F1F5F9]' : 'text-[#173761]'
  const subtitleColor = darkMode ? 'text-[#94A3B8]' : 'text-slate-600'
  const labelColor = darkMode ? 'text-[#B6C2D2]' : 'text-slate-700'
  const inputBg = darkMode 
    ? 'bg-[#0B1525] border-[#2A3B51] text-white focus:border-[#F5B82E]' 
    : 'bg-white border-[#E7E9E5] text-slate-900 focus:border-[#F5B82E]'
  const iconColor = darkMode ? 'text-slate-500' : 'text-slate-400'
  const linkColor = darkMode ? 'text-[#F5B82E] hover:text-[#E6A51C]' : 'text-[#173761] hover:text-[#244B7D]'
  const closeBtnClass = darkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-[#173761]'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1525]/80 p-4 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] sm:p-8 ${modalBg}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          onClick={onClose}
          className={`absolute right-4 top-4 rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] ${closeBtnClass}`}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <h2 id="auth-modal-title" className={`text-2xl font-bold ${titleColor}`}>
            {view === 'login' && 'Welcome back'}
            {view === 'signup' && 'Create an account'}
            {view === 'forgot' && 'Reset password'}
            {view === 'verify-otp' && 'Enter OTP'}
            {view === 'update-password' && 'Set new password'}
          </h2>
          <p className={`mt-2 text-sm ${subtitleColor}`}>
            {view === 'login' && 'Sign in to continue planning your studies.'}
            {view === 'signup' && 'Start organizing your academic workload today.'}
            {view === 'forgot' && "Enter your email and we'll send you an OTP."}
            {view === 'verify-otp' && 'Enter the 8-digit code sent to your email.'}
            {view === 'update-password' && 'Please enter your new password below.'}
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50/10 border border-red-500/20 p-3 text-sm text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && view !== 'verify-otp' ? (
          <div className="mt-6 rounded-lg border border-[#EBDDB0] bg-[#FFF8E3] p-5 text-center">
            <h3 className="text-sm font-bold text-[#8A5F0B]">Message</h3>
            <p className="mt-2 text-sm text-[#8A5F0B]">{successMessage}</p>
            {view === 'signup' && (
              <button
                onClick={() => switchView('login')}
                className="mt-4 w-full rounded-lg bg-[#173761] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#244B7D]"
              >
                Go to login
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            
            {/* Success message shown inline for verify-otp */}
            {successMessage && view === 'verify-otp' && (
              <div className="rounded-lg border border-[#EBDDB0] bg-[#FFF8E3] p-3 text-sm text-[#8A5F0B] text-center mb-4">
                {successMessage}
              </div>
            )}

            {/* Email Field - Hidden on OTP and Update Password views */}
            {(view === 'login' || view === 'signup' || view === 'forgot') && (
              <div>
                <label htmlFor="email" className={`block text-sm font-medium ${labelColor}`}>
                  Email address
                </label>
                <div className="relative mt-1.5">
                  <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${iconColor}`}>
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 transition focus:outline-none focus:ring-1 ${inputBg}`}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            )}

            {/* OTP Field - Only shown on verify-otp */}
            {view === 'verify-otp' && (
              <div>
                <label htmlFor="otp" className={`block text-sm font-medium ${labelColor}`}>
                  8-digit Code
                </label>
                <div className="relative mt-1.5">
                  <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${iconColor}`}>
                    <KeyRound size={18} />
                  </div>
                  <input
                    id="otp"
                    type="text"
                    required
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 transition focus:outline-none focus:ring-1 tracking-widest font-mono text-center ${inputBg}`}
                    placeholder="00000000"
                  />
                </div>
              </div>
            )}

            {/* Password Field - Shown on login, signup, and update-password */}
            {(view === 'login' || view === 'signup' || view === 'update-password') && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={`block text-sm font-medium ${labelColor}`}>
                    {view === 'update-password' ? 'New Password' : 'Password'}
                  </label>
                  {view === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className={`text-xs font-semibold hover:underline focus:outline-none ${linkColor}`}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${iconColor}`}>
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={view === 'signup' || view === 'update-password' ? 6 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`block w-full rounded-lg border py-2.5 pl-10 pr-10 transition focus:outline-none focus:ring-1 ${inputBg}`}
                    placeholder={view === 'signup' || view === 'update-password' ? 'At least 6 characters' : '••••••••'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute inset-y-0 right-0 flex items-center pr-3 transition-colors hover:text-[#173761] dark:hover:text-white focus:outline-none ${iconColor}`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full justify-center rounded-lg bg-[#173761] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-70"
            >
              {loading
                ? 'Processing...'
                : view === 'login'
                ? 'Sign in'
                : view === 'signup'
                ? 'Sign up'
                : view === 'verify-otp'
                ? 'Verify Code'
                : view === 'update-password'
                ? 'Update password'
                : 'Send OTP'}
            </button>
          </form>
        )}

        <div className={`mt-6 text-center text-sm ${subtitleColor}`}>
          {view === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => switchView('signup')}
                className={`font-semibold hover:underline focus:outline-none ${linkColor}`}
              >
                Sign up
              </button>
            </p>
          ) : view === 'signup' ? (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => switchView('login')}
                className={`font-semibold hover:underline focus:outline-none ${linkColor}`}
              >
                Sign in
              </button>
            </p>
          ) : (view === 'forgot' || view === 'verify-otp' || view === 'update-password') ? (
            <button
              onClick={() => switchView('login')}
              className={`inline-flex items-center gap-1 font-semibold hover:underline focus:outline-none ${linkColor}`}
            >
              <ArrowLeft size={14} /> Back to login
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}