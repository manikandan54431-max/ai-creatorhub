import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Mail, Heart, Zap, Users, Shield, Star } from 'lucide-react'
import Footer from '../../components/layout/Footer'

const CONTACT_EMAIL = 'manikandan54431@gmail.com'
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`

const VALUES = [
  { icon: '🏗️', title: 'Build with Integrity', desc: 'We build tools that are honest, transparent, and do what they say they do.' },
  { icon: '🤝', title: 'Creator & Client First', desc: 'Every platform decision starts with the question: does this help creators and clients succeed?' },
  { icon: '🔒', title: 'Privacy by Default', desc: 'We protect user data, private files, and project communications as a baseline, not an afterthought.' },
  { icon: '📈', title: 'Quality Over Volume', desc: 'We prefer a smaller number of excellent projects and creators over unchecked growth.' },
]

const AREAS = [
  'Platform Engineering (backend, APIs, infrastructure)',
  'Frontend Development (React, design systems, accessibility)',
  'Product Design (UX, workflows, user research)',
  'Trust & Safety (moderation, review processes)',
  'Operations (support, creator onboarding, quality assurance)',
  'Growth & Marketing (content, partnerships)',
]

export default function CareersPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '72px 24px 56px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <h1 style={{ color: 'white', marginBottom: 12, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>Careers at AI CreatorHub</h1>
          <p style={{ opacity: 0.9, maxWidth: 520, margin: '0 auto' }}>
            We are building the infrastructure for responsible AI content commerce.
            If that mission resonates with you, we want to hear from you.
          </p>
        </motion.div>
      </section>

      {/* Open positions */}
      <section style={{ padding: '64px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container-custom" style={{ maxWidth: 700 }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Open Positions</h2>
            <div style={{
              background: 'var(--warning-light)',
              border: '1px solid var(--ms-yellow)',
              borderRadius: 12,
              padding: 24,
              marginTop: 16,
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>No confirmed open positions at the moment</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14, margin: 0 }}>
                We do not currently have confirmed vacancies to advertise. However, we are always open
                to hearing from talented individuals who align with our values and mission.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14, margin: '12px 0 0' }}>
                You can contact us to express interest in future opportunities. We will keep your
                message on file and reach out if a relevant role becomes available.
              </p>
              <div style={{ marginTop: 20 }}>
                <a
                  href={CONTACT_MAILTO}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                >
                  <Mail size={15} />
                  Express Interest via Email
                </a>
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                  {CONTACT_EMAIL}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '64px 24px' }}>
        <div className="container-custom" style={{ maxWidth: 800 }}>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>How We Work</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              These are the principles that guide our decisions and the culture we aim to build.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card"
                style={{ padding: 24 }}
              >
                <div style={{ fontSize: 28, marginBottom: 12 }}>{v.icon}</div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>{v.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Areas of interest */}
      <section style={{ padding: '64px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container-custom" style={{ maxWidth: 700 }}>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Areas of Interest</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              When opportunities arise, they are most likely to be in these areas:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AREAS.map((area, i) => (
                <motion.div
                  key={area}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 14,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ms-blue)', flexShrink: 0 }} />
                  {area}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div className="container-custom" style={{ maxWidth: 560 }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <h2 style={{ marginBottom: 12 }}>Want to Work with Us?</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 28 }}>
              Even without a specific vacancy, we welcome expressions of interest.
              Send us a brief introduction, the area you are interested in, and why
              AI CreatorHub's mission resonates with you.
            </p>
            <a
              href={CONTACT_MAILTO}
              className="btn btn-primary btn-lg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
            >
              <Mail size={16} />
              Get in Touch
            </a>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              {CONTACT_EMAIL}
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
