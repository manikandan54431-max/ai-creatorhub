import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, ArrowLeft, BookOpen, Tag } from 'lucide-react'
import api from '../../services/api'
import Footer from '../../components/layout/Footer'

export default function BlogPostPage() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadPost()
    window.scrollTo(0, 0)
  }, [slug])

  async function loadPost() {
    setLoading(true)
    setError(false)
    try {
      const res = await api.get(`/api/blog/posts/${slug}`)
      setPost(res.data)
      // Load related (same category)
      const rel = await api.get('/api/blog/posts', { params: { category: res.data.category, limit: 4 } })
      setRelated(rel.data.filter(p => p.slug !== slug).slice(0, 3))
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 24px' }} className="container-custom">
        <div className="skeleton" style={{ height: 40, width: '60%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 20, width: '80%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    </div>
  )

  if (error || !post) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="empty-state" style={{ flex: 1 }}>
        <div className="empty-state-icon">📭</div>
        <h2 style={{ color: 'var(--text-primary)' }}>Article Not Found</h2>
        <p>This article may have been removed or the URL is incorrect.</p>
        <Link to="/blog" className="btn btn-primary" style={{ marginTop: 20 }}>Back to Blog</Link>
      </div>
      <Footer />
    </div>
  )

  // Parse reading time from content word count
  const wordCount = post.content.split(/\s+/).length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <section style={{ background: 'var(--gradient-hero)', padding: '48px 24px 40px', color: 'white' }}>
        <div className="container-custom" style={{ maxWidth: 740 }}>
          <Link to="/blog" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,0.8)', textDecoration: 'none',
            fontSize: 13, marginBottom: 20, fontWeight: 500
          }}>
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
              {post.category}
            </span>
            <span style={{ opacity: 0.8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} /> {readingTime} min read
            </span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', lineHeight: 1.3, marginBottom: 16 }}>
            {post.title}
          </h1>
          <div style={{ display: 'flex', gap: 16, opacity: 0.8, fontSize: 13 }}>
            <span>By {post.author_label}</span>
            <span>{new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: '48px 24px', flex: 1 }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="article-body"
            style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}
            dangerouslySetInnerHTML={{
              __html: markdownToHtml(post.content)
            }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div style={{ marginTop: 40, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag size={14} style={{ color: 'var(--text-muted)' }} />
              {post.tags.map(tag => (
                <span key={tag} className="badge badge-neutral" style={{ fontSize: 11 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Author box */}
          <div style={{
            marginTop: 40,
            padding: 24,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--gradient-hero)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, flexShrink: 0,
            }}>
              ✍️
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{post.author_label}</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                The editorial team at AI CreatorHub writes guides, platform updates, and tips to help
                clients and creators get the most out of the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related articles */}
      {related.length > 0 && (
        <section style={{ padding: '40px 24px', background: 'var(--bg-secondary)' }}>
          <div className="container-custom">
            <h3 style={{ marginBottom: 24 }}>More from {post.category}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {related.map(p => (
                <Link key={p.slug} to={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: 20 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ms-blue)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                    <h4 style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 8, color: 'var(--text-primary)' }}>{p.title}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{p.excerpt?.slice(0, 100)}...</p>
                    <span style={{ fontSize: 12, color: 'var(--ms-blue)', fontWeight: 600, marginTop: 10, display: 'block' }}>
                      Read more →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}

/** Very simple Markdown → HTML converter for article display */
function markdownToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/((<li>.*<\/li>\n?)+)/gs, '<ul>$1</ul>')
    .replace(/^(?!<[hul]|$)(.+)$/gm, '<p>$1</p>')
    .replace(/\n{2,}/g, '\n')
    .replace(/☐/g, '<span style="opacity:0.5">☐</span>')
}
