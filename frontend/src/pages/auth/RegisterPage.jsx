import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Sparkles, User, Mail, Lock, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: searchParams.get('role') || 'client',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all fields')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await authAPI.register(form)
      login(res.data.user, res.data.access_token)
      toast.success(`Welcome to AI CreatorHub, ${res.data.user.name}! 🎉`)
      if (res.data.user.role === 'creator') navigate('/creator/dashboard')
      else navigate('/client/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-background)',
      padding: '24px', paddingTop: '90px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'var(--color-surface)', borderRadius: '12px',
          border: '1px solid var(--color-border)',
          padding: '40px', width: '100%', maxWidth: '460px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'var(--color-primary)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Sparkles size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Join AI CreatorHub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Create your account and get started
          </p>
        </div>

        {/* Role Toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-secondary)',
          borderRadius: '12px', padding: '4px', marginBottom: '28px'
        }}>
          {['client', 'creator'].map(role => (
            <button
              key={role}
              onClick={() => setForm({ ...form, role })}
              style={{
                flex: 1, padding: '11px',
                background: form.role === role ? 'var(--bg-card)' : 'transparent',
                border: 'none', borderRadius: '10px',
                color: form.role === role ? 'var(--color-accent)' : 'var(--text-muted)',
                fontWeight: form.role === role ? '700' : '500',
                fontSize: '14px', cursor: 'pointer',
                boxShadow: form.role === role ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s', textTransform: 'capitalize'
              }}
            >
              {role === 'client' ? '🏢 I\'m a Client' : '🎨 I\'m a Creator'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input-base"
                  style={{ paddingLeft: '42px' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-base"
                  style={{ paddingLeft: '42px' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-base"
                  style={{ paddingLeft: '42px', paddingRight: '42px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-gradient"
            style={{
              width: '100%', padding: '15px',
              fontSize: '16px', fontWeight: '700',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {loading ? (
              <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <>Create Account <ArrowRight size={18} /></>
            )}
          </motion.button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: '600', textDecoration: 'none' }}>Sign In</Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          By creating an account, you agree to our{' '}
          <a href="#" style={{ color: 'var(--color-accent)' }}>Terms of Service</a>{' '}
          and <a href="#" style={{ color: 'var(--color-accent)' }}>Privacy Policy</a>
        </p>
      </motion.div>
      
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
