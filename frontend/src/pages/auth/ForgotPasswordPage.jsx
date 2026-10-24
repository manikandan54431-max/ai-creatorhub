import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft, Lock, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return toast.error('Please enter your email')
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px',
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✨</div>
            <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>AI CreatorHub</span>
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '36px' }}>
          {!sent ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--color-accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Lock size={24} color="var(--color-accent)" />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Forgot Password?
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                  Enter the email address associated with your account and we will send you a password reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '7px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" style={{ width: '100%', paddingLeft: '38px' }}
                      type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>

                <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: loading ? 'var(--color-accent-hover)' : 'var(--color-accent)',
                    color: 'white', fontWeight: '700', fontSize: '15px', opacity: loading ? 0.8 : 1,
                    fontFamily: 'inherit', transition: 'all 0.2s' }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </motion.button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-success-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={28} color="var(--color-success)" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>
                Check your inbox!
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                We sent a password reset link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                Check your email and follow the instructions.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Didn't receive the email?{' '}
                <button onClick={() => setSent(false)} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  Try again
                </button>
              </p>
            </motion.div>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent)', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}