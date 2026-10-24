import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore, useThemeStore, useNotificationStore } from '../../store'
import { notificationsAPI } from '../../services/api'
import {
  Sun, Moon, Bell, Menu, X, ChevronDown, LogOut, User, Settings,
  Sparkles, LayoutDashboard, Home, Users, HelpCircle, Package,
  CreditCard, Heart, MessageCircle, Star, Briefcase, Film, Clapperboard
} from 'lucide-react'

const categories = [
  'AI Video Creation', 'AI Image Generation', 'UGC Ads',
  'Instagram Reels', 'YouTube Shorts', 'AI Animation',
  'Voiceover', 'Prompt Engineering'
]

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { notifications, unreadCount, setNotifications } = useNotificationStore()
  const [catOpen, setCatOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const mobileDrawerRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      notificationsAPI.getAll().then(r => setNotifications(r.data)).catch(() => {})
    }
  }, [isAuthenticated])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
    setCatOpen(false)
    setUserMenuOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const getDashboardLink = () => {
    if (user?.role === 'admin') return '/admin'
    if (user?.role === 'creator') return '/creator/dashboard'
    return '/client/dashboard'
  }

  const isActive = (path) => location.pathname === path ? 'active' : ''

  const closeAll = () => {
    setCatOpen(false); setUserMenuOpen(false); setNotifOpen(false)
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100 }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: 'var(--color-surface)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
        }}
      >
        <div className="container-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '70px' }}>

            {/* Logo */}
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div className="navbar-logo-icon" style={{
                width: '32px', height: '32px',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={16} color="#FFFFFF" />
              </div>
              <span style={{
                fontWeight: 700, fontSize: '16px',
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.01em'
              }}>
                AI CreatorHub
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="nav-links">
              <Link to="/" className={`nav-link ${isActive('/')}`}>Home</Link>
              <Link to="/creators" className={`nav-link ${isActive('/creators')}`}>Explore Creators</Link>

              {/* Categories Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="nav-link"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setCatOpen(!catOpen)}
                >
                  Categories <ChevronDown size={14} />
                </button>
                {catOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      position: 'absolute', top: '100%', left: 0,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px', padding: '8px',
                      minWidth: '220px', boxShadow: 'var(--shadow-xl)', zIndex: 100
                    }}
                  >
                    {categories.map((cat) => (
                      <Link
                        key={cat}
                        to={`/creators?category=${encodeURIComponent(cat)}`}
                        onClick={() => setCatOpen(false)}
                        style={{
                          display: 'block', padding: '8px 14px',
                          color: 'var(--color-text-secondary)',
                          textDecoration: 'none', fontSize: '13px', fontWeight: '500',
                          borderRadius: '8px', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-subtle)'; e.currentTarget.style.color = 'var(--color-accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
                      >
                        {cat}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </div>

              <Link to="/how-it-works" className={`nav-link ${isActive('/how-it-works')}`}>How It Works</Link>
            </div>

            {/* Right Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                aria-label="Toggle theme"
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-secondary)', flexShrink: 0
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </motion.button>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <div style={{ position: 'relative' }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false) }}
                      aria-label="Notifications"
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-secondary)', position: 'relative', flexShrink: 0
                      }}
                    >
                      <Bell size={16} />
                      {unreadCount > 0 && (
                        <span style={{
                          position: 'absolute', top: '-4px', right: '-4px',
                          background: '#ef4444', color: 'white',
                          borderRadius: '10px', fontSize: '10px', fontWeight: '700',
                          padding: '1px 5px', minWidth: '16px', textAlign: 'center',
                          lineHeight: 1.4
                        }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </motion.button>

                    {notifOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="notif-panel"
                        style={{
                          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                          width: '320px', background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '14px', boxShadow: 'var(--shadow-xl)', zIndex: 100, overflow: 'hidden'
                        }}
                      >
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '14px' }}>Notifications</span>
                          {unreadCount > 0 && <span className="badge badge-info">{unreadCount} new</span>}
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              No notifications
                            </div>
                          ) : (
                            notifications.slice(0, 8).map((n) => (
                              <div key={n.id} style={{
                                padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                                background: n.is_read ? 'transparent' : 'var(--color-accent-subtle)', cursor: 'pointer'
                              }}>
                                <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--color-text-primary)' }}>{n.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{n.message}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* User Menu */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px', padding: '5px 10px 5px 5px',
                        cursor: 'pointer', color: 'var(--color-text-primary)', flexShrink: 0,
                        fontFamily: 'inherit'
                      }}
                    >
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={14} color="#FFFFFF" />
                        </div>
                      )}
                      <span style={{ fontSize: '13px', fontWeight: '600', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name?.split(' ')[0]}
                      </span>
                      <ChevronDown size={12} />
                    </button>

                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        style={{
                          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '14px', padding: '8px',
                          minWidth: '200px', boxShadow: 'var(--shadow-xl)', zIndex: 100
                        }}
                      >
                        <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: '6px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-primary)' }}>{user?.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{user?.role} Account</div>
                        </div>
                        <Link to={getDashboardLink()} style={menuItemStyle} onClick={() => setUserMenuOpen(false)}>
                          <LayoutDashboard size={14} /> Dashboard
                        </Link>
                        <Link to="/profile" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}>
                          <User size={14} /> My Profile
                        </Link>
                        {user?.role === 'creator' && (
                          <>
                            <div style={{ height: '1px', background: 'var(--color-border)', margin: '6px 0' }} />
                            <Link to="/creator/profile" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Settings size={14} /> Edit Creator Profile</Link>
                            <Link to="/creator/portfolio" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><span>🖼️</span> Portfolio</Link>
                            <Link to="/creator/services" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><span>🛠️</span> Services</Link>
                            <Link to="/creator/orders" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Package size={14} /> My Orders</Link>
                            <Link to="/creator/editing-requests" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Film size={14} /> Editing Requests</Link>
                            <Link to="/creator/reviews" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Star size={14} /> My Reviews</Link>
                          </>
                        )}
                        {user?.role === 'client' && (
                          <>
                            <div style={{ height: '1px', background: 'var(--color-border)', margin: '6px 0' }} />
                            <Link to="/client/orders" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Package size={14} /> My Orders</Link>
                            <Link to="/client/editing-requests" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Film size={14} /> Editing Requests</Link>
                            <Link to="/client/payments" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><CreditCard size={14} /> Payments</Link>
                            <Link to="/client/saved" style={menuItemStyle} onClick={() => setUserMenuOpen(false)}><Heart size={14} /> Saved Creators</Link>
                          </>
                        )}
                        <div style={{ height: '1px', background: 'var(--color-border)', margin: '6px 0' }} />
                        <button onClick={handleLogout} style={{ ...menuItemStyle, width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontFamily: 'inherit' }}>
                          <LogOut size={14} /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }} className="nav-links">
                  <Link to="/login">
                    <button style={{
                      padding: '7px 16px', background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px', color: 'var(--color-text-primary)',
                      fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit'
                    }}>Login</button>
                  </Link>
                  <Link to="/register" className="nav-links">
                    <button className="btn-gradient" style={{ padding: '7px 16px', fontSize: '14px' }}>Get Started</button>
                  </Link>
                </div>
              )}

              {/* Mobile hamburger */}
              <button
                className="nav-mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Backdrop for desktop dropdowns */}
        {(catOpen || userMenuOpen || notifOpen) && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={closeAll} />
        )}
      </motion.nav>

      {/* ─── Mobile Drawer Overlay ─── */}
      <div
        className={`nav-drawer-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ─── Mobile Drawer ─── */}
      <div className={`nav-mobile-drawer ${mobileOpen ? 'open' : ''}`} ref={mobileDrawerRef}>
        {/* Drawer Header */}
        <div className="nav-drawer-header">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setMobileOpen(false)}>
            <div className="navbar-logo-icon" style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="#FFFFFF" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)' }}>AI CreatorHub</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', display: 'flex' }}>
            <X size={22} />
          </button>
        </div>

        {/* Theme toggle in drawer */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button onClick={toggleTheme} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
            background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)',
            borderRadius: '8px', cursor: 'pointer', color: 'var(--color-text-primary)',
            fontSize: '13px', fontWeight: '500', fontFamily: 'inherit'
          }}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Navigation links */}
        <Link to="/" className={`nav-drawer-link ${isActive('/')}`} onClick={() => setMobileOpen(false)}>
          <Home size={18} /> Home
        </Link>
        <Link to="/creators" className={`nav-drawer-link ${isActive('/creators')}`} onClick={() => setMobileOpen(false)}>
          <Users size={18} /> Explore Creators
        </Link>
        <Link to="/how-it-works" className={`nav-drawer-link ${isActive('/how-it-works')}`} onClick={() => setMobileOpen(false)}>
          <HelpCircle size={18} /> How It Works
        </Link>

        {/* Categories section */}
        <div style={{ padding: '12px 18px 6px', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-muted)' }}>
          Categories
        </div>
        {categories.map((cat) => (
          <Link
            key={cat}
            to={`/creators?category=${encodeURIComponent(cat)}`}
            className="nav-drawer-link"
            onClick={() => setMobileOpen(false)}
            style={{ fontSize: '14px', paddingLeft: '24px' }}
          >
            {cat}
          </Link>
        ))}

        {/* Auth section */}
        {isAuthenticated ? (
          <>
            <div style={{ padding: '12px 18px 6px', fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-muted)' }}>
              Account — {user?.name}
            </div>
            <Link to={getDashboardLink()} className="nav-drawer-link" onClick={() => setMobileOpen(false)}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
            <Link to="/profile" className="nav-drawer-link" onClick={() => setMobileOpen(false)}>
              <User size={18} /> My Profile
            </Link>
            {user?.role === 'creator' && (
              <>
                <Link to="/creator/profile" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Settings size={18} /> Creator Profile</Link>
                <Link to="/creator/orders" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Package size={18} /> My Orders</Link>
                <Link to="/creator/editing-requests" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Film size={18} /> Editing Requests</Link>
                <Link to="/creator/video-studio" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Clapperboard size={18} /> Video Studio</Link>
                <Link to="/creator/ai-generator" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Sparkles size={18} /> AI Generator</Link>
                <Link to="/creator/gemini-assistant" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><MessageCircle size={18} /> Gemini Assistant</Link>
              </>
            )}
            {user?.role === 'client' && (
              <>
                <Link to="/client/orders" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Package size={18} /> My Orders</Link>
                <Link to="/client/editing-requests" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><Film size={18} /> Editing Requests</Link>
                <Link to="/client/chat" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><MessageCircle size={18} /> Chat</Link>
                <Link to="/client/payments" className="nav-drawer-link" onClick={() => setMobileOpen(false)}><CreditCard size={18} /> Payments</Link>
              </>
            )}
            <button
              onClick={() => { handleLogout(); setMobileOpen(false) }}
              className="nav-drawer-link"
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontFamily: 'inherit', textAlign: 'left', justifyContent: 'flex-start' }}
            >
              <LogOut size={18} /> Sign Out
            </button>
          </>
        ) : (
          <>
            <div style={{ padding: '16px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
              <Link to="/login" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
                <button style={{ width: '100%', padding: '11px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', fontWeight: '600', fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>Login</button>
              </Link>
              <Link to="/register" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
                <button className="btn-gradient" style={{ width: '100%', padding: '11px', fontSize: '15px' }}>Get Started Free</button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '9px 14px', color: 'var(--color-text-secondary)',
  textDecoration: 'none', fontSize: '13px', fontWeight: '500',
  borderRadius: '8px', transition: 'all 0.15s', cursor: 'pointer'
}
