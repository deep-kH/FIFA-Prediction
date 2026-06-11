'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Trophy, Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
        setMessage('You can proceed for Login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      const msg = err.message || 'Something went wrong'
      if (msg.includes('NOT_WHITELISTED') || msg.includes('not authorized')) {
        setError('You are not authorized to join this hub.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Invalid email or password.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-stripe login-bg-stripe-1" />
        <div className="login-bg-stripe login-bg-stripe-2" />
        <div className="login-bg-stripe login-bg-stripe-3" />
      </div>

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Trophy size={28} color="#0A0C10" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="login-title">BentoKick</h1>
            <p className="login-subtitle">FANTASY ENGINE</p>
          </div>
        </div>

        {/* Card */}
        <div className="login-card bento-card">
          <div className="login-card-header">
            <h2 className="login-card-title">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="login-card-desc">
              {isSignUp
                ? 'Sign up to join the competition.'
                : 'Sign in to manage your predictions.'}
            </p>
          </div>

          {/* Google OAuth */}
          {/* <button
            className="btn btn-ghost btn-lg google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            id="google-signin-btn"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.083 17.64 11.83 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button> */}

          <div className="login-divider">
            <div className="divider" style={{ margin: 0 }} />
            {/* <span className="login-divider-text">or</span> */}
            <div className="divider" style={{ margin: 0 }} />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleAuth} className="login-form">
            <div>
              <label className="form-label" htmlFor="email-input">Email Address</label>
              <div className="input-with-icon">
                <Mail size={15} className="input-icon" />
                <input
                  id="email-input"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="password-input">Password</label>
              <div className="input-with-icon">
                <Lock size={15} className="input-icon" />
                <input
                  id="password-input"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={8}
                />
              </div>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="login-success">
                <span>{message}</span>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 size={16} className="spinner-icon" /> Processing...</>
              ) : isSignUp ? (
                <><LogIn size={16} /> Create Account</>
              ) : (
                <><LogIn size={16} /> Sign In</>
              )}
            </button>
          </form>

          <p className="login-toggle">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              id="auth-toggle-btn"
              className="login-toggle-btn"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <p className="login-footer">
          🏆 FIFA World Cup 2026 · Private Circle Only
        </p>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-base);
          position: relative;
          overflow: hidden;
          padding: 24px;
        }
        .login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .login-bg-stripe {
          position: absolute;
          transform: skewX(-20deg);
          opacity: 0.8;
        }
        .login-bg-stripe-1 {
          width: 200vw; height: 300px;
          background: linear-gradient(90deg, transparent, var(--cup-blue), transparent);
          top: -150px; left: -50vw;
          opacity: 0.1;
        }
        .login-bg-stripe-2 {
          width: 200vw; height: 100px;
          background: linear-gradient(90deg, transparent, var(--cup-gold), transparent);
          top: 100px; left: -50vw;
          opacity: 0.15;
        }
        .login-bg-stripe-3 {
          width: 200vw; height: 400px;
          background: linear-gradient(90deg, transparent, var(--cup-red), transparent);
          bottom: -200px; left: -50vw;
          opacity: 0.08;
        }
        .login-container {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          position: relative;
          z-index: 1;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .login-logo-icon {
          width: 52px; height: 52px;
          background: var(--cup-gold);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--glow-gold);
        }
        .login-title {
          font-family: 'Bebas Neue', cursive;
          font-size: 32px;
          letter-spacing: 0.05em;
          color: var(--text-primary);
          line-height: 1;
        }
        .login-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
        }
        .login-card {
          width: 100%;
          padding: 28px;
        }
        .login-card-header { margin-bottom: 24px; text-align: center; }
        .login-card-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .login-card-desc { font-size: 14px; color: var(--text-secondary); }
        .google-btn { width: 100%; }
        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        .login-divider-text {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .input-with-icon { position: relative; }
        .input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(255,69,96,0.1);
          border: 1px solid rgba(255,69,96,0.3);
          border-radius: 10px;
          color: var(--cup-red);
          font-size: 13px;
        }
        .login-success {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(0,230,118,0.1);
          border: 1px solid rgba(0,230,118,0.3);
          border-radius: 10px;
          color: var(--cup-green);
          font-size: 13px;
        }
        .spinner-icon {
          animation: spin 0.7s linear infinite;
        }
        .login-toggle {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .login-toggle-btn {
          background: none;
          border: none;
          color: var(--cup-gold);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .login-footer {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  )
}
