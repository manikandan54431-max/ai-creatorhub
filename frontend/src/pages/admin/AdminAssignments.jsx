import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminAPI, creatorsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { GitBranch, Plus, Calendar, DollarSign, AlertTriangle } from 'lucide-react'
import { formatMoney, formatRating, formatDate } from '../../utils/format'

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState([])
  const [creators, setCreators] = useState([])
  const [pickerError, setPickerError] = useState(null)
  const [form, setForm] = useState({
    client_id: '', creator_id: '', project_title: '', project_description: '',
    required_category: '', budget: '', deadline: '', admin_notes: '',
    required_ai_tools: []
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
    loadPickers()
  }, [])

  // Eligible clients and creators for the assignment form, loaded from the
  // backend. A failure is surfaced, never replaced with placeholder options.
  const loadPickers = async () => {
    setPickerError(null)
    try {
      const [cl, cr] = await Promise.all([
        adminAPI.getUsers({ role: 'client' }),
        creatorsAPI.getAll({ limit: 50 }),
      ])
      setClients(Array.isArray(cl.data) ? cl.data : (cl.data?.items ?? []))
      setCreators(Array.isArray(cr.data) ? cr.data : (cr.data?.items ?? []))
    } catch (err) {
      setClients([])
      setCreators([])
      setPickerError(err.response?.data?.detail || 'Could not load clients and creators')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getAssignments()
      const data = res.data
      setAssignments(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed request must never render as "no assignments yet".
      setError(err.response?.data?.detail || err.message || 'Could not load assignments')
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.client_id || !form.creator_id || !form.project_title) {
      toast.error('Fill in required fields')
      return
    }
    setCreating(true)
    try {
      await adminAPI.createAssignment({
        ...form,
        client_id: parseInt(form.client_id),
        creator_id: parseInt(form.creator_id),
        budget: form.budget ? parseFloat(form.budget) : null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      })
      toast.success('Creator assigned successfully! 🎉')
      setShowCreate(false)
      setForm({ client_id: '', creator_id: '', project_title: '', project_description: '', required_category: '', budget: '', deadline: '', admin_notes: '', required_ai_tools: [] })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assignment failed')
    } finally { setCreating(false) }
  }

  const statusBadge = (s) => {
    const map = {
      assigned: ['#e0f2fe', '#075985'],
      in_progress: ['var(--color-accent-subtle)', '#5b21b6'],
      delivered: ['#d1fae5', '#065f46'],
      completed: ['#d1fae5', '#065f46'],
      cancelled: ['#fee2e2', '#991b1b'],
    }
    const [bg, color] = map[s] || ['#f1f5f9', '#475569']
    return <span style={{ background: bg, color, borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' }}>{s}</span>
  }

  const categories = ['AI Video Creation', 'AI Image Generation', 'UGC Ads', 'Instagram Reels', 'YouTube Shorts', 'AI Animation', 'Voiceover', 'Prompt Engineering']

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
            <GitBranch size={22} style={{ display: 'inline', marginRight: '10px', color: 'var(--color-accent)' }} />
            Creator Assignments
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Manually assign creators to client projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-gradient" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Assign Creator
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>Assign Creator to Project</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px' }}>✕</button>
            </div>

            {pickerError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px',
                fontSize: '13px', color: 'var(--text-secondary)',
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{pickerError}</span>
                <button type="button" onClick={loadPickers} style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)',
                  fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                }}>Retry</button>
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Client *</label>
                  <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="input-base" required>
                    <option value="">{clients.length === 0 ? 'No clients available' : 'Select client'}</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Creator *</label>
                  <select value={form.creator_id} onChange={e => setForm({ ...form, creator_id: e.target.value })} className="input-base" required>
                    <option value="">{creators.length === 0 ? 'No eligible creators available' : 'Select creator'}</option>
                    {creators.map(c => <option key={c.user_id} value={c.user_id}>{c.name} — {c.category || 'Uncategorised'} (⭐{formatRating(c.rating)})</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Project Title *</label>
                <input value={form.project_title} onChange={e => setForm({ ...form, project_title: e.target.value })} placeholder="e.g. Brand Campaign for XYZ" className="input-base" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Project Description</label>
                <textarea value={form.project_description} onChange={e => setForm({ ...form, project_description: e.target.value })} placeholder="Detailed project description..." className="input-base" rows={3} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Category</label>
                  <select value={form.required_category} onChange={e => setForm({ ...form, required_category: e.target.value })} className="input-base">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Budget (₹)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="e.g. 15000" className="input-base" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="input-base" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Admin Notes</label>
                <textarea value={form.admin_notes} onChange={e => setForm({ ...form, admin_notes: e.target.value })} placeholder="Internal notes about this assignment..." className="input-base" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ flex: 1, padding: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-gradient" style={{ flex: 2, padding: '13px', fontSize: '15px' }}>
                  {creating ? 'Assigning...' : '🎯 Assign Creator'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Assignments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '16px' }} />)
        ) : error ? (
          /* Error state - distinct from the empty state, with a retry. */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px', padding: '28px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px',
          }}>
            <AlertTriangle size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Could not load assignments
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</p>
            </div>
            <button onClick={fetchData} className="btn-gradient" style={{ padding: '10px 20px', fontSize: '13px' }}>
              Retry
            </button>
          </div>
        ) : assignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            <GitBranch size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>No assignments yet</p>
            <p>There are no creator assignments in the database.</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Click "Assign Creator" to create the first one.</p>
          </div>
        ) : assignments.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>{a.project_title}</h3>
                  {statusBadge(a.status)}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px', maxWidth: '600px' }}>
                  {a.project_description || 'No description'}
                </p>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🏢 Client: <strong style={{ color: 'var(--text-primary)' }}>{a.client?.name || '—'}</strong>
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🎨 Creator: <strong style={{ color: 'var(--text-primary)' }}>{a.creator?.name || '—'}</strong>
                  </span>
                  {a.budget && (
                    <span style={{ fontSize: '13px', color: 'var(--color-accent)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <DollarSign size={12} /> {formatMoney(a.budget)}
                    </span>
                  )}
                  {a.deadline && (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={12} /> {formatDate(a.deadline)}
                    </span>
                  )}
                  {a.required_category && (
                    <span className="badge badge-purple" style={{ fontSize: '11px' }}>{a.required_category}</span>
                  )}
                </div>
                {a.admin_notes && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    📝 {a.admin_notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '24px' }}>
                {['assigned', 'in_progress', 'delivered', 'completed'].map((s, idx) => {
                  if (s === a.status) return null
                  const nextStatus = ['assigned', 'in_progress', 'delivered', 'completed', 'cancelled']
                  const currentIdx = nextStatus.indexOf(a.status)
                  if (idx !== currentIdx + 1 && s !== 'cancelled') return null
                  return (
                    <button key={s} onClick={async () => {
                      try {
                        await adminAPI.updateAssignmentStatus(a.id, s)
                        toast.success(`Status updated to ${s}`)
                        await fetchData()
                      } catch (err) {
                        toast.error(err.response?.data?.detail || `Could not set status to ${s}`)
                      }
                    }}
                    style={{ padding: '7px 14px', fontSize: '12px', fontWeight: '600', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: 'none', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      → {s}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
