import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { adminAPI, creatorsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Search, Users, AlertTriangle } from 'lucide-react'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getUsers({ search: search || undefined, role: roleFilter || undefined })
      const data = res.data
      setUsers(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed load must not render as "no users found".
      setError(err.response?.data?.detail || err.message || 'Could not load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [roleFilter])

  const handleBlock = async (id, currentlyBlocked) => {
    try {
      if (currentlyBlocked) { await adminAPI.unblockUser(id); toast.success('User unblocked') }
      else { await adminAPI.blockUser(id); toast.success('User blocked') }
      // Refetch instead of flipping local state, so the row shows what was saved.
      await fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change the block status')
    }
  }

  const handleDelete = async (id) => {
    const user = users.find(u => u.id === id)
    if (!window.confirm(
      `Permanently delete ${user?.name || 'this user'} (${user?.email || '#' + id})?\n\n`
      + 'This cannot be undone.'
    )) return
    try {
      await adminAPI.deleteUser(id)
      toast.success('User deleted')
      await fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete this user')
      await fetchUsers()
    }
  }

  const handleRoleChange = async (id, role) => {
    const user = users.find(u => u.id === id)
    // A role change alters what this account can reach, so it is confirmed.
    if (!window.confirm(
      `Change ${user?.name || 'this user'} from ${user?.role} to ${role}?

`
      + 'This changes which parts of the platform they can access.'
    )) {
      await fetchUsers()   // reset the select back to the stored value
      return
    }
    try {
      await adminAPI.changeUserRole(id, role)
      toast.success(`Role changed to ${role}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change the role')
    }
    await fetchUsers()
  }

  const roleBadge = (role) => {
    const map = { admin: ['#fee2e2', '#991b1b', '⚙️'], client: ['#dbeafe', '#1e40af', '🏢'], creator: ['var(--color-accent-subtle)', '#5b21b6', '🎨'] }
    const [bg, color, icon] = map[role] || ['#f1f5f9', '#475569', '']
    return <span style={{ background: bg, color, borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>{icon} {role}</span>
  }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
            <Users size={22} style={{ display: 'inline', marginRight: '10px', color: 'var(--color-accent)' }} />
            User Management
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{users.length} users total</p>
        </div>
      </motion.div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsers()}
            placeholder="Search by name or email..."
            className="input-base" style={{ paddingLeft: '42px' }}
          />
        </div>
        {['', 'client', 'creator', 'admin'].map(r => (
          <button key={r}
            onClick={() => setRoleFilter(r)}
            style={{
              padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
              background: roleFilter === r ? 'var(--color-primary)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: roleFilter === r ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
            }}
          >
            {r || 'All'}
          </button>
        ))}
        <button onClick={fetchUsers} className="btn-gradient" style={{ padding: '10px 20px' }}>Search</button>
      </div>

      {/* Table */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', marginBottom: '20px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px',
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Could not load users</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
          </div>
          <button onClick={fetchUsers} className="btn-gradient" style={{ padding: '9px 18px', fontSize: '13px' }}>Retry</button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={6} style={{ padding: '16px 20px' }}><div className="skeleton" style={{ height: '40px', borderRadius: '8px' }} /></td></tr>
              ))
            ) : users.map((u, i) => (
              <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F766E&color=fff`}
                      alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>{u.email}</td>
                <td style={{ padding: '14px 20px' }}>
                  <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <option value="client">Client</option>
                    <option value="creator">Creator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    background: u.is_blocked ? '#fee2e2' : '#d1fae5',
                    color: u.is_blocked ? '#991b1b' : '#065f46',
                    borderRadius: '10px', padding: '3px 10px', fontSize: '12px', fontWeight: '700'
                  }}>
                    {u.is_blocked ? '🚫 Blocked' : '✓ Active'}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleBlock(u.id, u.is_blocked)}
                      style={{
                        padding: '5px 12px', fontSize: '12px', fontWeight: '600',
                        background: u.is_blocked ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
                        color: u.is_blocked ? '#059669' : '#ef4444',
                        border: 'none', borderRadius: '8px', cursor: 'pointer'
                      }}
                    >
                      {u.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
        )}
      </div>
    </div>
  )
}
