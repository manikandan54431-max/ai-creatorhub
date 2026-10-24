import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore, useThemeStore } from '../../store'
import {
  LayoutDashboard, Users, Star, ShoppingBag, GitBranch, MessageSquare,
  CreditCard, FileText, AlertTriangle, Settings, LogOut,
  Sparkles, Sun, Moon, Menu, X, Shield, Video, LifeBuoy
} from 'lucide-react'

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/creators', icon: Star, label: 'Creators' },
  { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/admin/video-approvals', icon: Video, label: 'Video Approvals' },
  { path: '/admin/support', icon: LifeBuoy, label: 'Support Tickets' },
  { path: '/admin/assignments', icon: GitBranch, label: 'Assignments' },
  { path: '/admin/chats', icon: MessageSquare, label: 'Chat Monitor' },
  { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { path: '/admin/reviews', icon: FileText, label: 'Reviews' },
  { path: '/admin/disputes', icon: AlertTriangle, label: 'Disputes' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path
    return location.pathname.startsWith(item.path)
  }

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-background)', overflow: 'hidden' }}>

      {/* ─── Mobile toggle button ─── */}
      <button
        className="admin-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open admin menu"
      >
        <Menu size={20} />
      </button>

      {/* ─── Mobile overlay ─── */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <div
        className={`admin-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        style={{
          width: collapsed ? 64 : 240,
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          transition: 'width 0.25s ease',
          zIndex: 40, height: '100vh', position: 'relative'
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '18px 14px', borderBottom: '1px solid #2A333C',
          display: 'flex', alignItems: 'center', gap: '10px',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 62
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--color-accent)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={14} color="white" />
              </div>
              <span style={{ fontWeight: '700', color: '#E8EDF2', fontSize: '14px', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>Admin Panel</span>
            </div>
          )}
          {collapsed && (
            <div style={{ width: '28px', height: '28px', background: 'var(--color-accent)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="white" />
            </div>
          )}
          <button
            onClick={() => { setCollapsed(!collapsed); setMobileOpen(false) }}
            style={{ background: 'none', border: 'none', color: '#5C6D79', cursor: 'pointer', padding: '4px', flexShrink: 0, display: 'flex' }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
              <div
                className={`admin-nav-item ${isActive(item) ? 'active' : ''}`}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                title={collapsed ? item.label : ''}
              >
                <item.icon size={18} />
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid #2A333C', padding: '10px' }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="admin-nav-item"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', fontFamily: 'inherit' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && <span>Toggle Theme</span>}
          </button>

          {/* User Info */}
          {!collapsed && (
            <div style={{ margin: '8px 0', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield size={13} color="white" />
                </div>
                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#E8EDF2', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#5C6D79' }}>Super Admin</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="admin-nav-item"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#f87171', justifyContent: collapsed ? 'center' : 'flex-start', fontFamily: 'inherit' }}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div
        className="admin-main-content"
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
