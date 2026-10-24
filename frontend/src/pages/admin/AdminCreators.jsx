import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'
import { formatMoney, formatNumber, formatRating, formatDate } from '../../utils/format'

export default function AdminCreators() {
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  // Actions in flight, keyed as `${creatorId}:${action}` so a button cannot be
  // fired twice and conflicting actions on one row are blocked together.
  const [busy, setBusy] = useState({})

  const fetchCreators = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getCreators({ status: statusFilter || undefined })
      const data = res.data
      setCreators(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed load must not look like "no creators".
      setError(err.response?.data?.detail || err.message || 'Could not load creators')
      setCreators([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCreators() }, [statusFilter])

  const isBusy = (id) => Object.keys(busy).some(k => k.startsWith(`${id}:`) && busy[k])

  /**
   * Run an admin action and reconcile the UI with the database.
   *
   * The list is refetched on success, so what is displayed is what was actually
   * persisted - the button appearance never changes on its own. Duplicate and
   * conflicting requests for the same row are blocked while one is in flight.
   */
  const action = async (key, id, fn, { confirm } = {}) => {
    const flag = `${id}:${key}`
    if (isBusy(id)) return
    if (confirm && !window.confirm(confirm)) return
    setBusy(b => ({ ...b, [flag]: true }))
    try {
      const res = await fn()
      const msg = res?.data?.message || 'Done'
      if (res?.data?.changed === false) toast(msg)
      else toast.success(msg)
      await fetchCreators()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Action failed')
    } finally {
      setBusy(b => {
        const next = { ...b }
        delete next[flag]
        return next
      })
    }
  }

  const statusBadge = (s) => {
    const map = {
      approved: ['#d1fae5', '#065f46'],
      pending: ['#fef3c7', '#92400e'],
      rejected: ['#fee2e2', '#991b1b'],
      suspended: ['#f1f5f9', '#475569'],
    }
    const [bg, color] = map[s] || ['#f1f5f9', '#475569']
    return <span style={{ background: bg, color, borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' }}>{s}</span>
  }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
          🎨 Creator Management
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>{creators.length} creators total</p>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {['', 'pending', 'approved', 'rejected', 'suspended'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '9px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
              background: statusFilter === s ? 'var(--color-primary)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: statusFilter === s ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
            }}
          >
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
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Could not load creators</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
          </div>
          <button onClick={fetchCreators} className="btn-gradient" style={{ padding: '9px 18px', fontSize: '13px' }}>Retry</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['Creator', 'Category', 'Rating', 'Orders', 'Price', 'Status', 'Verified', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={8} style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '40px', borderRadius: '8px' }} /></td></tr>
              ))
            ) : creators.map((c, i) => (
              <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0F766E&color=fff`}
                      alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{c.category || '—'}</td>
                <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-warning)', fontSize: '13px' }}>⭐ {formatRating(c.rating)}</td>
                <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{formatNumber(c.total_orders)}</td>
                <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-accent)', fontSize: '13px' }}>{formatMoney(c.starting_price)}</td>
                <td style={{ padding: '14px 16px' }}>{statusBadge(c.approval_status)}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    background: c.is_verified ? '#d1fae5' : '#f1f5f9',
                    color: c.is_verified ? '#065f46' : 'var(--color-text-muted)',
                    borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700'
                  }}>
                    {c.is_verified ? '✓ Verified' : 'Unverified'}
                  </span>
                  {c.is_verified && c.verified_at && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {formatDate(c.verified_at)}{c.verified_by_name ? ` · ${c.verified_by_name}` : ''}
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {c.approval_status === 'pending' && (
                      <>
                        <button
                          disabled={isBusy(c.id)}
                          onClick={() => action('approve', c.id, () => adminAPI.approveCreator(c.id))}
                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'rgba(5,150,105,0.1)', color: 'var(--color-success)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                          ✓ Approve
                        </button>
                        <button
                          disabled={isBusy(c.id)}
                          onClick={() => action('reject', c.id, () => adminAPI.rejectCreator(c.id), { confirm: `Reject ${c.name}'s creator profile?` })}
                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {/* Explicit intent, not a blind toggle - so a double click
                        cannot flip the badge back. */}
                    <button
                      disabled={isBusy(c.id)}
                      title={c.is_verified && c.verified_at
                        ? `Verified ${formatDate(c.verified_at, { withTime: true })}${c.verified_by_name ? ` by ${c.verified_by_name}` : ''}`
                        : 'Set the marketplace verified badge'}
                      onClick={() => action('verify', c.id, () => adminAPI.verifyCreator(c.id, !c.is_verified))}
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                      {c.is_verified ? 'Unverify' : 'Verify'}
                    </button>
                    <button
                      disabled={isBusy(c.id)}
                      onClick={() => action('feature', c.id, () => adminAPI.featureCreator(c.id))}
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                      {c.is_featured ? '★ Unfeature' : '★ Feature'}
                    </button>
                    {c.approval_status === 'suspended' ? (
                      <button
                        disabled={isBusy(c.id)}
                        onClick={() => action('unsuspend', c.id, () => adminAPI.unsuspendCreator(c.id))}
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'rgba(5,150,105,0.1)', color: 'var(--color-success)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        disabled={isBusy(c.id)}
                        onClick={() => action('suspend', c.id, () => adminAPI.suspendCreator(c.id), { confirm: `Suspend ${c.name}? Their profile will be hidden from the marketplace.` })}
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: 'none', borderRadius: '6px', cursor: isBusy(c.id) ? 'default' : 'pointer', opacity: isBusy(c.id) ? 0.5 : 1 }}>
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && creators.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>No creators found</p>
            <p style={{ fontSize: '13px' }}>
              {statusFilter ? `No creator profiles with status "${statusFilter}".` : 'There are no creator profiles in the database.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
