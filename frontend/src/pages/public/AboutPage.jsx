import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Shield, Users, Sparkles, CheckCircle, ArrowRight, Video, MessageSquare, Star, Zap, Lock, Globe } from 'lucide-react'
import Footer from '../../components/layout/Footer'

const STEPS = [
  { step: '01', title: 'Browse & Discover', desc: 'Explore AI creator profiles, portfolios, and services. Filter by category, tools, and pricing to find the perfect match.', icon: Users },
  { step: '02', title: 'Place Your Order', desc: 'Submit a detailed project brief. An admin will review your requirements and assign the most suitable creator.', icon: Sparkles },
  { step: '03', title: 'Collaborate Securely', desc: 'Communicate with your creator via encrypted project chat. Share references, files, and feedback directly.', icon: MessageSquare },
  { step: '04', title: 'Admin-Verified Delivery', desc: 'When the creator submits the final video, an admin reviews it before you ever see it. Quality, guaranteed.', icon: Shield },
  { step: '05', title: 'Accept & Complete', desc: 'Review the approved delivery, accept it, and release payment. Leave a review to help the creator grow.', icon: CheckCircle },
]

const VALUES = [
  { icon: Shield, title: 'Quality Assurance', desc: 'Every video delivery is reviewed by our admin team before reaching the client. No guesswork, no surprises.' },
  { icon: Lock, title: 'Secure by Design', desc: 'Private project files, authenticated video streaming, and role-based access controls on every endpoint.' },
  { icon: Globe, title: 'AI-Powered Creators', desc: 'Our creator community specializes in cutting-edge AI tools — Runway, ElevenLabs, Suno, Midjourney, and more.' },
  { icon: Star, title: 'Transparent Reviews', desc: 'Honest, verified reviews from real clients help you choose the right creator every time.' },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{
        background: 'var(--gradient-hero)',
        padding: '80px 24px 60px',
        color: 'white',
        textAlign: 'center',
      }}>
        <motion.div {...fadeUp} className="container-custom">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.15)', borderRadius: 20,
            padding: '6px 16px', fontSize: 13, fontWeight: 600,
            marginBottom: 20, backdropFilter: 'blur(8px)',
          }}>
            <Sparkles size={13} />
            About AI CreatorHub
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 20, lineHeight: 1.2 }}>
            Where Brands Meet<br />AI-Powered Creators
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: 640, margin: '0 auto 32px', lineHeight: 1.8 }}>
            AI CreatorHub is a curated marketplace that connects clients with talented creators
            who specialize in AI-powered video and content production. Every project goes
            through a structured, admin-reviewed workflow designed to protect both parties.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/creators" className="btn" style={{ background: 'white', color: 'var(--ms-blue)', fontWeight: 700 }}>
              Browse Creators
            </Link>
            <Link to="/how-it-works" className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              How It Works
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Mission & Vision */}
      <section style={{ padding: '64px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container-custom">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card"
              style={{ padding: 32 }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>Our Mission</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                To make high-quality AI-powered content creation accessible to every brand and business,
                regardless of size. We believe that professional video production should be transparent,
                safe, and reliably high quality — not a gamble.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card"
              style={{ padding: 32 }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>🔭</div>
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>Our Vision</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                A future where AI tools amplify human creativity, and where clients can trust that
                every piece of content they commission has been crafted with care, reviewed for quality,
                and delivered with full accountability. We are building the infrastructure for
                responsible AI content commerce.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section style={{ padding: '64px 24px' }}>
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 48 }}
          >
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 12 }}>What AI CreatorHub Does</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto' }}>
              We are a fully managed marketplace, not just a directory. Here is exactly how we add value to every project.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              { icon: '🔍', title: 'Creator Discovery', desc: 'Search and filter verified AI creators by category, tools, rating, and price.' },
              { icon: '📋', title: 'Admin Assignment', desc: 'Our admin team reviews your brief and assigns the best-fit creator for your project.' },
              { icon: '💬', title: 'Project Chat', desc: 'Collaborate securely via project-specific chat. Share files, references, and feedback.' },
              { icon: '🎬', title: 'Video Delivery Review', desc: 'Creator submissions are reviewed by an admin before you see them. No unverified content.' },
              { icon: '💳', title: 'Secure Payments', desc: 'Funds are held securely until delivery is accepted. Your money is protected.' },
              { icon: '⭐', title: 'Verified Reviews', desc: 'Leave and read honest reviews tied to real completed orders. No fake testimonials.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card"
                style={{ padding: 24, textAlign: 'center' }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Steps */}
      <section style={{ padding: '64px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 48 }}
          >
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 12 }}>The Platform Process</h2>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680, margin: '0 auto' }}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
              >
                <div style={{
                  width: 44, height: 44, flexShrink: 0,
                  background: 'var(--gradient-hero)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: 13,
                }}>
                  {s.step}
                </div>
                <div>
                  <h3 style={{ fontSize: 15, marginBottom: 6 }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '64px 24px' }}>
        <div className="container-custom">
          <motion.div style={{ textAlign: 'center', marginBottom: 48 }}
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 12 }}>Platform Values</h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {VALUES.map((v, i) => (
              <motion.div key={v.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="card" style={{ padding: 24 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--ms-blue-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  <v.icon size={20} color="var(--ms-blue)" />
                </div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>{v.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '64px 24px',
        background: 'var(--gradient-hero)',
        color: 'white',
        textAlign: 'center',
      }}>
        <div className="container-custom">
          <h2 style={{ color: 'white', fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 16 }}>
            Ready to Get Started?
          </h2>
          <p style={{ opacity: 0.9, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
            Whether you are a client looking for AI video content or a creator ready to take on projects,
            AI CreatorHub is built for you.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn" style={{ background: 'white', color: 'var(--ms-blue)', fontWeight: 700 }}>
              Create an Account
            </Link>
            <Link to="/creators" className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              Browse Creators <ArrowRight size={14} style={{ display: 'inline' }} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
