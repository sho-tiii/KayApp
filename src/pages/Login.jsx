import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E7E9E5] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(23,55,97,0.15)]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#173761]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue planning your studies.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-[#E7E9E5] py-2.5 pl-10 pr-3 text-slate-900 transition focus:border-[#F5B82E] focus:outline-none focus:ring-1 focus:ring-[#F5B82E]"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-[#E7E9E5] py-2.5 pl-10 pr-3 text-slate-900 transition focus:border-[#F5B82E] focus:outline-none focus:ring-1 focus:ring-[#F5B82E]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-[#173761] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-[#173761] transition hover:text-[#244B7D] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}