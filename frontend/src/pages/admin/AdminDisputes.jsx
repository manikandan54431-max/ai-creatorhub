import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolveModal, setResolveModal] = useState(null)
  const [resolution, setResolution] = useState('')
  const [resolveFor, setResolveFor] = useState('client')

  useEffect(() => {
    adminAPI.getDisputes().then(r => setDisputes(Array.isArray(r.data) ? r.data : (r.data?.items ?? []))).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleResolve = async () => {
    if (!resolution) { toast.error('Enter resolution notes'); return }
    try {
      await adminAPI.resolveDispute(resolveModal.id, { resolution_notes: resolution, resolved_in_favor_of: resolveFor })
      toast.success('Dispute resolved!')
      setDisputes(prev => prev.map(d => d.id === resolveModal.id ? { ...d, status: 'resolved', resolution_notes: resolution } : d))
      setResolveModal(null); setResolution(''); setResolveFor('client')
    } catch { toast.error('Failed to resolve') }
  }

  const statusColor = { open: ['#fef3c7', '#92400e'], under_review: ['#dbeafe', '#1e40af'], resolved: ['#d1fae5', '#065f46'], closed: ['#f1f5f9', '#475569'] }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
          <AlertTriangle size={22} style={{ display: 'inline', marginRight: '10px', color: 'var(--color-warning)' }} />
          Dispute Resolution
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>{disputes.filter(d => d.status === 'open').length} open disputes</p>
      </div>

      {resolveModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ background: 'var(--bg-card)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px', margin: '16px' }}>
            <h2 style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '20px' }}>Resolve Dispute #{resolveModal.id}</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Resolve in favor of</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['client', 'creator'].map(r => (
                  <button key={r} onClick={() => setResolveFor(r)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', background: resolveFor === r ? 'var(--color-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: resolveFor === r ? 'white' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {r === 'client' ? '🏢 Client' : '🎨 Creator'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Resolution Notes *</label>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Explain the resolution decision..." className="input-base" rows={4} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setResolveModal(null)} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleResolve} className="btn-gradient" style={{ flex: 2, padding: '12px' }}>⚖️ Resolve Dispute</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '16px' }} />)
          : disputes.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>Dispute #{d.id} — Order #{d.order_id}</span>
                    <span style={{ background: statusColor[d.status]?.[0] || '#f1f5f9', color: statusColor[d.status]?.[1] || '#475569', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' }}>{d.status}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.6' }}>{d.reason}</p>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>🏢 Client: <strong style={{ color: 'var(--text-primary)' }}>{d.client_name}</strong></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>🎨 Creator: <strong style={{ color: 'var(--text-primary)' }}>{d.creator_name}</strong></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📅 {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                  {d.resolution_notes && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(5,150,105,0.08)', borderRadius: '10px', fontSize: '13px', color: 'var(--color-success)' }}>
                      ✓ Resolution: {d.resolution_notes}
                    </div>
                  )}
                </div>
                {d.status === 'open' && (
                  <button onClick={() => setResolveModal(d)} className="btn-gradient" style={{ padding: '10px 20px', marginLeft: '24px', whiteSpace: 'nowrap' }}>
                    ⚖️ Resolve
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        {!loading && disputes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            <AlertTriangle size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p>No disputes — great news! 🎉</p>
          </div>
        )}
      </div>
    </div>
  )
}
