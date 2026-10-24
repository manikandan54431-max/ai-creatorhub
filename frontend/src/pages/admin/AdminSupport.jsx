import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LifeBuoy, Search, Filter, RefreshCw, Send, CheckCircle2,
  Clock, AlertCircle, MessageSquare, ExternalLink, User,
  Mail, Phone, ChevronRight, ShieldAlert, Sparkles, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const SUPPORT_EMAIL = 'manikandan54431@gmail.com'
const SUPPORT_PHONE = '+91 6380994709'

const CATEGORIES = [
  'All Categories',
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

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'var(--ms-blue)', bg: 'rgba(0, 120, 212, 0.1)', border: 'rgba(0, 120, 212, 0.3)' },
  in_progress: { label: 'In Progress', color: 'var(--ms-yellow-text)', bg: 'rgba(255, 185, 0, 0.12)', border: 'rgba(255, 185, 0, 0.3)' },
  waiting_for_user: { label: 'Waiting for User', color: '#8764B8', bg: 'rgba(135, 100, 184, 0.12)', border: 'rgba(135, 100, 184, 0.3)' },
  resolved: { label: 'Resolved', color: 'var(--ms-green)', bg: 'rgba(16, 124, 65, 0.12)', border: 'rgba(16, 124, 65, 0.3)' },
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, categoryFilter])

  async function fetchTickets() {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (categoryFilter !== 'All Categories') params.category = categoryFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await api.get('/api/support/admin/tickets', { params })
      setTickets(res.data)
      if (selectedTicket) {
        const updated = res.data.find(t => t.id === selectedTicket.id)
        if (updated) setSelectedTicket(updated)
      }
    } catch (err) {
      toast.error('Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectTicket(ticketId) {
    setDetailLoading(true)
    try {
      const res = await api.get(`/api/support/admin/tickets/${ticketId}`)
      setSelectedTicket(res.data)
    } catch (err) {
      toast.error('Failed to fetch ticket details')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSendReply(e) {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicket) return

    setSubmittingReply(true)
    try {
      const res = await api.post(`/api/support/admin/tickets/${selectedTicket.id}/reply`, {
        message: replyText.trim(),
      })
      toast.success('Reply submitted to user')
      setReplyText('')
      // Refresh ticket details
      handleSelectTicket(selectedTicket.id)
      fetchTickets()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit reply')
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!selectedTicket || updatingStatus) return
    setUpdatingStatus(true)
    try {
      await api.put(`/api/support/admin/tickets/${selectedTicket.id}/status`, {
        status: newStatus,
      })
      toast.success(`Ticket marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      setSelectedTicket(prev => ({ ...prev, status: newStatus }))
      fetchTickets()
    } catch (err) {
      toast.error('Failed to update ticket status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Filter client-side by query if entered without reload
  const filteredTickets = tickets.filter(t => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.message?.toLowerCase().includes(q) ||
      String(t.id).includes(q)
    )
  })

  // Metrics
  const counts = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    waiting_for_user: tickets.filter(t => t.status === 'waiting_for_user').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--ms-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white'
            }}>
              <LifeBuoy size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Support Tickets Dashboard
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
            Review, reply to, and resolve client and creator support requests. Direct contacts: {SUPPORT_PHONE} | {SUPPORT_EMAIL}
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--ms-blue)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>All Tickets</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{counts.total}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--ms-blue)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Open</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ms-blue)', marginTop: 4 }}>{counts.open}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #FFB900' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>In Progress</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ms-yellow-text)', marginTop: 4 }}>{counts.in_progress}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #8764B8' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Waiting for User</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#8764B8', marginTop: 4 }}>{counts.waiting_for_user}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--ms-green)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Resolved</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ms-green)', marginTop: 4 }}>{counts.resolved}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-base"
            placeholder="Search tickets by subject, author, or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36, height: 38 }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'open', 'in_progress', 'waiting_for_user', 'resolved'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                border: statusFilter === status ? '1px solid var(--ms-blue)' : '1px solid var(--border-color)',
                background: statusFilter === status ? 'var(--ms-blue)' : 'var(--bg-secondary)',
                color: statusFilter === status ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <select
          className="input-base"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ width: 200, height: 38 }}
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Master-Detail Split Pane */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
        {/* Tickets List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
              Showing {filteredTickets.length} {filteredTickets.length === 1 ? 'Ticket' : 'Tickets'}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: 12, margin: '0 auto' }} />
              <div>Loading tickets...</div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <LifeBuoy size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No tickets found</div>
              <div style={{ fontSize: 13 }}>Try adjusting your search query or filters.</div>
            </div>
          ) : (
            <div style={{ maxHeight: '720px', overflowY: 'auto' }}>
              {filteredTickets.map(ticket => {
                const statusMeta = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
                const isSelected = selectedTicket?.id === ticket.id
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket.id)}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--ms-blue)' : '4px solid transparent',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                          #{ticket.id}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            color: statusMeta.color,
                            background: statusMeta.bg,
                            border: `1px solid ${statusMeta.border}`,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                        {ticket.category && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                            {ticket.category}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {ticket.subject}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.message}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>From: <strong style={{ color: 'var(--text-primary)' }}>{ticket.name}</strong> ({ticket.email})</span>
                      {ticket.order_id && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ms-blue)' }}>
                          Order #{ticket.order_id}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ticket Detail Drawer / Card */}
        {selectedTicket && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Ticket #{selectedTicket.id}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      color: STATUS_CONFIG[selectedTicket.status]?.color,
                      background: STATUS_CONFIG[selectedTicket.status]?.bg,
                      border: `1px solid ${STATUS_CONFIG[selectedTicket.status]?.border}`,
                    }}
                  >
                    {STATUS_CONFIG[selectedTicket.status]?.label || selectedTicket.status}
                  </span>
                  {selectedTicket.category && (
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {selectedTicket.category}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {selectedTicket.subject}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Submitter & Order Metadata */}
            <div style={{ padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Requester</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{selectedTicket.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedTicket.email}</div>
              </div>
              {selectedTicket.order_id && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Related Order</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ms-blue)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <a href={`/client/orders/${selectedTicket.order_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--ms-blue)', textDecoration: 'none' }}>
                      Order #{selectedTicket.order_id} <ExternalLink size={12} style={{ display: 'inline' }} />
                    </a>
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Submitted</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
                  {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Quick Status Actions */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Change Status:</span>
              <button
                disabled={updatingStatus}
                onClick={() => handleStatusChange('open')}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  background: selectedTicket.status === 'open' ? 'var(--ms-blue)' : 'var(--bg-secondary)',
                  color: selectedTicket.status === 'open' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', cursor: 'pointer'
                }}
              >
                Open
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => handleStatusChange('in_progress')}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  background: selectedTicket.status === 'in_progress' ? '#FFB900' : 'var(--bg-secondary)',
                  color: selectedTicket.status === 'in_progress' ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', cursor: 'pointer'
                }}
              >
                In Progress
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => handleStatusChange('waiting_for_user')}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  background: selectedTicket.status === 'waiting_for_user' ? '#8764B8' : 'var(--bg-secondary)',
                  color: selectedTicket.status === 'waiting_for_user' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', cursor: 'pointer'
                }}
              >
                Waiting for User
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => handleStatusChange('resolved')}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                  background: selectedTicket.status === 'resolved' ? 'var(--ms-green)' : 'var(--bg-secondary)',
                  color: selectedTicket.status === 'resolved' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', cursor: 'pointer'
                }}
              >
                Resolved
              </button>
            </div>

            {/* Conversation Thread */}
            <div style={{ padding: '24px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Original User Message */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--ms-blue)', color: 'var(--color-primary-foreground)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700
                    }}>
                      {selectedTicket.name ? selectedTicket.name[0].toUpperCase() : 'U'}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {selectedTicket.name} (Original Request)
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.message}
                </div>
              </div>

              {/* Replies */}
              {selectedTicket.replies && selectedTicket.replies.map(reply => (
                <div
                  key={reply.id}
                  style={{
                    background: reply.is_admin_reply ? 'rgba(0, 120, 212, 0.06)' : 'var(--bg-secondary)',
                    border: reply.is_admin_reply ? '1px solid rgba(0, 120, 212, 0.25)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    marginLeft: reply.is_admin_reply ? 20 : 0,
                    marginRight: reply.is_admin_reply ? 0 : 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: reply.is_admin_reply ? 'var(--ms-blue)' : 'var(--bg-tertiary)',
                        color: reply.is_admin_reply ? 'white' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700
                      }}>
                        {reply.is_admin_reply ? '🛡️' : '👤'}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {reply.is_admin_reply ? 'Admin Support Team' : (reply.author_name || 'User')}
                      </span>
                      {reply.is_admin_reply && (
                        <span style={{ fontSize: 10, background: 'var(--ms-blue)', color: 'var(--color-primary-foreground)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          STAFF
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {reply.created_at ? new Date(reply.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {reply.message}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ marginBottom: 10 }}>
                <textarea
                  className="input-base"
                  rows={3}
                  placeholder="Write an official admin response to the user..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Replying will notify the user and set status to "Waiting for User".
                </div>
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36 }}
                >
                  <Send size={14} />
                  {submittingReply ? 'Sending...' : 'Send Response'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
