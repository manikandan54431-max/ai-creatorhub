import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'
import {
  Sparkles, Star, TrendingUp, Users, CheckCircle, ArrowRight,
  Play, Zap, Shield, Clock, MessageCircle, Search
} from 'lucide-react'
import { creatorsAPI, publicAPI } from '../../services/api'
import { useState } from 'react'
import { formatMoney } from '../../utils/format'

const categories = [
  { name: 'AI Video Creation', icon: '🎬', desc: 'Cinematic AI videos & brand films', color: 'var(--color-accent)' },
  { name: 'AI Image Generation', icon: '🎨', desc: 'Product visuals & AI artwork', color: 'var(--color-accent)' },
  { name: 'UGC Ads', icon: '📱', desc: 'High-converting user-generated content', color: 'var(--color-accent)' },
  { name: 'Instagram Reels', icon: '📸', desc: 'Scroll-stopping short-form content', color: 'var(--color-warning)' },
  { name: 'YouTube Shorts', icon: '▶️', desc: 'Viral YouTube short videos', color: 'var(--color-danger)' },
  { name: 'AI Animation', icon: '✨', desc: '2D/3D animated explainers & ads', color: '#06b6d4' },
  { name: 'Voiceover', icon: '🎙️', desc: 'Multilingual AI voiceovers', color: 'var(--color-success)' },
  { name: 'Prompt Engineering', icon: '🤖', desc: 'AI workflow design & automation', color: '#8b5cf6' },
]

const steps = [
  { icon: Search, title: 'Browse Creators', desc: 'Explore AI creators filtered by skill, category, price and rating' },
  { icon: Users, title: 'View Portfolio', desc: 'Review stunning AI-generated portfolios and compare packages' },
  { icon: MessageCircle, title: 'Chat with Creator', desc: 'Discuss your project requirements via real-time chat' },
  { icon: CheckCircle, title: 'Place Order', desc: 'Submit your brief, set deadline and make secure payment' },
  { icon: Zap, title: 'Receive Delivery', desc: 'Get your AI-powered content delivered on time' },
  { icon: Star, title: 'Give Review', desc: 'Rate your experience and help the community grow' },
]

const testimonials = []

const faqs = [
  { q: 'What is AI CreatorHub?', a: 'AI CreatorHub is a marketplace connecting brands with specialized AI content creators. Our creators use cutting-edge AI tools to produce high-quality videos, images, animations, and more.' },
  { q: 'How does the payment work?', a: 'Payments are held in escrow until you approve the delivery. Platform takes a 20% commission. Creators receive 80% of the project budget.' },
  { q: 'What if I\'m not satisfied with the delivery?', a: 'You can request revisions as per the package. For major issues, you can raise a dispute and our admin team will resolve it fairly.' },
  { q: 'How are creators verified?', a: 'All creators go through a manual review process. Verified badges are given to creators with proven track records and quality portfolios.' },
  { q: 'Can I hire creators for ongoing projects?', a: 'Absolutely! You can chat with creators, negotiate long-term contracts, and place multiple orders.' },
]

function CountUp({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, end, duration])
  
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

export default function HomePage() {
  const [featured, setFeatured] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    creatorsAPI.getFeatured().then(r => setFeatured(r.data)).catch(() => {})
    publicAPI.getStats().then(r => setStats(r.data)).catch(() => {})
  }, [])

  return (
    <div style={{ background: 'var(--bg-primary)' }}>

      {/* ─── Hero Section ─────────────────────────────────────────── */}
      <section style={{
        minHeight: '92vh',
        display: 'flex', alignItems: 'center',
        background: 'var(--gradient-hero)',
        color: 'white',
        position: 'relative', overflow: 'hidden',
        paddingTop: '70px'
      }}>

        <div className="container-custom" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
          <div className="hero-grid">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.85)', borderRadius: '6px', padding: '5px 14px',
                  fontSize: '12px', fontWeight: '600', marginBottom: '24px',
                  letterSpacing: '0.02em', textTransform: 'uppercase'
                }}>
                  <Sparkles size={12} />
                  AI Creator Marketplace
                </span>

                <h1 style={{
                  fontSize: '54px', fontWeight: '800', lineHeight: '1.1',
                  color: 'white', marginBottom: '24px', letterSpacing: '-0.02em'
                }}>
                  Hire AI-Powered Creators for Your{' '}
                  <span style={{ color: 'var(--color-accent)' }}>
                    Brand Content
                  </span>
                </h1>

                <p style={{
                  fontSize: '18px', color: 'rgba(255,255,255,0.85)', marginBottom: '36px',
                  lineHeight: '1.7', maxWidth: '500px'
                }}>
                  Find expert AI video creators, image creators, UGC creators, animators and prompt engineers.
                  AI-powered content, delivered on time.
                </p>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
                  <Link to="/creators">
                    <motion.button
                      whileHover={{ opacity: 0.9 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn-gradient"
                      style={{ padding: '13px 28px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      Explore Creators <ArrowRight size={16} />
                    </motion.button>
                  </Link>
                  <Link to="/register?role=creator">
                    <motion.button
                      whileHover={{ opacity: 0.85 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '13px 28px', fontSize: '15px', fontWeight: '600',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '6px', color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'all 0.2s', fontFamily: 'inherit'
                      }}
                    >
                      <Zap size={16} /> Become a Creator
                    </motion.button>
                  </Link>
                </div>

                {/* Quick Search */}
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  maxWidth: '460px'
                }}>
                  <Search size={16} color="rgba(255,255,255,0.6)" style={{ marginLeft: '8px' }} />
                  <input
                    placeholder="Search AI video creator, reels, UGC..."
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: 'white', fontSize: '14px', padding: '7px 0'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') window.location.href = `/creators?search=${e.target.value}`
                    }}
                  />
                  <Link to="/creators">
                    <button style={{
                      background: 'var(--color-accent)',
                      color: 'white', border: 'none', borderRadius: '6px',
                      padding: '9px 18px', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
                      fontFamily: 'inherit'
                    }}>
                      Search
                    </button>
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Hero Creator Cards */}
            <motion.div
              className="hero-cards-col"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{ position: 'relative' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="float-animation">
                {featured.slice(0, 4).map((creator, i) => (
                  <motion.div
                    key={creator.user_id || i}
                    whileHover={{ scale: 1.05, y: -5 }}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '20px',
                      padding: '20px',
                      cursor: 'pointer'
                    }}
                    onClick={() => window.location.href = `/creators/${creator.user_id}`}
                  >
                    <img
                      src={creator.avatar || `https://ui-avatars.com/api/?name=${creator.name}&background=0F766E&color=fff`}
                      alt={creator.name}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', marginBottom: '12px', objectFit: 'cover' }}
                    />
                    <div style={{ fontWeight: '700', color: 'white', fontSize: '14px', marginBottom: '4px' }}>{creator.name}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '8px' }}>{creator.category}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                      <span style={{ color: creator.rating > 0 ? 'var(--color-warning)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>
                        {creator.rating > 0 ? `⭐ ${creator.rating}` : 'New'}
                      </span>
                      <span style={{ color: 'var(--color-accent)', fontSize: '12px', fontWeight: '600' }}>From {formatMoney(creator.starting_price)}</span>
                    </div>
                    {creator.is_verified && (
                      <span className="verified-badge" style={{ marginTop: '8px', display: 'inline-flex' }}>✓ Verified</span>
                    )}
                  </motion.div>
                ))}
                
                {featured.length === 0 && [1,2,3,4].map(i => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '20px', padding: '20px'
                  }}>
                    <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%', marginBottom: '12px' }} />
                    <div className="skeleton" style={{ width: '80%', height: '14px', marginBottom: '8px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─────────────────────────────────────────── */}
      {stats && (stats.approved_creators > 0 || stats.completed_orders > 0 || stats.total_clients > 0) && (
        <section style={{ background: 'var(--bg-secondary)', padding: '80px 0' }}>
          <div className="container-custom">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '32px' }}>
              {[
                stats.approved_creators > 0 && { label: 'AI Creators', value: stats.approved_creators.toLocaleString(), icon: Users },
                stats.completed_orders > 0 && { label: 'Projects Completed', value: stats.completed_orders.toLocaleString(), icon: CheckCircle },
                stats.total_clients > 0 && { label: 'Clients', value: stats.total_clients.toLocaleString(), icon: TrendingUp },
                stats.avg_rating > 0 && { label: 'Average Rating', value: `${stats.avg_rating}★`, icon: Star },
              ].filter(Boolean).map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="stat-card"
                  style={{ textAlign: 'center', padding: '28px 16px' }}
                >
                  <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    {stat.value}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500' }}>{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Categories Section ────────────────────────────────────── */}
      <section style={{ padding: '100px 0' }}>
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '60px' }}
          >
            <h2 style={{ fontSize: '44px', marginBottom: '16px' }}>
              Explore{' '}
              <span className="gradient-text">Popular Categories</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
              Find the perfect AI creator for every content need
            </p>
          </motion.div>

          <div className="grid-responsive-4" style={{ gap: '16px' }}>
            {categories.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <Link to={`/creators?category=${encodeURIComponent(cat.name)}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px', padding: '28px',
                    cursor: 'pointer', transition: 'all 0.3s',
                    position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      width: '60px', height: '60px',
                      background: cat.color, opacity: 0.1,
                      borderRadius: '0 20px 0 60px'
                    }} />
                    <div style={{ fontSize: '36px', marginBottom: '16px' }}>{cat.icon}</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{cat.desc}</div>
                    <div style={{
                      marginTop: '16px', width: '32px', height: '3px',
                      background: cat.color, borderRadius: '2px'
                    }} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Creators ─────────────────────────────────────── */}
      {featured.length > 0 && (
        <section style={{ padding: '80px 0', background: 'var(--bg-secondary)' }}>
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}
            >
              <div>
                <h2 style={{ fontSize: '40px', marginBottom: '8px' }}>
                  Featured <span className="gradient-text">AI Creators</span>
                </h2>
                <p style={{ color: 'var(--text-secondary)' }}>Top-rated creators verified by our team</p>
              </div>
              <Link to="/creators">
                <button className="btn-gradient" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  View All <ArrowRight size={16} />
                </button>
              </Link>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
              {featured.slice(0, 8).map((creator, i) => (
                <motion.div
                  key={creator.user_id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="creator-card"
                  onClick={() => window.location.href = `/creators/${creator.user_id}`}
                >
                  <div className="card-banner">
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${['var(--color-accent)','var(--color-accent)','var(--color-accent)','#f59e0b'][i%4]}, ${['var(--color-accent)','var(--color-accent)','#f59e0b','var(--color-accent)'][i%4]})` }} />
                  </div>
                  <div style={{ padding: '48px 20px 20px', textAlign: 'center', position: 'relative' }}>
                    <img
                      src={creator.avatar || `https://ui-avatars.com/api/?name=${creator.name}&background=0F766E&color=fff`}
                      alt={creator.name}
                      className="card-avatar"
                      style={{ position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)' }}
                    />
                    <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>{creator.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{creator.headline}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                      {creator.is_verified && <span className="badge badge-info">✓ Verified</span>}
                      <span className="badge badge-purple">{creator.category}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: creator.rating > 0 ? 'var(--color-warning)' : 'var(--text-muted)', fontWeight: '700', fontSize: '14px' }}>
                        {creator.rating > 0 ? `⭐ ${creator.rating}` : 'New'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{creator.total_orders} orders</span>
                      <span style={{ color: 'var(--color-accent)', fontWeight: '700', fontSize: '14px' }}>{formatMoney(creator.starting_price)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── How It Works ──────────────────────────────────────────── */}
      <section style={{ padding: '100px 0' }}>
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '72px' }}
          >
            <h2 style={{ fontSize: '44px', marginBottom: '16px' }}>
              How <span className="gradient-text">It Works</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
              From browsing to delivery in 6 simple steps
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '32px' }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px', padding: '36px 28px',
                  position: 'relative', overflow: 'hidden',
                  cursor: 'default'
                }}
              >
                <div style={{
                  position: 'absolute', top: '-20px', right: '-10px',
                  fontSize: '80px', fontWeight: '900', color: 'var(--color-border-strong)',
                  fontFamily: 'Inter, system-ui, sans-serif', userSelect: 'none'
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '10px',
                  background: 'var(--color-surface-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <step.icon size={22} color="var(--color-primary-foreground)" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7' }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ──────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--bg-secondary)' }}>
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center' }}
          >
            <h2 style={{ fontSize: '40px', marginBottom: '16px' }}>
              What Clients <span className="gradient-text">Say About Us</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '32px' }}>
              We're just getting started — be one of the first clients to share your experience.
            </p>
            <Link to="/register">
              <motion.button
                whileHover={{ scale: 1.03 }}
                className="btn-gradient"
                style={{ padding: '13px 28px', fontSize: '15px' }}
              >
                Hire a Creator Today
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 0' }}>
        <div className="container-custom" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '60px' }}
          >
            <h2 style={{ fontSize: '40px', marginBottom: '16px' }}>
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px', padding: '20px 24px',
                  cursor: 'pointer'
                }}
              >
                <summary style={{
                  fontWeight: '700', color: 'var(--text-primary)',
                  fontSize: '16px', listStyle: 'none', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}>
                  {faq.q}
                  <span style={{ color: 'var(--color-accent)', fontSize: '20px' }}>+</span>
                </summary>
                <p style={{ color: 'var(--text-secondary)', marginTop: '14px', lineHeight: '1.7' }}>
                  {faq.a}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--gradient-card)',
        color: 'white',
        padding: '80px 0'
      }}>
        <div className="container-custom" style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 style={{ fontSize: '52px', fontWeight: '900', color: 'white', marginBottom: '20px' }}>
              Ready to Transform Your Content?
            </h2>
            <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.85)', marginBottom: '40px' }}>
              Join AI CreatorHub — where brands meet the best AI content creators.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Link to="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '18px 40px', fontSize: '18px', fontWeight: '700',
                    background: 'white', color: 'var(--color-accent)',
                    border: 'none', borderRadius: '14px', cursor: 'pointer'
                  }}
                >
                  Get Started Free
                </motion.button>
              </Link>
              <Link to="/creators">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  style={{
                    padding: '18px 40px', fontSize: '18px', fontWeight: '700',
                    background: 'transparent', color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    borderRadius: '14px', cursor: 'pointer'
                  }}
                >
                  Browse Creators
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer style={{ background: '#14191E', padding: '56px 0 24px', color: '#8A9BA8' }}>
        <div className="container-custom">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '48px', marginBottom: '48px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '30px', height: '30px',
                  background: 'var(--color-accent)',
                  borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Sparkles size={15} color="white" />
                </div>
                <span style={{ fontWeight: '700', fontSize: '16px', color: 'white', letterSpacing: '-0.01em' }}>AI CreatorHub</span>
              </div>
              <p style={{ lineHeight: '1.7', maxWidth: '280px', fontSize: '14px' }}>
                The world's leading marketplace for AI content creators. Connecting brands with top AI talent.
              </p>
            </div>
            {[
              { title: 'Platform', links: ['Browse Creators', 'How It Works', 'Categories', 'Become a Creator'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Support', links: ['Help Center', 'Privacy Policy', 'Terms of Service', 'Dispute Resolution'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 style={{ color: 'white', fontWeight: '700', marginBottom: '16px', fontSize: '15px' }}>{col.title}</h4>
                {col.links.map(link => (
                  <div key={link} style={{ marginBottom: '10px' }}>
                    <a href="#" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s' }}
                       onMouseEnter={e => e.target.style.color = 'var(--color-primary)'}
                       onMouseLeave={e => e.target.style.color = ''}>
                      {link}
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #2A333C', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px' }}>© 2024 AI CreatorHub. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '16px' }}>
              {['🐦', '💼', '📸', '▶️'].map((icon, i) => (
                <a key={i} href="#" style={{ fontSize: '20px', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }}
                   onMouseEnter={e => e.target.style.opacity = '1'}
                   onMouseLeave={e => e.target.style.opacity = '0.7'}>
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
