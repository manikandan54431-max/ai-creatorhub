import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { formatMoney } from '../../utils/format'
import { AlertTriangle } from 'lucide-react'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getOrders({ status: statusFilter || undefined })
      const data = res.data
      setOrders(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed load must not render as "no orders".
      setError(err.response?.data?.detail || err.message || 'Could not load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const statusMap = { pending: ['#fef3c7', '#92400e'], accepted: ['#dbeafe', '#1e40af'], in_progress: ['var(--color-accent-subtle)', '#5b21b6'], delivered: ['#d1fae5', '#065f46'], completed: ['#d1fae5', '#065f46'], cancelled: ['#fee2e2', '#991b1b'], assigned: ['#e0f2fe', '#075985'], revision_requested: ['#fef9c3', '#713f12'] }
  const statuses = ['', 'pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>🛍️ Order Management</h1>
        <p style={{ color: 'var(--text-muted)' }}>{orders.length} orders</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '8px 16px', borderRadius: '10px', fontWeight: '600', fontSize: '12px', background: statusFilter === s ? 'var(--color-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: statusFilter === s ? 'white' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', marginBottom: '20px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px',
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Could not load orders</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
          </div>
          <button onClick={fetchOrders} className="btn-gradient" style={{ padding: '9px 18px', fontSize: '13px' }}>Retry</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['ID', 'Title', 'Client', 'Creator', 'Budget', 'Status', 'Date', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={8} style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '36px', borderRadius: '8px' }} /></td></tr>)
              : orders.map((o, i) => (
                <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-muted)', fontSize: '12px' }}>#{o.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{o.client_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{o.creator_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-accent)', fontSize: '13px' }}>{formatMoney(o.budget)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: statusMap[o.status]?.[0] || '#f1f5f9', color: statusMap[o.status]?.[1] || '#475569', borderRadius: '8px', padding: '3px 9px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{o.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select onChange={async e => {
                      const next = e.target.value
                      // Previously an unguarded await: a rejected request threw an
                      // unhandled rejection and the admin was told nothing.
                      try {
                        await adminAPI.updateOrderStatus(o.id, next)
                        toast.success(`Order #${o.id} set to ${next}`)
                      } catch (err) {
                        toast.error(err.response?.data?.detail || `Could not set order #${o.id} to ${next}`)
                      }
                      // Either way, re-read so the row shows the stored status.
                      await fetchOrders()
                    }}
                      value={o.status} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '4px 8px', fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      {statuses.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </motion.tr>
              ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders found</div>}
      </div>
    </div>
  )
}
