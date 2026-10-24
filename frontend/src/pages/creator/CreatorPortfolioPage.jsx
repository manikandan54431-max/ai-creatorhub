import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { creatorsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, ExternalLink, X, Sparkles } from 'lucide-react'

export default function CreatorPortfolioPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', media_url: '', tags: [] })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    creatorsAPI.getMe()
      .then(r => { if (r.data?.portfolio) setItems(r.data.portfolio) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(p => ({ ...p, tags: [...p.tags, t] }))
      setTagInput('')
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.media_url) return toast.error('Title and media URL are required')
    setSaving(true)
    try {
      const r = await creatorsAPI.addPortfolio(form)
      setItems(p => [...p, r.data])
      setForm({ title: '', description: '', media_url: '', tags: [] })
      setShowForm(false)
      toast.success('Portfolio item added!')
    } catch {
      toast.error('Failed to add portfolio item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this portfolio item?')) return
    try {
      await creatorsAPI.deletePortfolio(id)
      setItems(p => p.filter(i => i.id !== id))
      toast.success('Deleted!')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div style={{ padding: '100px 24px 60px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Portfolio Manager
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{items.length} items in your portfolio</p>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            style={{ padding: '11px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)',
              fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 16px rgba(15,118,110,0.25)' }}>
            <Plus size={16} /> Add Item
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} className="card" style={{ padding: '28px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>New Portfolio Item</h3>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Title *</label>
                  <input className="form-input" style={{ width: '100%' }} placeholder="e.g. AI Product Video"
                    value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Media URL *</label>
                  <input className="form-input" style={{ width: '100%' }} placeholder="https://..."
                    value={form.media_url} onChange={e => setForm(p => ({...p, media_url: e.target.value}))} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
                <textarea className="form-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Describe the work and tools used..."
                  value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {form.tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px',
                      borderRadius: '20px', fontSize: '12px', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                      {tag}
                      <X size={11} style={{ cursor: 'pointer' }} onClick={() => setForm(p => ({...p, tags: p.tags.filter(t => t !== tag)}))} />
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-input" style={{ flex: 1, fontSize: '13px', padding: '7px 12px' }}
                    placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                  <button onClick={addTag} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none',
                    background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '13px' }}>
                  {saving ? 'Saving...' : 'Add Item'}
                </motion.button>
                <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '20px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '240px', borderRadius: '16px' }} />)}
          </div>
        ) : items.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎨</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No portfolio items yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Add your best AI-generated work to impress clients</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '12px 28px', borderRadius: '12px', border: 'none',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: '700' }}>
              Add Your First Item
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '20px' }}>
            {items.map((item, i) => (
              <motion.div key={item.id || i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card" style={{ overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '160px', background: 'var(--color-surface-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {item.media_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.media_url) ? (
                    <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none' }} />
                  ) : <Sparkles size={40} color="rgba(255,255,255,0.6)" />}
                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                    {item.media_url && (
                      <a href={item.media_url} target="_blank" rel="noopener noreferrer"
                        style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button onClick={() => handleDelete(item.id)}
                      style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(239,68,68,0.7)',
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={13} color="white" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <h4 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '15px' }}>{item.title}</h4>
                  {item.description && <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '10px' }}>{item.description}</p>}
                  {item.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {item.tags.map(tag => (
                        <span key={tag} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                          background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}