import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Clock, CheckCircle, Plus, Send, ChevronRight, Phone, Mail, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store'
import api from '../../services/api'
import Footer from '../../components/layout/Footer'

const SUPPORT_EMAIL = 'manikandan54431@gmail.com'
const SUPPORT_PHONE = '+91 6380994709'

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

const STATUS_STYLES = {
  open: { label: 'Open', cls: 'badge-info' },
  in_progress: { label: 'In Progress', cls: 'badge-warning' },
  waiting_for_user: { label: 'Waiting for You', cls: 'badge-purple' },
  resolved: { label: 'Resolved', cls: 'badge-success' },
}

export default function SupportPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [activeTicket, setActiveTicket] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: user?.name || '', email: user?.email || '', subject: '', message: '', category: '' })
  const [submitting, setSubmitting] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) loadMyTickets()
  }, [])

  async function loadMyTickets() {
    setLoadingTickets(true)
    try {
      const res = await api.get('/api/support/tickets/my')
      setTickets(res.data)
    } catch (e) {} finally {
      setLoadingTickets(false)
    }
  }

  async function handleNewTicket(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const endpoint = isAuthenticated() ? '/api/support/tickets/authenticated' : '/api/support/tickets'
      const res = await api.post(endpoint, newForm)
      toast.success('Support ticket created!')
      setShowNewForm(false)
      setNewForm({ name: user?.name || '', email: user?.email || '', subject: '', message: '', category: '' })
      if (isAuthenticated()) {
        await loadMyTickets()
        setActiveTicket(res.data.id)
        setTimeout(() => loadMyTickets(), 500)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply(ticketId) {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      await api.post(`/api/support/tickets/my/${ticketId}/reply`, { message: replyText })
      toast.success('Reply sent')
      setReplyText('')
      await loadMyTickets()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply')
    } finally {
      setReplying(false)
    }
  }

  const selectedTicket = tickets.find(t => t.id === activeTicket)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '64px 24px 48px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎫</div>
          <h1 style={{ color: 'white', marginBottom: 12 }}>Support Center</h1>
          <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto' }}>
            Create a support ticket, track your existing requests, or reach us directly.
          </p>
        </motion.div>
      </section>

      <section style={{ padding: '40px 24px', flex: 1 }}>
        <div className="container-custom" style={{ maxWidth: 960 }}>
          {/* Direct contact strip */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 12, padding: 16, marginBottom: 28, alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 8 }}>Direct Contact:</span>
            <a href="tel:+916380994709" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ms-blue)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Phone size={14} />{SUPPORT_PHONE}
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ms-blue)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <Mail size={14} />{SUPPORT_EMAIL}
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isAuthenticated() ? '280px 1fr' : '1fr', gap: 24 }}>
            {/* Sidebar — ticket list */}
            {isAuthenticated() && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, margin: 0 }}>My Tickets</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={13} />New
                  </button>
                </div>

                {loadingTickets ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 70 }} />)}
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <div className="empty-state-icon" style={{ fontSize: 32 }}>🎫</div>
                    <p style={{ fontSize: 13 }}>No tickets yet</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(true)} style={{ marginTop: 12 }}>
                      Create First Ticket
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tickets.map(t => {
                      const s = STATUS_STYLES[t.status] || { label: t.status, cls: 'badge-neutral' }
                      return (
                        <div
                          key={t.id}
                          onClick={() => { setActiveTicket(t.id); setShowNewForm(false) }}
                          style={{
                            padding: '12px 14px',
                            border: `1px solid ${activeTicket === t.id ? 'var(--ms-blue)' : 'var(--border-color)'}`,
                            background: activeTicket === t.id ? 'var(--ms-blue-light)' : 'var(--bg-card)',
                            borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>#{t.id}</span>
                            <span className={`badge ${s.cls}`} style={{ fontSize: 10 }}>{s.label}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.subject}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Main area */}
            <div>
              {showNewForm ? (
                <NewTicketForm
                  form={newForm}
                  setForm={setNewForm}
                  onSubmit={handleNewTicket}
                  submitting={submitting}
                  onCancel={() => setShowNewForm(false)}
                  isAuthenticated={isAuthenticated()}
                />
              ) : selectedTicket ? (
                <TicketDetail ticket={selectedTicket} replyText={replyText} setReplyText={setReplyText} onReply={handleReply} replying={replying} />
              ) : (
                <div>
                  {!isAuthenticated() ? (
                    <NewTicketForm
                      form={newForm} setForm={setNewForm}
                      onSubmit={handleNewTicket} submitting={submitting}
                      onCancel={null} isAuthenticated={false}
                    />
                  ) : (
                    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                      <div className="empty-state-icon">📋</div>
                      <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Select a ticket or create a new one</h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Choose a ticket from the list, or click "New" to create a support request.
                      </p>
                      <button className="btn btn-primary" onClick={() => setShowNewForm(true)}>
                        Create New Ticket
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Categories overview */}
          <div style={{ marginTop: 48 }}>
            <h3 style={{ marginBottom: 20 }}>Support Categories</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {CATEGORIES.map(cat => (
                <div key={cat} style={{
                  padding: '12px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ms-blue)', flexShrink: 0 }} />
                  {cat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}

function NewTicketForm({ form, setForm, onSubmit, submitting, onCancel, isAuthenticated }) {
  return (
    <div className="card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>New Support Ticket</h3>
        {onCancel && <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>}
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!isAuthenticated && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Name *</label>
              <input className="input-base" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Email *</label>
              <input className="input-base" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" />
            </div>
          </>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Category</label>
          <select className="input-base" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">Select a category...</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Subject *</label>
          <input className="input-base" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>Message *</label>
          <textarea className="input-base" required rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your issue in detail..." style={{ resize: 'vertical' }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Send size={14} />
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  )
}

function TicketDetail({ ticket: t, replyText, setReplyText, onReply, replying }) {
  const s = STATUS_STYLES[t.status] || { label: t.status, cls: 'badge-neutral' }
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ticket #{t.id}</div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{t.subject}</h3>
          {t.category && <span className="badge badge-info" style={{ marginTop: 6, fontSize: 11 }}>{t.category}</span>}
        </div>
        <span className={`badge ${s.cls}`}>{s.label}</span>
      </div>

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {/* Original message */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            You · {new Date(t.created_at).toLocaleString()}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{t.message}</p>
        </div>

        {/* Replies */}
        {(t.replies || []).map(r => (
          <div key={r.id} style={{
            background: r.is_admin_reply ? 'var(--ms-blue-light)' : 'var(--bg-primary)',
            border: `1px solid ${r.is_admin_reply ? 'var(--ms-blue)' : 'var(--border-color)'}`,
            borderRadius: 10, padding: 16,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              {r.is_admin_reply ? '🛡️ Support Team' : '👤 You'} · {new Date(r.created_at).toLocaleString()}
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{r.message}</p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      {t.status !== 'resolved' && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <textarea
            className="input-base"
            rows={3}
            placeholder="Write a reply..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            style={{ resize: 'vertical', marginBottom: 10 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onReply(t.id)}
            disabled={replying || !replyText.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={13} />
            {replying ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      )}
      {t.status === 'resolved' && (
        <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={15} />Ticket resolved
        </div>
      )}
    </div>
  )
}
