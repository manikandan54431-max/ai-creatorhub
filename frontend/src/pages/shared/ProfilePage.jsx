import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import { User, Mail, Phone, Camera, Save, Shield, Star, ShoppingBag, Award } from 'lucide-react'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('profile')

  useEffect(() => {
    if (user) setForm({ name: user.name || '', email: user.email || '', phone: user.phone || '', bio: user.bio || '' })
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await authAPI.updateMe({ name: form.name, phone: form.phone, bio: form.bio })
      updateUser(r.data)
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const roleColors = { admin: ['var(--color-accent)', 'var(--color-accent-subtle)'], creator: ['var(--color-accent)', 'var(--color-accent-subtle)'], client: ['#059669', '#d1fae5'] }
  const [rColor, rBg] = roleColors[user?.role] || ['var(--color-accent)', 'var(--color-accent-subtle)']

  return (
    <div style={{ padding: '100px 24px 60px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `linear-gradient(135deg,${rColor},var(--color-primary))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '800', color: 'white' }}>
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>{user?.name}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>{user?.email}</div>
                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: `${rColor}15`, color: rColor, textTransform: 'capitalize' }}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {['profile', 'security'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '9px 20px', borderRadius: '10px',
                border: '1px solid var(--color-border)', cursor: 'pointer',
                background: tab === t ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                color: tab === t ? 'var(--color-primary-foreground)' : 'var(--color-text-secondary)', fontWeight: '600', fontSize: '13px',
                textTransform: 'capitalize', transition: 'all 0.2s',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none'
              }}>{tab === t ? (t === 'profile' ? '👤 Profile' : '🔒 Security') : (t === 'profile' ? '👤 Profile' : '🔒 Security')}</button>
            ))}
          </div>

          {tab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '24px' }}>Edit Profile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name</label>
                  <input className="form-input" style={{ width: '100%' }} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Your full name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
                  <input className="form-input" style={{ width: '100%', opacity: 0.6 }} value={form.email} disabled placeholder="Email cannot be changed" />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
                <input className="form-input" style={{ width: '100%' }} value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+91 98765 43210" />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Bio</label>
                <textarea className="form-input" style={{ width: '100%', minHeight: '90px', resize: 'vertical' }}
                  value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))} placeholder="Tell others about yourself..." />
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
                style={{ padding: '11px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </motion.button>
            </motion.div>
          )}

          {tab === 'security' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Security</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Manage your account security settings.</p>
              <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-subtle)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <Shield size={16} color="var(--color-accent)" />
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>Password</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Keep your account safe with a strong password.</p>
                <button style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--color-accent-subtle)',
                  background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  onClick={() => toast('Password change via email link — coming soon!')}>
                  Change Password
                </button>
              </div>
              <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <Award size={16} color="#059669" />
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>Account Status</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(5,150,105,0.12)', color: 'var(--color-success)', fontSize: '12px', fontWeight: '600' }}>
                  ✅ Active & Verified
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
