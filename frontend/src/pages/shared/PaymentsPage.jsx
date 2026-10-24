import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { paymentsAPI } from '../../services/api'
import { CreditCard, DollarSign, CheckCircle, Clock } from 'lucide-react'
import { formatMoney, formatAggregate, formatDate, sumField } from '../../utils/format'

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    paymentsAPI.getMyPayments()
      .then(r => {
        const data = r.data
        setPayments(Array.isArray(data) ? data : (data?.items ?? data?.payments ?? []))
      })
      .catch(err => {
        // A failed load must not be presented as a zero total.
        setLoadError(err.response?.data?.detail || 'Could not load payments')
        setPayments([])
      })
      .finally(() => setLoading(false))
  }, [])

  // sumField skips unusable values instead of poisoning the total with NaN.
  const spent = sumField(payments.filter(p => p.status === 'completed'), 'amount')
  const statusMap = { completed: ['#d1fae5', '#065f46'], pending: ['#fef3c7', '#92400e'], failed: ['#fee2e2', '#991b1b'], refunded: ['#f1f5f9', '#475569'] }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '40px 0' }}>
        <div className="container-custom">
          <h1 style={{ fontSize: '30px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '6px' }}>💳 Payment History</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>All your transactions</p>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '28px 24px' }}>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {[
            { icon: DollarSign, label: 'Total Spent', value: formatAggregate(spent.total, !loadError), color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
            { icon: CheckCircle, label: 'Completed', value: payments.filter(p => p.status === 'completed').length, color: 'var(--color-success)', bg: 'rgba(5,150,105,0.1)' },
            { icon: Clock, label: 'Pending', value: payments.filter(p => p.status === 'pending').length, color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={22} color={color} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>{value}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['Payment ID', 'Order', 'Amount', 'Method', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array(4).fill(0).map((_, i) => <tr key={i}><td colSpan={6} style={{ padding: '14px 20px' }}><div className="skeleton" style={{ height: '40px', borderRadius: '8px' }} /></td></tr>)
                : payments.length === 0 ? <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No payments yet</td></tr>
                : payments.map((p, i) => {
                  const [bg, color] = statusMap[p.status] || ['#f1f5f9', '#475569']
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: 'var(--text-muted)', fontSize: '13px' }}>#{p.id}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Order #{p.order_id}</td>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.amount)}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'capitalize' }}>{p.payment_method || 'simulated'}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ background: bg, color, borderRadius: '8px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                    </motion.tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
