import { Link } from 'react-router-dom'
import { Sparkles, Phone, Mail } from 'lucide-react'

const SUPPORT_EMAIL = 'manikandan54431@gmail.com'
const SUPPORT_PHONE = '+91 6380994709'
const SUPPORT_TEL = 'tel:+916380994709'
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`

const footerLinks = {
  Platform: [
    { label: 'Browse Creators', to: '/creators' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'About Us', to: '/about' },
    { label: 'Blog', to: '/blog' },
  ],
  Support: [
    { label: 'Help Center', to: '/help-center' },
    { label: 'Contact Us', to: '/contact' },
    { label: 'Support Tickets', to: '/support' },
    { label: 'Careers', to: '/careers' },
  ],
  Legal: [
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Terms of Service', to: '/terms-of-service' },
  ],
}

/* Footer uses a fixed dark background — all text/link colors are hardcoded dark-mode values */
export default function Footer() {
  return (
    <footer style={{
      background: '#14191E',
      color: '#8A9BA8',
      borderTop: '1px solid #2A333C',
      padding: '48px 24px 24px',
      marginTop: 'auto',
    }}>
      <div className="container-custom">
        {/* Grid */}
        <div className="footer-grid" style={{ marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                width: 30, height: 30,
                background: 'var(--color-accent)',
                borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={15} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#E8EDF2', letterSpacing: '-0.01em' }}>AI CreatorHub</span>
            </Link>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: '#5C6D79', maxWidth: 260, marginBottom: 20 }}>
              The premier marketplace connecting brands with AI-powered content creators worldwide.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <a href={SUPPORT_TEL} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8A9BA8', fontSize: 13, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#8DD3C3'}
                onMouseLeave={e => e.currentTarget.style.color = '#8A9BA8'}>
                <Phone size={13} />
                {SUPPORT_PHONE}
              </a>
              <a href={SUPPORT_MAILTO} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8A9BA8', fontSize: 13, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#8DD3C3'}
                onMouseLeave={e => e.currentTarget.style.color = '#8A9BA8'}>
                <Mail size={13} />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          {/* Link Groups */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 style={{ color: '#E8EDF2', fontSize: 12, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {group}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      style={{ color: '#8A9BA8', textDecoration: 'none', fontSize: 13, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#8DD3C3'}
                      onMouseLeave={e => e.currentTarget.style.color = '#8A9BA8'}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid #2A333C',
          paddingTop: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <p style={{ fontSize: 12, color: '#435060', margin: 0 }}>
            © {new Date().getFullYear()} AI CreatorHub. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link to="/privacy-policy" style={{ fontSize: 12, color: '#435060', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/terms-of-service" style={{ fontSize: 12, color: '#435060', textDecoration: 'none' }}>Terms</Link>
            <Link to="/contact" style={{ fontSize: 12, color: '#435060', textDecoration: 'none' }}>Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
