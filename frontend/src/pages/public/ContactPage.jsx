import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Send, CheckCircle, AlertCircle, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import Footer from '../../components/layout/Footer'

const CATEGORIES = [
  'Account and Login',
  'Creator Onboarding',
  'Orders and Assignments',
  'Video Uploads',
  'Admin Review',
  'Revisions',
  'Payments',
  'Technical Issues',
  'Other',
]

const SUPPORT_EMAIL = 'manikandan54431@gmail.com'
const SUPPORT_PHONE = '+91 6380994709'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', category: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState(null)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/api/support/tickets', form)
      setTicketId(res.data.id)
      setSubmitted(true)
      toast.success('Support request received!')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit. Please try again or email us directly.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '64px 24px 48px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
          <h1 style={{ color: 'white', marginBottom: 12 }}>Contact Us</h1>
          <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto' }}>
            Have a question or need help? Fill out the form below or reach us directly.
          </p>
        </motion.div>
      </section>

      <section style={{ padding: '56px 24px', flex: 1 }}>
        <div className="container-custom" style={{ maxWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
            {/* Contact info */}
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 24 }}>Get in Touch</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, background: 'var(--ms-blue-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Phone size={18} color="var(--ms-blue)" />
                    </div>
                    <span style={{ fontWeight: 600 }}>Phone</span>
                  </div>
                  <a
                    href={`tel:+916380994709`}
                    style={{ color: 'var(--ms-blue)', fontWeight: 600, fontSize: 16, textDecoration: 'none' }}
                  >
                    {SUPPORT_PHONE}
                  </a>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Click to call
                  </p>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, background: 'var(--ms-blue-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={18} color="var(--ms-blue)" />
                    </div>
                    <span style={{ fontWeight: 600 }}>Email</span>
                  </div>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    style={{ color: 'var(--ms-blue)', fontWeight: 600, fontSize: 15, textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Click to email
                  </p>
                </div>

                <div style={{
                  padding: 16,
                  background: 'var(--info-light)',
                  border: '1px solid var(--ms-blue)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>No guaranteed response time</strong><br />
                  We will respond as quickly as possible. For urgent platform issues, please include your order ID or account email.
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card"
                  style={{ padding: 32, textAlign: 'center' }}
                >
                  <CheckCircle size={48} color="var(--success)" style={{ marginBottom: 16 }} />
                  <h3 style={{ marginBottom: 12 }}>Request Received</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                    Your support request (Ticket #{ticketId}) has been saved in our system.
                    We will get back to you as soon as possible.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    You can also reach us at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--ms-blue)' }}>{SUPPORT_EMAIL}</a>
                    {' '}or{' '}
                    <a href={`tel:+916380994709`} style={{ color: 'var(--ms-blue)' }}>{SUPPORT_PHONE}</a>.
                  </p>
                  <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '', category: '' }) }}>
                    Send Another Message
                  </button>
                </motion.div>
              ) : (
                <div className="card" style={{ padding: 28 }}>
                  <h3 style={{ marginBottom: 20 }}>Send a Message</h3>

                  {error && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                      <AlertCircle size={16} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Name *</label>
                      <input className="input-base" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Email *</label>
                      <input className="input-base" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Category</label>
                      <select className="input-base" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="">Select a category...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Subject *</label>
                      <input className="input-base" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject of your message" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Message *</label>
                      <textarea className="input-base" required rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your issue or question in detail..." style={{ resize: 'vertical' }} />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Send size={15} />
                      {submitting ? 'Sending...' : 'Submit Request'}
                    </button>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Your message is saved in our system. We will respond as soon as possible.
                    </p>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
