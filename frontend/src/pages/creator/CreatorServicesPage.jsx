import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { creatorsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit3, Clock, RotateCcw, DollarSign, Check, X } from 'lucide-react'
import { formatMoney } from '../../utils/format'

const CATEGORIES = ['AI Video Creation', 'AI Image Generation', 'UGC Ads', 'Instagram Reels', 'YouTube Shorts', 'AI Animation', 'Voiceover', 'Prompt Engineering']

export default function CreatorServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', price: '', delivery_days: 7, revisions: 2, category: '' })

  useEffect(() => {
    creatorsAPI.getMyServices()
      .then(r => setServices(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const resetForm = () => {
    setForm({ title: '', description: '', price: '', delivery_days: 7, revisions: 2, category: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    if (!form.title || !form.price) return toast.error('Title and price are required')
    setSaving(true)
    try {
      if (editingId) {
        const r = await creatorsAPI.updateService(editingId, { ...form, price: Number(form.price) })
        setServices(p => p.map(s => s.id === editingId ? r.data : s))
        toast.success('Service updated!')
      } else {
        const r = await creatorsAPI.createService({ ...form, price: Number(form.price) })
        setServices(p => [...p, r.data])
        toast.success('Service created!')
      }
      resetForm()
    } catch {
      toast.error(editingId ? 'Failed to update service' : 'Failed to create service')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (svc) => {
    setForm({ title: svc.title, description: svc.description || '', price: svc.price, delivery_days: svc.delivery_days || 7, revisions: svc.revisions || 2, category: svc.category || '' })
    setEditingId(svc.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this service?')) return
    try {
      await creatorsAPI.deleteService(id)
      setServices(p => p.filter(s => s.id !== id))
      toast.success('Service deleted')
    } catch {
      toast.error('Failed to delete service')
    }
  }

  return (
    <div style={{ padding: '100px 24px 60px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
              🛠️ Manage Services
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{services.length} service package{services.length !== 1 ? 's' : ''} available to clients</p>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '11px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)',
              fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 16px rgba(15,118,110,0.25)' }}>
            <Plus size={16} /> Add Service
          </motion.button>
        </motion.div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="card" style={{ padding: '28px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {editingId ? 'Edit Service' : 'New Service Package'}
                </h3>
                <button onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Service Title *</label>
                  <input className="form-input" style={{ width: '100%' }} placeholder="e.g. 60-Second AI Product Video"
                    value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Category</label>
                  <select className="form-input" style={{ width: '100%' }} value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
                <textarea className="form-input" style={{ width: '100%', minHeight: '90px', resize: 'vertical' }}
                  placeholder="What's included? What will the client receive? What tools do you use?"
                  value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Price (Rs.) *</label>
                  <input className="form-input" style={{ width: '100%' }} type="number" min="100" placeholder="5000"
                    value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Delivery (days)</label>
                  <input className="form-input" style={{ width: '100%' }} type="number" min="1" max="60"
                    value={form.delivery_days} onChange={e => setForm(p => ({...p, delivery_days: Number(e.target.value)}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Revisions</label>
                  <input className="form-input" style={{ width: '100%' }} type="number" min="0" max="10"
                    value={form.revisions} onChange={e => setForm(p => ({...p, revisions: Number(e.target.value)}))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> {saving ? 'Saving...' : editingId ? 'Update Service' : 'Create Service'}
                </motion.button>
                <button onClick={resetForm} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Services List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '14px' }} />)}
          </div>
        ) : services.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>📦</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No services yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Create service packages so clients know exactly what to order from you</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '12px 28px', borderRadius: '12px', border: 'none',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: '700' }}>
              Create First Service
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {services.map((svc, i) => (
              <motion.div key={svc.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="card" style={{ padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>{svc.title}</h4>
                    {svc.category && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>{svc.category}</span>
                    )}
                  </div>
                  {svc.description && <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>{svc.description}</p>}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '700', color: 'var(--color-success)' }}>
                      <DollarSign size={13} /> {formatMoney(svc.price)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <Clock size={13} /> {svc.delivery_days} day delivery
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <RotateCcw size={13} /> {svc.revisions} revision{svc.revisions !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => handleEdit(svc)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none',
                    background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(svc.id)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none',
                    background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}