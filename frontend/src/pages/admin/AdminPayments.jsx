import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import { formatMoney, formatNumber, formatDate, sumField, toFiniteNumber } from '../../utils/format'
import { AlertTriangle, RefreshCw, Receipt } from 'lucide-react'

/**
 * Admin payment management + turnover reporting.
 *
 * Turnover figures come from the backend (app/services/revenue.py), which is
 * also what filters the transaction rows below — so the cards and the list
 * always describe the same set of payments. Nothing is recomputed here from a
 * partial page of rows.
 */

const PERIODS = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
  { id: 'all', label: 'All Time' },
]

const STATUS_STYLES = {
  completed: ['#d1fae5', '#065f46'],
  pending: ['#fef3c7', '#92400e'],
  failed: ['#fee2e2', '#991b1b'],
  refunded: ['#f1f5f9', '#475569'],
  cancelled: ['#f1f5f9', '#475569'],
}

/** ISO date (YYYY-MM-DD) for "today" in the browser's local calendar. */
function todayISO() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday of the week containing `iso`, as YYYY-MM-DD — matches the backend's week start. */
function mondayOf(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return todayISO()
  const offset = (d.getDay() + 6) % 7      // 0 = Monday
  d.setDate(d.getDate() - offset)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The last 8 calendar years, newest first. Computed once, not per render. */
const SELECTABLE_YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i)

export default function AdminPayments() {
  const selectableYears = SELECTABLE_YEARS
  const [period, setPeriod] = useState('month')
  const [anchor, setAnchor] = useState(todayISO())

  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = period === 'all' ? { period } : { period, anchor }
      const res = await adminAPI.getPayments(params)
      const data = res.data ?? {}
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setSummary(data.summary ?? null)
    } catch (err) {
      // An API failure must not look like "no payments" or like a zero total.
      setError(err.response?.data?.detail || err.message || 'Could not load payments')
      setPayments([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [period, anchor])

  useEffect(() => { load() }, [load])

  // Flag records whose amounts are not usable numbers, rather than hiding them
  // inside a total. Validation only — the displayed figures come from the API.
  const dataIssues = useMemo(() => {
    const completed = payments.filter(p => p.status === 'completed')
    const amounts = sumField(completed, 'amount')
    const fees = sumField(completed, 'platform_fee')
    const earnings = sumField(completed, 'creator_earnings')
    const ids = new Set([...amounts.invalidIds, ...fees.invalidIds, ...earnings.invalidIds])
    return { count: ids.size, ids: [...ids] }
  }, [payments])

  const summaryAvailable = summary !== null && !error

  const cards = [
    {
      label: 'Gross Turnover',
      hint: 'Completed payments only',
      value: summary?.turnover,
      color: 'var(--color-accent)',
    },
    {
      label: 'Platform Commission',
      hint: 'Not turnover — the platform share',
      value: summary?.platform_commission,
      color: 'var(--color-success)',
    },
    {
      label: 'Creator Earnings',
      hint: 'Not turnover — paid out to creators',
      value: summary?.creator_earnings,
      color: 'var(--color-accent)',
    },
    {
      label: 'Refunded',
      hint: 'Reported separately, not deducted above',
      value: summary?.refunded_amount,
      color: 'var(--color-warning)',
    },
  ]

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>💳 Payment Management</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Turnover reporting and transaction history
        </p>
      </div>

      {/* ── Period controls ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              style={{
                padding: '9px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
                background: period === p.id ? 'var(--color-primary)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: period === p.id ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Which week / month / year */}
        {period === 'week' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Week of
            <input
              type="date"
              value={mondayOf(anchor)}
              onChange={e => e.target.value && setAnchor(mondayOf(e.target.value))}
              className="input-base"
              style={{ width: 'auto', padding: '8px 10px' }}
            />
          </label>
        )}
        {period === 'month' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Month
            <input
              type="month"
              value={anchor.slice(0, 7)}
              onChange={e => e.target.value && setAnchor(`${e.target.value}-01`)}
              className="input-base"
              style={{ width: 'auto', padding: '8px 10px' }}
            />
          </label>
        )}
        {period === 'year' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Year
            <select
              value={anchor.slice(0, 4)}
              onChange={e => setAnchor(`${e.target.value}-01-01`)}
              className="input-base"
              style={{ width: 'auto', padding: '8px 10px' }}
            >
              {selectableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto',
            padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Selected period label — always says exactly what is being shown */}
      <div style={{ marginBottom: '18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
        {loading ? (
          <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
        ) : error ? (
          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Figures unavailable</span>
        ) : summary ? (
          <>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{summary.period_label}</strong>
            {' · '}
            {formatNumber(summary.completed_count)} completed
            {toFiniteNumber(summary.pending_count) ? `, ${formatNumber(summary.pending_count)} pending` : ''}
            {toFiniteNumber(summary.failed_count) ? `, ${formatNumber(summary.failed_count)} failed` : ''}
            {' · '}
            <span style={{ color: 'var(--text-muted)' }}>
              {summary.currency} · period boundaries in {summary.timezone}
            </span>
          </>
        ) : null}
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', marginBottom: '24px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px',
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Could not load payment data
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
          </div>
          <button onClick={load} className="btn-gradient" style={{ padding: '9px 18px', fontSize: '13px' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '20px', marginBottom: '20px' }}>
        {cards.map(({ label, hint, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
            <div style={{ fontSize: '28px', fontWeight: '900', color, marginBottom: '6px' }}>
              {loading ? (
                <span className="skeleton" style={{ display: 'inline-block', width: '110px', height: '30px', borderRadius: '8px' }} />
              ) : (
                /* An unavailable total shows "-", never a misleading ₹0. */
                summaryAvailable ? formatMoney(value) : '-'
              )}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{hint}</div>
          </motion.div>
        ))}
      </div>

      {/* Net-after-refunds, clearly labelled as its own figure */}
      {summaryAvailable && !loading && toFiniteNumber(summary.refunded_amount) !== 0 && (
        <div style={{
          padding: '12px 18px', marginBottom: '20px', borderRadius: '12px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Net receipts after refunds:</strong>{' '}
          {formatMoney(summary.net_after_refunds)}
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}— gross turnover minus refunds recorded in the same period. Turnover above stays gross.
          </span>
        </div>
      )}

      {/* Data-quality warning: never present an incomplete total as reliable */}
      {!loading && !error && dataIssues.count > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 18px', marginBottom: '20px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatNumber(dataIssues.count)} payment record{dataIssues.count === 1 ? '' : 's'} have unusable money values
            </strong>{' '}
            (payment ID{dataIssues.count === 1 ? '' : 's'} {dataIssues.ids.join(', ')}).
            They are excluded from the figures above, so the totals shown are incomplete. These records need data repair.
          </div>
        </div>
      )}

      {/* ── Transactions ────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: '700', color: 'var(--text-primary)' }}>
          Transactions {!loading && !error && `(${formatNumber(payments.length)})`}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['ID', 'Order', 'Client', 'Creator', 'Amount', 'Commission', 'Creator Earns', 'Status', 'Date'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={9} style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '36px', borderRadius: '8px' }} /></td></tr>
                ))
              : payments.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * 0.03 }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>#{p.id}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>#{p.order_id}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{p.client_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{p.creator_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '800', color: 'var(--color-accent)' }}>{formatMoney(p.amount)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-warning)' }}>{formatMoney(p.platform_fee)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-success)' }}>{formatMoney(p.creator_earnings)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: STATUS_STYLES[p.status]?.[0] || '#f1f5f9',
                        color: STATUS_STYLES[p.status]?.[1] || '#475569',
                        borderRadius: '8px', padding: '3px 9px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize',
                      }}>{p.status || '-'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(p.created_at)}</td>
                  </motion.tr>
                ))}
          </tbody>
        </table>

        {/* Empty state — only shown when the load actually succeeded */}
        {!loading && !error && payments.length === 0 && (
          <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Receipt size={40} style={{ opacity: 0.3, marginBottom: '14px' }} />
            <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              No transactions in {summary?.period_label || 'this period'}
            </p>
            <p style={{ fontSize: '13px' }}>Try a different week, month or year.</p>
          </div>
        )}
      </div>

      {/* Turnover definition — so the number is never ambiguous */}
      {summaryAvailable && summary.turnover_definition && (
        <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '820px' }}>
          <strong>Turnover definition:</strong> {summary.turnover_definition}
        </p>
      )}
    </div>
  )
}
