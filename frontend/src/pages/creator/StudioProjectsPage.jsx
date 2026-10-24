/**
 * Video Studio Projects List Page
 * /creator/video-studio
 *
 * Shows all studio projects. Creators can create, rename, delete, duplicate.
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { studioAPI } from '../../services/api'
import StudioNav from '../../components/layout/StudioNav'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Copy, Edit3, Video, Clock, Calendar,
  Clapperboard, ChevronRight, Sparkles, RefreshCw
} from 'lucide-react'

const ASPECT_ICONS = { '16:9': '🖥️', '9:16': '📱', '1:1': '⬛' }

export default function StudioProjectsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newOrderId, setNewOrderId] = useState('')
  const [newAspect, setNewAspect] = useState('16:9')
  const [deleteId, setDeleteId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, oRes] = await Promise.all([
        studioAPI.listProjects(),
        studioAPI.getEligibleOrders(),
      ])
      setProjects(pRes.data)
      setOrders(oRes.data)
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) { toast.error('Enter a project title'); return }
    setCreating(true)
    try {
      const res = await studioAPI.createProject({
        title: newTitle.trim(),
        order_id: newOrderId ? parseInt(newOrderId) : null,
        aspect_ratio: newAspect,
      })
      toast.success('Project created!')
      setShowCreate(false)
      setNewTitle('')
      setNewOrderId('')
      navigate(`/creator/video-studio/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await studioAPI.deleteProject(id)
      setProjects(ps => ps.filter(p => p.id !== id))
      setDeleteId(null)
      toast.success('Project deleted')
    } catch {
      toast.error('Failed to delete project')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      const res = await studioAPI.duplicateProject(id)
      setProjects(ps => [res.data, ...ps])
      toast.success('Project duplicated')
    } catch {
      toast.error('Failed to duplicate project')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* This route renders without the site Navbar, so the Studio carries its
          own exits. Without them the page is a dead end. */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
      }}>
        <div className="container-custom" style={{ padding: 0 }}>
          <StudioNav excludePrefix="/creator/video-studio" />
        </div>
      </div>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        padding: '48px 0 40px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div className="container-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'var(--color-surface-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                }}>
                  🎬
                </div>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: 0 }}>
                    Video Studio
                  </h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0, marginTop: 3 }}>
                    Create · Edit · Export · Submit for Review
                  </p>
                </div>
              </div>
            </motion.div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={load} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '9px 16px', color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--color-surface-muted)',
                  border: 'none', borderRadius: 10, padding: '9px 20px',
                  color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                }}
              >
                <Plus size={16} /> New Project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '32px 24px' }}>
        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
              }}
              onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card"
                style={{ width: '100%', maxWidth: 460, padding: 32 }}
              >
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>
                  🎬 New Studio Project
                </h2>
                <form onSubmit={handleCreate}>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Project Title *
                    </label>
                    <input
                      className="input-base"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g. Brand Reel for Aisha – Q4 2026"
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Link to Order (optional)
                    </label>
                    <select
                      className="input-base"
                      value={newOrderId}
                      onChange={e => setNewOrderId(e.target.value)}
                    >
                      <option value="">— No order, just a draft —</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          #{o.id} — {o.title} ({o.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Aspect Ratio
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['16:9', '9:16', '1:1'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNewAspect(r)}
                          style={{
                            flex: 1, padding: '10px 8px',
                            background: newAspect === r ? 'var(--color-primary)' : 'var(--bg-secondary)',
                            border: newAspect === r ? '2px solid var(--color-accent)' : '2px solid var(--border-color)',
                            borderRadius: 10, cursor: 'pointer',
                            color: newAspect === r ? 'var(--color-primary-foreground)' : 'var(--text-secondary)',
                            fontWeight: 700, fontSize: 13, textAlign: 'center',
                          }}
                        >
                          {ASPECT_ICONS[r]} {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      style={{
                        flex: 1, padding: '11px', background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)', borderRadius: 10,
                        cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      style={{
                        flex: 2, padding: '11px',
                        background: 'var(--color-surface-muted)',
                        border: 'none', borderRadius: 10, cursor: 'pointer',
                        color: 'var(--color-text-primary)', fontWeight: 700, fontSize: 15,
                      }}
                    >
                      {creating ? 'Creating…' : 'Create Project'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirm */}
        <AnimatePresence>
          {deleteId && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            >
              <motion.div
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="card" style={{ maxWidth: 380, width: '100%', padding: 28, textAlign: 'center' }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
                <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Delete Project?</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                  This will permanently delete the project and cannot be undone. Uploaded assets are kept.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: '10px', background: '#ef4444', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'white', fontWeight: 700 }}>
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />)}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '80px 24px' }}
          >
            <div style={{ fontSize: 72, marginBottom: 20 }}>🎬</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
              Your Studio is Empty
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 440, margin: '0 auto 28px' }}>
              Create your first Studio project to start editing videos for your client orders.
              Link a project to an order to submit the final video for admin review.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--color-surface-muted)',
                border: 'none', borderRadius: 12, padding: '13px 28px',
                color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: 15,
                boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
              }}
            >
              <Plus size={18} /> Create First Project
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {projects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => navigate(`/creator/video-studio/${p.id}`)}
              >
                {/* Thumbnail strip */}
                <div style={{
                  height: 110,
                  background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <Clapperboard size={36} color="rgba(255,255,255,0.3)" />
                  <div style={{
                    position: 'absolute', top: 10, left: 10,
                    background: 'rgba(0,0,0,0.5)', borderRadius: 6,
                    padding: '3px 8px', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                  }}>
                    {ASPECT_ICONS[p.aspect_ratio] || '🎬'} {p.aspect_ratio}
                  </div>
                  {p.order_id && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: 'rgba(15,118,110,0.7)', borderRadius: 6,
                      padding: '3px 8px', fontSize: 11, color: 'white', fontWeight: 600,
                    }}>
                      Order #{p.order_id}
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> v{p.revision_number}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} /> {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                    {p.duration > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Video size={11} /> {Math.round(p.duration)}s
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/creator/video-studio/${p.id}`)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: 'var(--color-surface-muted)',
                        border: 'none', borderRadius: 8, padding: '8px',
                        color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      }}
                    >
                      <Edit3 size={13} /> Open
                    </button>
                    <button
                      onClick={() => handleDuplicate(p.id)}
                      title="Duplicate"
                      style={{ padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      title="Delete"
                      style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
