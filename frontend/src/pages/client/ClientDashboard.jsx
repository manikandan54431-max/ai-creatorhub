import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ordersAPI, paymentsAPI, creatorsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import {
  ShoppingBag, Clock, CheckCircle, DollarSign, Users, Plus,
  TrendingUp, Star, Eye, MessageCircle, Heart
} from 'lucide-react'
import { formatMoney, sumField } from '../../utils/format'

export default function ClientDashboard() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, paymentsRes] = await Promise.all([
          ordersAPI.getMyOrders(),
          paymentsAPI.getMyPayments(),
        ])
        setOrders(ordersRes.data)
        setPayments(paymentsRes.data)
      } catch {}
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const stats = {
    total: orders.length,
    active: orders.filter(o => ['accepted', 'in_progress'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'completed').length,
    spend: sumField(payments.filter(p => p.status === 'completed'), 'amount').total,
  }

  const statusBadge = (status) => {
    const map = {
      pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      accepted: { bg: '#dbeafe', color: '#1e40af', label: 'Accepted' },
      in_progress: { bg: 'var(--color-accent-subtle)', color: '#5b21b6', label: 'In Progress' },
      delivered: { bg: '#d1fae5', color: '#065f46', label: 'Delivered' },
      completed: { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
      cancelled: { bg: '#fee2e2', color: 'var(--color-danger)', label: 'Cancelled' },
      assigned: { bg: '#e0f2fe', color: '#075985', label: 'Assigned' },
      revision_requested: { bg: '#fef9c3', color: '#713f12', label: 'Revision' },
    }
    const s = map[status] || { bg: '#f1f5f9', color: '#475569', label: status }
    return (
      <span style={{ background: s.bg, color: s.color, borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>
        {s.label}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '28px 0'
      }}>
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Here's an overview of your projects and activity</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '28px 24px' }}>
        {/* Stats Grid */}
        <div className="stats-grid-4" style={{ marginBottom: '24px' }}>
          {[
          { icon: ShoppingBag,  label: 'Total Orders',  value: stats.total,  color: 'var(--color-accent)',   bg: 'var(--color-accent-subtle)' },
            { icon: Clock,       label: 'Active Orders', value: stats.active, color: 'var(--color-warning)',  bg: 'var(--color-warning-subtle)' },
            { icon: CheckCircle, label: 'Completed',     value: stats.completed, color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
            { icon: DollarSign,  label: 'Total Spend',   value: formatMoney(stats.spend), color: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' },
          ].map(({ icon: Icon, label, value, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="stat-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '500' }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-grid" style={{ marginBottom: '24px' }}>
          {[
            { icon: Users,         label: 'Browse Creators',  href: '/creators',         color: 'var(--color-accent)' },
            { icon: Heart,         label: 'Saved Creators',   href: '/client/saved',     color: 'var(--color-danger)' },
            { icon: MessageCircle, label: 'My Chats',         href: '/client/chat',      color: 'var(--color-info)' },
            { icon: DollarSign,    label: 'Payment History',  href: '/client/payments',  color: 'var(--color-success)' },
          ].map(({ icon: Icon, label, href, color }) => (
            <Link key={label} to={href} style={{ textDecoration: 'none' }}>
              <motion.div
                whileHover={{ y: -2 }}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ width: '34px', height: '34px', background: 'var(--color-surface-muted)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={color} />
                </div>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: '600', fontSize: '13px' }}>{label}</span>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Recent Orders */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Recent Orders</h2>
            <Link to="/client/orders" style={{ color: 'var(--color-accent)', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>View All →</Link>
          </div>

          {loading ? (
            <div style={{ padding: '24px' }}>
              {[1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px', marginBottom: '12px' }} />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>No orders yet</p>
              <p style={{ fontSize: '14px', marginBottom: '20px' }}>Browse creators and place your first order!</p>
              <Link to="/creators">
                <button className="btn-gradient" style={{ padding: '12px 24px' }}>Browse Creators</button>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Order', 'Creator', 'Budget', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 8).map((order, i) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                          #{order.id} — {order.title.length > 30 ? order.title.slice(0, 30) + '...' : order.title}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {order.creator?.name || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: '700', color: 'var(--color-accent)' }}>
                        {formatMoney(order.budget)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>{statusBadge(order.status)}</td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <Link to={`/client/orders/${order.id}`}>
                          <button style={{
                            padding: '6px 14px', fontSize: '12px', fontWeight: '600',
                            background: 'var(--color-accent-subtle)', color: 'var(--color-accent)',
                            border: 'none', borderRadius: '8px', cursor: 'pointer'
                          }}>
                            View
                          </button>
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
