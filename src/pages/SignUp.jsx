import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E7E9E5] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(23,55,97,0.15)]">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#173761]">
            Create an account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Start planning your learning path today.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {success ? (
          <div className="mt-8 rounded-lg border border-[#EBDDB0] bg-[#FFF8E3] p-5 text-center">
            <h3 className="text-sm font-bold text-[#8A5F0B]">Check your email</h3>
            <p className="mt-2 text-sm text-[#8A5F0B]">
              We sent you a confirmation link. Please verify your email to log in.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-lg bg-[#173761] px-4 py-2 text-sm font-semibold text-white hover:bg-[#244B7D]"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="mt-8 space-y-5">
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-[#E7E9E5] py-2.5 pl-10 pr-3 text-slate-900 transition focus:border-[#F5B82E] focus:outline-none focus:ring-1 focus:ring-[#F5B82E]"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-[#173761] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#244B7D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B82E] disabled:opacity-70"
            >
              {loading ? 'Signing up...' : 'Sign up'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#173761] transition hover:text-[#244B7D] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}