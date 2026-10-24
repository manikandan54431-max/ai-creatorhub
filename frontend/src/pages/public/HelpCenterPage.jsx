import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, BookOpen, Phone, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer'

const FAQS = {
  'Getting Started': [
    {
      q: 'How do I register as a client?',
      a: 'Click "Sign Up" on the homepage and select "Client" as your account type. Enter your name, email address, and a password of at least 6 characters. Your account is activated immediately and you can start browsing creators.'
    },
    {
      q: 'How do I become a creator?',
      a: 'Register with the "Creator" role. After registration, complete your creator profile — add a headline, bio, AI tools you use, skills, and portfolio items. Your profile is submitted for admin review. Once approved, you can receive project assignments.'
    },
    {
      q: 'How do I hire a creator?',
      a: 'Browse the Creators page, view individual profiles and portfolios, then click "Hire" to place an order. You will provide a project brief, requirements, budget, and deadline. An admin reviews your request and assigns the most suitable creator.'
    },
  ],
  'Orders & Assignments': [
    {
      q: 'How does admin assignment work?',
      a: 'When a client submits a project request, the admin reviews the brief and assigns a creator whose skills, tools, and availability match the project requirements. Both the client and creator are notified when an assignment is made. A project chat is created automatically.'
    },
    {
      q: 'What order statuses should I expect?',
      a: 'Orders progress through: Pending → Accepted → In Progress → Delivered (pending admin approval) → Completed. If the client requests a revision, the order moves to Revision Requested. Cancelled orders stop here.'
    },
  ],
  'Video Delivery & Review': [
    {
      q: 'How do I upload my completed video as a creator?',
      a: 'Go to the order detail page and scroll to the "Submit Video for Review" section. Enter a video title and delivery notes, then select your video file (MP4, WebM, or MOV, up to the configured size limit). Preview the video, then click "Upload Video". Once satisfied, click "Submit to Admin for Approval".'
    },
    {
      q: 'Why is my video pending review?',
      a: 'Every video delivery on AI CreatorHub goes through an admin quality review before the client sees it. This is a platform-wide requirement. The admin will review your video against the project brief and either approve it (which delivers it to the client) or request changes with specific feedback.'
    },
    {
      q: 'What happens when admin requests changes?',
      a: 'You will receive a notification with the admin\'s feedback. The feedback is visible on your order detail page. You can then upload a revised version of the video. The new version will go through the same admin review process before being delivered to the client.'
    },
    {
      q: 'When can the client watch the video?',
      a: 'The client can only access the video after an admin has reviewed and approved it. Before approval, the client sees a message explaining that the project is in quality review. Once approved, the client receives a notification and can view the video in their order detail page.'
    },
    {
      q: 'How do I request a revision as a client?',
      a: 'Once an approved video is delivered to you, click "Request Revision" on the order detail page. Describe specifically what needs to change. The creator will receive your request and upload a new version, which will again go through admin review before it reaches you.'
    },
  ],
  'Payments': [
    {
      q: 'Where can I see my payment status?',
      a: 'Go to the Payments section in your dashboard. As a client, you can see payments you have made. As a creator, you can see your earnings. Payment status moves from Pending to Completed when the client accepts the delivery.'
    },
  ],
  'Technical Help': [
    {
      q: 'What should I do if an upload fails?',
      a: 'First, check that your file is in a supported format (MP4, WebM, or MOV) and that it does not exceed the size limit shown in the upload area. Ensure you have a stable internet connection. If the problem persists, contact support at manikandan54431@gmail.com with details about the error you see.'
    },
    {
      q: 'How do I contact support?',
      a: 'You can email us at manikandan54431@gmail.com or call +91 6380994709. You can also create a support ticket via the Support page if you have an account. For platform-related issues, include your order ID or account email in your message.'
    },
  ],
}

export default function HelpCenterPage() {
  const [search, setSearch] = useState('')
  const [openItem, setOpenItem] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)

  const allFaqs = Object.entries(FAQS).flatMap(([cat, items]) => items.map(item => ({ ...item, cat })))

  const filtered = search
    ? allFaqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : null

  const displayCategories = activeCategory ? { [activeCategory]: FAQS[activeCategory] } : FAQS

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '64px 24px 48px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <h1 style={{ color: 'white', marginBottom: 12 }}>Help Center</h1>
          <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto 28px' }}>
            Find answers to common questions about the platform.
          </p>
          <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)' }} />
            <input
              style={{
                width: '100%', padding: '12px 16px 12px 44px',
                borderRadius: 10, border: 'none',
                fontSize: 15, outline: 'none',
                background: 'white', color: '#242424',
              }}
              placeholder="Search help articles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </motion.div>
      </section>

      <section style={{ padding: '48px 24px', flex: 1 }}>
        <div className="container-custom" style={{ maxWidth: 860 }}>
          {/* Search results */}
          {search && filtered && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
              </h3>
              {filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <p>No articles match your search. <Link to="/contact" style={{ color: 'var(--ms-blue)' }}>Contact us directly</Link> if you need help.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.map((item, i) => (
                    <FAQItem key={i} item={item} openItem={openItem} setOpenItem={setOpenItem} showCategory />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category filter */}
          {!search && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
              <button
                onClick={() => setActiveCategory(null)}
                className={`btn btn-sm ${!activeCategory ? 'btn-primary' : 'btn-secondary'}`}
              >
                All Topics
              </button>
              {Object.keys(FAQS).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* FAQs by category */}
          {!search && Object.entries(displayCategories).map(([cat, items]) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 40 }}
            >
              <h2 style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 20, background: 'var(--ms-blue)', borderRadius: 3, display: 'inline-block' }} />
                {cat}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, i) => (
                  <FAQItem key={i} item={item} openItem={openItem} setOpenItem={setOpenItem} />
                ))}
              </div>
            </motion.div>
          ))}

          {/* Contact box */}
          <div style={{
            marginTop: 48,
            padding: 28,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
            <h3 style={{ marginBottom: 8 }}>Didn't find your answer?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Our support team is here to help with any question not covered here.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="tel:+916380994709" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <Phone size={14} /> +91 6380994709
              </a>
              <a href="mailto:manikandan54431@gmail.com" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <Mail size={14} /> manikandan54431@gmail.com
              </a>
              <Link to="/support" className="btn btn-secondary">Create Support Ticket</Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function FAQItem({ item, openItem, setOpenItem, showCategory }) {
  const id = item.q
  const isOpen = openItem === id
  return (
    <div style={{
      border: `1px solid ${isOpen ? 'var(--ms-blue)' : 'var(--border-color)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
      background: 'var(--bg-card)',
    }}>
      <button
        onClick={() => setOpenItem(isOpen ? null : id)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 18px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          color: 'var(--text-primary)',
        }}
      >
        <div>
          {showCategory && <div style={{ fontSize: 11, color: 'var(--ms-blue)', fontWeight: 600, marginBottom: 2 }}>{item.cat}</div>}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{item.q}</span>
        </div>
        {isOpen ? <ChevronUp size={16} color="var(--ms-blue)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 18px 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
