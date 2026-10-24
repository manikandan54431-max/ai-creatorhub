import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ordersAPI, paymentsAPI, creatorsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import {
  Package, Clock, CheckCircle, DollarSign, Star, TrendingUp,
  Edit3, Image, Briefcase, Bell, MessageCircle, Clapperboard, Sparkles
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoney, sumField, toFiniteNumber } from '../../utils/format'

export default function CreatorDashboard() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, paymentsRes, profileRes] = await Promise.all([
          ordersAPI.getMyOrders(),
          paymentsAPI.getMyPayments(),
          creatorsAPI.getById(user.id),
        ])
        setOrders(ordersRes.data)
        setPayments(paymentsRes.data)
        setProfile(profileRes.data)
      } catch {}
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    earnings: sumField(payments.filter(p => p.status === 'completed'), 'creator_earnings').total,
  }

  // Build last 6 months chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const monthLabel = d.toLocaleString('default', { month: 'short' })
    const monthEarnings = payments
      .filter(p => {
        const pd = new Date(p.created_at)
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === 'completed'
      })
      .reduce((s, p) => s + (toFiniteNumber(p.creator_earnings) ?? 0), 0)
    return { month: monthLabel, earnings: Math.round(monthEarnings) }
  })

  const statusBadge = (status) => {
    const map = {
      pending: ['#fef3c7', '#92400e', 'Pending'],
      accepted: ['#dbeafe', '#1e40af', 'Accepted'],
      in_progress: ['var(--color-accent-subtle)', '#5b21b6', 'In Progress'],
      delivered: ['#d1fae5', '#065f46', 'Delivered'],
      completed: ['#d1fae5', '#065f46', 'Completed'],
      cancelled: ['#fee2e2', '#991b1b', 'Cancelled'],
      assigned: ['#e0f2fe', '#075985', 'Assigned'],
    }
    const [bg, color, label] = map[status] || ['#f1f5f9', '#475569', status]
    return <span style={{ background: bg, color, borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>{label}</span>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '28px 0' }}>
        <div className="container-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                Creator Dashboard
              </h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Manage your orders, portfolio and earnings</p>
            </motion.div>
            <Link to="/creator/profile">
              <button className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={14} /> Edit Profile
              </button>
            </Link>
          </div>

          {/* Profile Completion */}
          {profile && profile.profile_completion < 100 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: '16px', background: 'var(--color-accent-subtle)',
                border: '1px solid rgba(15,118,110,0.2)',
                borderRadius: '10px', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: '600', fontSize: '14px' }}>Profile Completion</span>
                  <span style={{ color: 'var(--color-accent)', fontWeight: '700' }}>{profile.profile_completion}%</span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${profile.profile_completion}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
              </div>
              <Link to="/creator/profile">
                <button style={{
                  padding: '7px 14px', background: 'var(--color-accent)',
                  border: 'none', borderRadius: '6px',
                  color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: 'inherit'
                }}>
                  Complete Now
                </button>
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      <div className="container-custom" style={{ padding: '28px 24px' }}>
        {/* Stats */}
        <div className="stats-grid-5" style={{ marginBottom: '24px' }}>
          {[
            { icon: Package,    label: 'Total Orders',   value: stats.total,      color: 'var(--color-accent)',          bg: 'var(--color-accent-subtle)' },
            { icon: Clock,      label: 'Pending',        value: stats.pending,    color: 'var(--color-warning)',         bg: 'var(--color-warning-subtle)' },
            { icon: TrendingUp, label: 'In Progress',    value: stats.inProgress, color: 'var(--color-accent)',          bg: 'var(--color-accent-subtle)' },
            { icon: CheckCircle,label: 'Completed',      value: stats.completed,  color: 'var(--color-success)',         bg: 'var(--color-success-subtle)' },
            { icon: DollarSign, label: 'Total Earnings', value: formatMoney(stats.earnings), color: 'var(--color-text-primary)', bg: 'var(--color-surface-muted)' },
          ].map(({ icon: Icon, label, value, color, bg }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="stat-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: '500' }}>{label}</div>
            </motion.div>
          ))}
        </div>

        <div className="dashboard-grid-2col" style={{ marginBottom: '28px' }}>
          {/* Earnings Chart */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px', fontSize: '16px' }}>
              📈 Monthly Earnings
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => formatMoney(v)} />
                <Tooltip formatter={v => [formatMoney(v), 'Earnings']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }} />
                <Area type="monotone" dataKey="earnings" stroke="var(--color-accent)" strokeWidth={2} fill="url(#earningsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Links */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px', fontSize: '16px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: Edit3, label: 'Edit Profile', href: '/creator/profile', color: 'var(--color-accent)' },
                { icon: Image, label: 'Manage Portfolio', href: '/creator/portfolio', color: 'var(--color-accent)' },
                { icon: Briefcase, label: 'Manage Services', href: '/creator/services', color: 'var(--color-accent)' },
                { icon: MessageCircle, label: 'Active Chats', href: '/creator/chat', color: '#06b6d4' },
                { icon: Star, label: 'My Reviews', href: '/creator/reviews', color: 'var(--color-warning)' },
                { icon: Clapperboard, label: '🎬 Video Studio', href: '/creator/video-studio', color: 'var(--color-accent)' },
                { icon: Sparkles, label: '✨ AI Generator', href: '/creator/ai-generator', color: 'var(--color-accent)' },
                { icon: MessageCircle, label: '💬 Gemini Assistant', href: '/creator/gemini-assistant', color: '#7c3aed' },
              ].map(({ icon: Icon, label, href, color }) => (
                <Link key={label} to={href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    transition: 'all 0.2s', cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={15} color={color} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Incoming Orders</h2>
            <Link to="/creator/orders" style={{ color: 'var(--color-accent)', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>View All →</Link>
          </div>
          {loading ? (
            <div style={{ padding: '24px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px', marginBottom: '12px' }} />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: '600' }}>No orders yet</p>
              <p style={{ fontSize: '14px' }}>Complete your profile to start receiving orders</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Order', 'Client', 'Budget', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 8).map((order, i) => (
                    <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                        #{order.id} — {(order.title || '').slice(0, 28)}{order.title?.length > 28 ? '...' : ''}
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>{order.client?.name || '—'}</td>
                      <td style={{ padding: '16px 20px', fontWeight: '700', color: 'var(--color-success)' }}>{formatMoney(order.budget)}</td>
                      <td style={{ padding: '16px 20px' }}>{statusBadge(order.status)}</td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {order.status === 'pending' && (
                            <button
                              onClick={async () => { await ordersAPI.updateStatus(order.id, 'accepted'); setOrders(p => p.map(o => o.id === order.id ? { ...o, status: 'accepted' } : o)) }}
                              style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', background: 'rgba(5,150,105,0.1)', color: 'var(--color-success)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >Accept</button>
                          )}
                          <Link to={`/creator/orders/${order.id}`}>
                            <button style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>View</button>
                          </Link>
                        </div>
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
