import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { creatorsAPI, reviewsAPI, chatsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import {
  Star, Shield, Globe, Briefcase, Clock, MessageCircle, ShoppingCart,
  Play, Image, ExternalLink, ChevronLeft, Zap
} from 'lucide-react'
import { formatMoney } from '../../utils/format'

export default function CreatorProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [creator, setCreator] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPortfolio, setSelectedPortfolio] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [creatorRes, reviewsRes] = await Promise.all([
          creatorsAPI.getById(id),
          reviewsAPI.getByCreator(id),
        ])
        setCreator(creatorRes.data)
        setReviews(reviewsRes.data)
      } catch (err) {
        toast.error('Creator not found')
        navigate('/creators')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleMessage = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (user.role !== 'client') { toast.error('Only clients can message creators'); return }
    try {
      const res = await chatsAPI.createChat(id)
      navigate('/client/chat', { state: { chatId: res.data.id } })
    } catch {
      toast.error('Failed to open chat')
    }
  }

  const handleHire = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (user.role !== 'client') { toast.error('Only clients can hire creators'); return }
    navigate(`/client/hire/${id}`)
  }

  if (loading) {
    return (
      <div style={{ paddingTop: '70px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <div style={{ height: '200px', background: 'var(--bg-secondary)' }} className="skeleton" />
        <div className="container-custom" style={{ padding: '24px' }}>
          <div className="creator-profile-layout">
            <div>
              <div className="skeleton" style={{ height: '200px', borderRadius: '16px', marginBottom: '20px' }} />
              <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }} />
            </div>
            <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!creator) return null

  const tabs = ['overview', 'portfolio', 'services', 'reviews']

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingTop: '70px' }}>
      {/* Banner */}
      <div style={{
        height: '220px',
        background: creator.banner_image
          ? `url(${creator.banner_image}) center/cover`
          : 'var(--color-surface-muted)',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: '20px', left: '24px',
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
            padding: '8px 16px', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      <div className="container-custom">
        <div className="creator-profile-layout">
          
          {/* Left Column */}
          <div>
            {/* Profile Header */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px', padding: '24px',
              marginTop: '-60px', marginBottom: '24px', position: 'relative'
            }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                <img
                  src={creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=0F766E&color=fff&size=100`}
                  alt={creator.name}
                  style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid var(--bg-card)', objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>{creator.name}</h1>
                    {creator.is_verified && <span className="verified-badge">✓ Verified</span>}
                    {creator.is_featured && <span className="badge badge-purple">⚡ Featured</span>}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>{creator.headline}</p>
                  
                  <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Star size={16} fill={creator.rating > 0 ? '#f59e0b' : 'none'} color={creator.rating > 0 ? '#f59e0b' : 'var(--text-muted)'} />
                      {creator.rating > 0
                        ? <>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{creator.rating}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>({creator.total_reviews} reviews)</span>
                          </>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No reviews yet</span>
                      }
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Briefcase size={14} /> {creator.total_orders} orders completed
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Globe size={14} /> {(creator.languages || []).join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px' }}>
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '10px 16px',
                    background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                    border: 'none', borderRadius: '10px',
                    color: activeTab === tab ? 'var(--color-accent)' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab ? '700' : '500',
                    fontSize: '14px', cursor: 'pointer',
                    boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
                    textTransform: 'capitalize', transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              
              {activeTab === 'overview' && (
                <div>
                  {/* Bio */}
                  <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>About Me</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>{creator.bio}</p>
                  </div>

                  {/* Skills */}
                  <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>Skills & Expertise</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(creator.skills || []).map(skill => (
                        <span key={skill} className="badge badge-info">{skill}</span>
                      ))}
                    </div>
                  </div>

                  {/* AI Tools */}
                  <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>AI Tools Used</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(creator.ai_tools || []).map(tool => (
                        <span key={tool} style={{
                          background: 'linear-gradient(135deg, var(--color-accent-subtle), var(--color-accent-subtle))',
                          border: '1px solid var(--color-accent-subtle)',
                          color: 'var(--color-accent)', borderRadius: '10px',
                          padding: '6px 14px', fontSize: '13px', fontWeight: '600'
                        }}>
                          🤖 {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'portfolio' && (
                <div>
                  {creator.portfolio?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <Image size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <p>No portfolio items yet</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                      {(creator.portfolio || []).map((item) => (
                        <motion.div
                          key={item.id}
                          whileHover={{ scale: 1.03 }}
                          onClick={() => setSelectedPortfolio(item)}
                          style={{
                            borderRadius: '14px', overflow: 'hidden',
                            cursor: 'pointer', position: 'relative',
                            aspectRatio: '4/3',
                            background: 'var(--bg-secondary)'
                          }}
                        >
                          <img
                            src={item.media_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400'}
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                            display: 'flex', alignItems: 'flex-end', padding: '12px'
                          }}>
                            <span style={{ color: 'white', fontWeight: '600', fontSize: '13px' }}>{item.title}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Portfolio Lightbox */}
                  {selectedPortfolio && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedPortfolio(null)}
                      style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '20px'
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: '20px', maxWidth: '700px', width: '100%',
                          overflow: 'hidden'
                        }}
                      >
                        <img
                          src={selectedPortfolio.media_url}
                          alt={selectedPortfolio.title}
                          style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
                        />
                        <div style={{ padding: '24px' }}>
                          <h3 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>{selectedPortfolio.title}</h3>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{selectedPortfolio.description}</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(selectedPortfolio.tags || []).map(tag => (
                              <span key={tag} className="badge badge-purple">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === 'services' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(creator.services || []).map((svc) => (
                    <motion.div
                      key={svc.id}
                      whileHover={{ y: -2 }}
                      className="card"
                      style={{ padding: '24px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>{svc.title}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>{svc.description}</p>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '13px' }}>
                              <Clock size={13} /> {svc.delivery_days} days delivery
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '13px' }}>
                              🔄 {svc.revisions} revisions
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '24px' }}>
                          <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--color-accent)' }}>{formatMoney(svc.price)}</div>
                          <button
                            onClick={handleHire}
                            className="btn-gradient"
                            style={{ marginTop: '12px', padding: '10px 20px', fontSize: '14px' }}
                          >
                            Hire Now
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {(creator.services || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <Briefcase size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <p>No services listed yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div>
                  {reviews.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                      <Star size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <p>No reviews yet</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {reviews.map((review) => (
                        <div key={review.id} className="card" style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <img
                              src={review.client?.avatar || `https://ui-avatars.com/api/?name=${review.client?.name || 'C'}&background=0F766E&color=fff`}
                              alt=""
                              style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{review.client?.name}</span>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                  {Array(5).fill(0).map((_, i) => (
                                    <Star key={i} size={14} fill={i < review.rating ? '#f59e0b' : 'none'} color="#f59e0b" />
                                  ))}
                                </div>
                              </div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{review.comment}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Sidebar - CTA */}
          <div style={{ position: 'sticky', top: '90px' }}>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
              style={{ padding: '28px' }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--color-accent)', marginBottom: '4px' }}>
                  {formatMoney(creator.starting_price)}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Starting price</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {[
                  { icon: Clock, label: 'Fast Delivery', value: `From 3 days` },
                  { icon: Shield, label: 'Verified Creator', value: creator.is_verified ? '✓ Yes' : 'Not verified' },
                  { icon: Star, label: 'Rating', value: creator.rating > 0 ? `${creator.rating} ★ (${creator.total_reviews} reviews)` : 'New Creator' },
                  { icon: Briefcase, label: 'Experience', value: creator.experience || 'N/A' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon size={13} /> {label}
                    </span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleHire}
                className="btn-gradient"
                style={{ width: '100%', padding: '15px', fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}
              >
                <ShoppingCart size={18} style={{ display: 'inline', marginRight: '8px' }} />
                Hire Now
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMessage}
                style={{
                  width: '100%', padding: '13px', fontSize: '15px', fontWeight: '600',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <MessageCircle size={18} /> Message Creator
              </motion.button>

              {(creator.languages || []).length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>LANGUAGES</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {creator.languages.map(lang => (
                      <span key={lang} className="badge badge-info" style={{ fontSize: '11px' }}>{lang}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
