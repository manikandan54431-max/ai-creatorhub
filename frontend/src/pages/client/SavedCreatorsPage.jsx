import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { creatorsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { Heart, Search, Star, Zap, MapPin, X, Filter, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SavedCreatorsPage() {
  const { user } = useAuthStore()
  const [creators, setCreators] = useState([])
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    creatorsAPI.getAll({ limit: 30 })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.creators ?? r.data?.items ?? [])
        setCreators(list)
        const ids = JSON.parse(localStorage.getItem('saved_creators') || '[]')
        setSaved(ids)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleSave = (id) => {
    setSaved(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      localStorage.setItem('saved_creators', JSON.stringify(next))
      toast.success(prev.includes(id) ? 'Removed from saved' : 'Creator saved!')
      return next
    })
  }

  const savedCreators = creators.filter(c => saved.includes(c.id))
  const displayed = savedCreators.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.headline?.toLowerCase().includes(q)
  })

  if (loading) return (
    <div style={{ padding: '120px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '16px' }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '100px 24px 60px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Heart size={28} color="#ec4899" fill="#ec4899" /> Saved Creators
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{savedCreators.length} creator{savedCreators.length !== 1 ? 's' : ''} saved</p>
        </motion.div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: '38px', width: '100%' }}
              placeholder="Search saved creators..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {displayed.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>💔</div>
            <h3 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {search ? 'No results found' : 'No saved creators yet'}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              {search ? 'Try a different search term' : 'Browse the marketplace and save creators you love'}
            </p>
            <Link to="/creators" style={{ padding: '12px 28px', borderRadius: '12px', textDecoration: 'none',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '600' }}>
              Browse Creators
            </Link>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '20px' }}>
            {displayed.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card" style={{ padding: '24px', position: 'relative', overflow: 'visible' }}>
                <button onClick={() => toggleSave(c.id)} style={{
                  position: 'absolute', top: '16px', right: '16px', background: 'rgba(236,72,153,0.1)',
                  border: '1px solid rgba(236,72,153,0.2)', borderRadius: '50%', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={14} color="#ec4899" />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-surface-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                    {c.name?.[0] || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.headline || c.category || 'AI Creator'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {c.rating && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px',
                      color: 'var(--color-warning)', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                      <Star size={11} fill="#f59e0b" /> {Number(c.rating).toFixed(1)}
                    </span>
                  )}
                  {c.total_orders > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px' }}>
                      {c.total_orders} orders
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to={`/creators/${c.user_id || c.id}`} style={{ flex: 1, padding: '9px', borderRadius: '10px',
                    background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)',
                    textDecoration: 'none', fontWeight: '600', fontSize: '13px', textAlign: 'center' }}>
                    View Profile
                  </Link>
                  <Link to={`/client/hire/${c.user_id || c.id}`} style={{ padding: '9px 14px', borderRadius: '10px',
                    background: 'var(--color-accent-subtle)', color: 'var(--color-accent)',
                    textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}>
                    Hire
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}