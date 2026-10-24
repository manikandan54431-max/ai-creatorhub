import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Clock, Tag, ChevronRight, BookOpen } from 'lucide-react'
import api from '../../services/api'
import Footer from '../../components/layout/Footer'

const CATEGORY_COLORS = {
  'For Clients': 'badge-info',
  'For Creators': 'badge-success',
  'Platform Guide': 'badge-purple',
}

export default function BlogPage() {
  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')

  useEffect(() => {
    loadPosts()
    loadCategories()
  }, [activeCategory])

  async function loadPosts() {
    setLoading(true)
    try {
      const params = {}
      if (activeCategory) params.category = activeCategory
      if (search) params.search = search
      const res = await api.get('/api/blog/posts', { params })
      setPosts(res.data)
    } catch (e) {
      // show empty
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    try {
      const res = await api.get('/api/blog/posts/categories')
      setCategories(res.data)
    } catch (e) {}
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '64px 24px 48px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <h1 style={{ color: 'white', marginBottom: 12, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>AI CreatorHub Blog</h1>
          <p style={{ opacity: 0.9, maxWidth: 500, margin: '0 auto' }}>
            Guides, tips, and platform updates from the AI CreatorHub Editorial team.
          </p>
        </motion.div>
      </section>

      <section style={{ padding: '48px 24px', flex: 1 }}>
        <div className="container-custom">
          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-base"
                style={{ paddingLeft: 36 }}
                placeholder="Search articles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadPosts()}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadPosts}>Search</button>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveCategory('')}
                className={`btn btn-sm ${!activeCategory ? 'btn-primary' : 'btn-secondary'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
                  className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Posts grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 12 }} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3 style={{ color: 'var(--text-primary)' }}>No articles found</h3>
              <p>Try a different search or category.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="card" style={{ padding: 24, height: '100%', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ms-blue)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none' }}>
                      {/* Category */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span className={`badge ${CATEGORY_COLORS[post.category] || 'badge-neutral'}`}>
                          {post.category}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} />
                          {post.reading_time_minutes} min read
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ fontSize: 16, lineHeight: 1.4, marginBottom: 10, color: 'var(--text-primary)' }}>
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                        {post.excerpt}
                      </p>

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {post.author_label}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--ms-blue)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          Read <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
