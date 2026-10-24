import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ordersAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { Package, Search, Filter } from 'lucide-react'
import { formatMoney } from '../../utils/format'

const statusMap = {
  pending: ['#fef3c7', '#92400e'],
  assigned: ['#e0f2fe', '#075985'],
  accepted: ['#dbeafe', '#1e40af'],
  in_progress: ['var(--color-accent-subtle)', '#5b21b6'],
  delivered: ['#d1fae5', '#065f46'],
  revision_requested: ['#fef9c3', '#713f12'],
  completed: ['#d1fae5', '#065f46'],
  cancelled: ['#fee2e2', '#991b1b'],
}

export default function OrdersListPage() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    ordersAPI.getMyOrders()
      .then(r => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter ? orders.filter(o => o.status === filter) : orders
  const isClient = user?.role === 'client'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '40px 0' }}>
        <div className="container-custom">
          <h1 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
            {isClient ? '🛍️ My Orders' : '📦 Incoming Orders'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>{orders.length} total orders</p>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '28px 24px' }}>
        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {['', 'pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '8px 16px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', background: filter === s ? 'var(--color-primary)' : 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: filter === s ? 'white' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s' }}>
              {s || 'All'} {s ? `(${orders.filter(o => o.status === s).length})` : `(${orders.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '16px' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            <Package size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>No orders found</h3>
            {isClient && <Link to="/creators"><button className="btn-gradient" style={{ padding: '12px 28px', marginTop: '12px' }}>Browse Creators</button></Link>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map((order, i) => {
              const [bg, color] = statusMap[order.status] || ['#f1f5f9', '#475569']
              const dashboardBase = user?.role === 'creator' ? '/creator' : '/client'
              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link to={`${dashboardBase}/orders/${order.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px 24px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.2s', cursor: 'pointer'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 4px 20px var(--color-accent-subtle)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '800', color: 'var(--text-muted)', fontSize: '13px' }}>#{order.id}</span>
                          <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>{order.title}</h3>
                          <span style={{ background: bg, color, borderRadius: '8px', padding: '2px 10px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <span>{isClient ? `Creator: ${order.creator?.name || 'Not assigned'}` : `Client: ${order.client?.name}`}</span>
                          <span>📅 {new Date(order.created_at).toLocaleDateString()}</span>
                          {order.category && <span>📌 {order.category}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--color-accent)' }}>{formatMoney(order.budget)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Click to view →</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
