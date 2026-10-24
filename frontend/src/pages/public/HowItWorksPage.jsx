import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Search, UserCheck, Sparkles, ShoppingBag, MessageSquare, CheckCircle, Star, Zap, Shield, TrendingUp, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    num: '01', icon: Search, color: 'var(--color-accent)',
    title: 'Browse AI Creators',
    desc: 'Explore 5,000+ verified AI-powered content creators. Filter by category, AI tools, price, and rating to find your perfect match.',
    detail: 'Search and filter by category, AI tools, budget and rating to shortlist the creators that fit your brand and project needs.'
  },
  {
    num: '02', icon: MessageSquare, color: 'var(--color-accent)',
    title: 'Connect & Discuss',
    desc: 'Chat directly with creators in real-time using our secure messaging platform. Share your brief, ask questions, and align on vision.',
    detail: 'Our platform keeps all communication on-record, so you and the creator always have a shared history of what was agreed.'
  },
  {
    num: '03', icon: ShoppingBag, color: 'var(--color-warning)',
    title: 'Place an Order',
    desc: 'Submit a detailed project brief and set your budget. Funds are held securely in escrow until you approve the final delivery.',
    detail: 'Describe your goals, deliverables, deadline and budget in the brief so the creator has everything needed to start.'
  },
  {
    num: '04', icon: Sparkles, color: 'var(--color-success)',
    title: 'Get AI Content',
    desc: 'Creators deliver studio-quality AI-generated content — videos, images, UGC ads, voiceovers, and more — on time.',
    detail: 'Request revisions directly in the platform. The creator can submit up to your agreed number of revision rounds.'
  },
  {
    num: '05', icon: CheckCircle, color: '#06b6d4',
    title: 'Review & Approve',
    desc: 'Review delivered content, request revisions if needed, and approve when satisfied. Funds are released to the creator only on approval.',
    detail: 'If anything goes wrong, our dispute resolution team steps in within 24 hours to mediate and find a fair solution.'
  },
  {
    num: '06', icon: Star, color: 'var(--color-accent)',
    title: 'Leave a Review',
    desc: 'Rate your experience and help other brands find great creators. Build long-term relationships with creators you trust.',
    detail: 'Your reviews help the community and earn you VIP status after 10+ successful collaborations.'
  },
]

const FEATURES = [
  { icon: Shield, title: 'Secure Escrow Payments', desc: 'Your money is safe. Funds are only released when you approve the delivery.', color: 'var(--color-accent)' },
  { icon: Zap, title: 'Find the Right Creator', desc: 'Filter by category, AI tools, budget and rating to shortlist creators aligned with your goals.', color: 'var(--color-warning)' },
  { icon: UserCheck, title: 'Verified Creators Only', desc: 'Every creator is vetted, verified, and rated by real clients.', color: 'var(--color-success)' },
  { icon: TrendingUp, title: 'Real-Time Analytics', desc: 'Track orders, spending, and creator performance from your dashboard.', color: 'var(--color-accent)' },
]

export default function HowItWorksPage() {
  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingTop: '80px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 24px 80px', maxWidth: '800px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '20px',
            background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontSize: '13px', fontWeight: '600', marginBottom: '20px',
            border: '1px solid var(--color-accent-subtle)' }}>
            <Sparkles size={14} /> How AI CreatorHub Works
          </span>
          <h1 style={{ fontSize: '48px', fontWeight: '900', lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: '20px' }}>
            From Brief to <span style={{ background: 'var(--color-surface-muted)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Stunning Content</span><br />in 6 Simple Steps
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '32px' }}>
            AI CreatorHub connects brands with the world's best AI content creators. Our platform makes collaboration effortless, secure, and scalable.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/creators" style={{ padding: '14px 32px', borderRadius: '14px', textDecoration: 'none',
              background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '15px',
              boxShadow: '0 8px 24px rgba(15,118,110,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Browse Creators <ArrowRight size={16} />
            </Link>
            <Link to="/register" style={{ padding: '14px 32px', borderRadius: '14px', textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px',
              border: '1px solid var(--border)' }}>
              Join as Creator
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Steps */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' }}>The Process, Step by Step</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {STEPS.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="card" style={{ padding: '28px 32px', display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: `${step.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                  <step.icon size={26} color={step.color} />
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '800', color: step.color, opacity: 0.5 }}>{step.num}</div>
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '8px' }}>{step.desc}</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>💡 {step.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ background: 'var(--bg-secondary)', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '12px' }}>Why Choose AI CreatorHub?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Built for brands who demand quality, speed, and trust.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '20px' }}>
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${f.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Ready to get started?
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginBottom: '32px' }}>
            Join thousands of brands already creating amazing content with AI creators.
          </p>
          <Link to="/register" style={{ padding: '16px 40px', borderRadius: '16px', textDecoration: 'none',
            background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)', fontWeight: '700', fontSize: '16px',
            boxShadow: '0 8px 30px rgba(15,118,110,0.25)', display: 'inline-block' }}>
            Create Free Account →
          </Link>
        </motion.div>
      </div>
    </div>
  )
}