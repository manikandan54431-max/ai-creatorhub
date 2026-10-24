/**
 * Navigation bar for the full-screen Video Studio routes.
 *
 * The Studio renders without the site Navbar, so it has to carry its own exits:
 * Back (to a known in-app location), Creator Dashboard, and Home. Without these
 * the Studio is a dead end reachable only via browser Back.
 */
import { Link } from 'react-router-dom'
import { ChevronLeft, LayoutDashboard, Home } from 'lucide-react'
import { useInAppBack } from '../../hooks/useInAppBack'

const CREATOR_DASHBOARD = '/creator/dashboard'

export default function StudioNav({
  /** Skip recorded routes under this prefix (e.g. '/creator/video-studio'). */
  excludePrefix,
  /** Return false to cancel navigation — unsaved changes, active export, etc. */
  confirmLeave,
  /** Rendered between the exits and the right-hand side. */
  children,
  /** Dark toolbar styling for the editor; light for the project list. */
  variant = 'light',
  /** Extra styles for the wrapper. */
  style,
}) {
  const { goBack, backTarget } = useInAppBack(CREATOR_DASHBOARD, { excludePrefix, confirmLeave })

  const dark = variant === 'dark'
  const btn = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, textDecoration: 'none',
    background: dark ? 'rgba(255,255,255,0.06)' : 'var(--bg-secondary)',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'var(--border-color)'}`,
    color: dark ? '#e2e8f0' : 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  }

  /** Guard plain <Link> clicks with the same confirmation as Back. */
  const guard = (e) => {
    if (confirmLeave && confirmLeave() === false) e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...style }}>
      <button
        type="button"
        onClick={goBack}
        style={btn}
        title={`Back to ${backTarget}`}
        aria-label="Go back"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <Link to={CREATOR_DASHBOARD} onClick={guard} style={btn}>
        <LayoutDashboard size={15} /> Creator Dashboard
      </Link>

      <Link to="/" onClick={guard} style={{ ...btn, padding: '7px 10px' }} title="Home" aria-label="Home">
        <Home size={15} />
      </Link>

      {children}
    </div>
  )
}
