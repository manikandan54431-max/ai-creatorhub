import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import {
  Users, Star, ShoppingBag, DollarSign, MessageSquare, TrendingUp,
  Clock, CheckCircle, UserPlus, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { formatMoney } from '../../utils/format'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getDashboard()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: '32px' }}>
      <div className="stats-grid-4" style={{ marginBottom: '24px' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '16px' }} />)}
      </div>
      <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }} />
    </div>
  )

  const stats = data?.stats || {}
  const revenueChart = data?.revenue_chart || []
  const recentOrders = data?.recent_orders || []
  const topCreators = data?.top_creators || []

  const statCards = [
    { icon: Users,        label: 'Total Users',       value: stats.total_users || 0,     sub: `+${stats.new_registrations || 0} this month`, color: 'var(--color-accent)',         bg: 'var(--color-accent-subtle)' },
    { icon: Star,         label: 'Total Creators',    value: stats.total_creators || 0,  sub: 'Active creators',                              color: 'var(--color-accent)',         bg: 'var(--color-accent-subtle)' },
    { icon: ShoppingBag,  label: 'Total Orders',      value: stats.total_orders || 0,    sub: `${stats.pending_orders || 0} pending`,         color: 'var(--color-warning)',        bg: 'var(--color-warning-subtle)' },
    { icon: DollarSign,   label: 'Total Revenue',     value: formatMoney(stats.total_revenue), sub: 'Platform earnings', color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
    { icon: CheckCircle,  label: 'Completed Orders',  value: stats.completed_orders || 0, sub: 'Successfully done',                          color: 'var(--color-success)',        bg: 'var(--color-success-subtle)' },
    { icon: MessageSquare,label: 'Active Chats',      value: stats.active_chats || 0,    sub: 'Live conversations',                           color: 'var(--color-accent)',         bg: 'var(--color-accent-subtle)' },
    { icon: UserPlus,     label: 'New Registrations', value: stats.new_registrations || 0, sub: 'Last 30 days',                              color: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' },
    { icon: Users,        label: 'Total Clients',     value: stats.total_clients || 0,   sub: 'Brand clients',                                color: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' },
  ]

  const statusMap = {
    pending: ['#fef3c7', '#92400e'],
    completed: ['#d1fae5', '#065f46'],
    in_progress: ['var(--color-accent-subtle)', '#5b21b6'],
    cancelled: ['#fee2e2', '#991b1b'],
    assigned: ['#e0f2fe', '#075985'],
  }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Admin Dashboard 🛡️
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Platform overview and analytics</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="stats-grid-4" style={{ marginBottom: '32px' }}>
        {statCards.map(({ icon: Icon, label, value, sub, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="stat-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={color} />
              </div>
              <TrendingUp size={16} color="#22c55e" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid-2col" style={{ marginBottom: '32px' }}>
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{ padding: '24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>📈 Revenue Overview</h3>
            <span className="badge badge-success">Last 6 Months</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => formatMoney(v)} />
              <Tooltip formatter={v => [formatMoney(v), 'Revenue']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#adminRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Creators */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
          style={{ padding: '24px' }}
        >
          <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px', marginBottom: '20px' }}>🏆 Top Creators</h3>
          {topCreators.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topCreators.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: ['#f59e0b', 'var(--color-text-muted)', '#cd7c54'][i] || 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '800', color: i < 3 ? 'white' : 'var(--text-primary)', flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.orders} orders · ⭐ {c.rating}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Orders + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '24px' }}>
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
          style={{ overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>Recent Orders</h3>
            <a href="/admin/orders" style={{ fontSize: '13px', color: 'var(--color-accent)', fontWeight: '600', textDecoration: 'none' }}>View All →</a>
          </div>
          <div>
            {recentOrders.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent orders</div>
            ) : recentOrders.map((o, i) => (
              <div key={o.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>#{o.id} {(o.title || '').slice(0, 25)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{o.client_name} → {o.creator_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', color: 'var(--color-accent)', fontSize: '14px' }}>{formatMoney(o.budget)}</div>
                  <span style={{
                    background: statusMap[o.status]?.[0] || '#f1f5f9',
                    color: statusMap[o.status]?.[1] || '#475569',
                    borderRadius: '8px', padding: '2px 8px', fontSize: '11px', fontWeight: '700'
                  }}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
          style={{ padding: '24px' }}
        >
          <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px', marginBottom: '20px' }}>Platform Health</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Order Completion Rate', value: stats.total_orders ? Math.round((stats.completed_orders / stats.total_orders) * 100) : 0, color: 'var(--color-success)' },
              { label: 'Creator Approval Rate', value: 85, color: 'var(--color-accent)' },
              { label: 'Client Satisfaction', value: 92, color: 'var(--color-warning)' },
              { label: 'Platform Uptime', value: 99, color: '#06b6d4' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color }}>{value}%</span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    className="progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, delay: 0.8 }}
                    style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
