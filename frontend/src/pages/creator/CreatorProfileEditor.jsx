import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { creatorsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import { Save, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from '../../utils/format'

const categories = [
  'AI Video Creation', 'AI Image Generation', 'UGC Ads',
  'Instagram Reels', 'YouTube Shorts', 'AI Animation',
  'Voiceover', 'Prompt Engineering'
]
const skillOptions = ['Runway ML', 'MidJourney', 'DALL-E 3', 'Sora', 'Pika Labs', 'ElevenLabs', 'HeyGen', 'Synthesia', 'Kling AI', 'Stable Diffusion', 'Luma AI', 'Adobe Firefly', 'ChatGPT', 'Claude', 'Gemini']

export default function CreatorProfileEditor() {
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [portfolio, setPortfolio] = useState([])
  const [services, setServices] = useState([])
  const [newPortfolio, setNewPortfolio] = useState({ title: '', description: '', media_url: '', tags: [] })
  const [newService, setNewService] = useState({ title: '', description: '', price: '', delivery_days: 7, revisions: 2 })

  const [form, setForm] = useState({
    headline: '',
    bio: '',
    category: '',
    skills: [],
    ai_tools: [],
    languages: ['English'],
    experience: '',
    starting_price: '',
    website: '',
    instagram: '',
    youtube: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await creatorsAPI.getById(user.id)
        const p = profileRes.data
        setForm({
          headline: p.headline || '',
          bio: p.bio || '',
          category: p.category || '',
          skills: p.skills || [],
          ai_tools: p.ai_tools || [],
          languages: p.languages || ['English'],
          experience: p.experience || '',
          starting_price: p.starting_price || '',
          website: p.website || '',
          instagram: p.social_links?.instagram || '',
          youtube: p.social_links?.youtube || '',
        })
        setPortfolio(p.portfolio || [])
        const svcRes = await creatorsAPI.getMyServices()
        setServices(svcRes.data)
      } catch {}
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await creatorsAPI.updateProfile({
        ...form,
        starting_price: form.starting_price ? parseFloat(form.starting_price) : null,
        social_links: { instagram: form.instagram, youtube: form.youtube, website: form.website },
      })
      toast.success('Profile updated! ✨')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill]
    }))
  }

  const handleAddPortfolio = async () => {
    if (!newPortfolio.title || !newPortfolio.media_url) { toast.error('Title and media URL required'); return }
    try {
      await creatorsAPI.addPortfolio(newPortfolio)
      toast.success('Portfolio item added!')
      const res = await creatorsAPI.getById(user.id)
      setPortfolio(res.data.portfolio || [])
      setNewPortfolio({ title: '', description: '', media_url: '', tags: [] })
    } catch { toast.error('Failed to add portfolio item') }
  }

  const handleDeletePortfolio = async (id) => {
    if (!window.confirm('Delete this portfolio item?')) return
    await creatorsAPI.deletePortfolio(id)
    setPortfolio(p => p.filter(x => x.id !== id))
    toast.success('Deleted')
  }

  const handleAddService = async () => {
    if (!newService.title || !newService.price) { toast.error('Title and price required'); return }
    try {
      await creatorsAPI.createService({ ...newService, price: parseFloat(newService.price) })
      toast.success('Service added!')
      const res = await creatorsAPI.getMyServices()
      setServices(res.data)
      setNewService({ title: '', description: '', price: '', delivery_days: 7, revisions: 2 })
    } catch { toast.error('Failed to add service') }
  }

  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service?')) return
    await creatorsAPI.deleteService(id)
    setServices(s => s.filter(x => x.id !== id))
    toast.success('Deleted')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-accent-subtle)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const tabs = [
    { id: 'profile', label: '👤 Profile Info' },
    { id: 'portfolio', label: '🎨 Portfolio' },
    { id: 'services', label: '💼 Services' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '32px 0' }}>
        <div className="container-custom">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px', marginBottom: '10px' }}>
                <ChevronLeft size={16} /> Back to Dashboard
              </button>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-text-primary)' }}>Edit Creator Profile ✏️</h1>
            </div>
            {activeTab === 'profile' && (
              <button onClick={handleSaveProfile} disabled={saving} className="btn-gradient" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '28px 24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px', maxWidth: '400px' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '10px 12px', background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', border: 'none', borderRadius: '10px', color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--text-secondary)', fontWeight: activeTab === tab.id ? '700' : '500', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none'
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '24px' }}>
            <div className="card" style={{ padding: '28px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Basic Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Professional Headline</label>
                  <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="e.g. AI Video Creator & Brand Storyteller" className="input-base" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-base">
                    <option value="">Select primary category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Experience</label>
                  <input value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} placeholder="e.g. 3 years in AI content creation" className="input-base" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Starting Price (₹)</label>
                  <input type="number" value={form.starting_price} onChange={e => setForm(f => ({ ...f, starting_price: e.target.value }))} placeholder="e.g. 5000" className="input-base" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>Professional Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Write a compelling bio that showcases your expertise..." className="input-base" rows={6} style={{ resize: 'vertical' }} />
              </div>

              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', fontSize: '15px' }}>AI Tools Used</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {skillOptions.map(skill => (
                    <button key={skill} onClick={() => toggleSkill(skill)} style={{
                      padding: '5px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
                      background: form.skills.includes(skill) ? 'var(--color-primary)' : 'var(--bg-secondary)',
                      borderColor: form.skills.includes(skill) ? 'var(--color-accent)' : 'var(--border-color)',
                      color: form.skills.includes(skill) ? 'white' : 'var(--text-secondary)',
                    }}>
                      {form.skills.includes(skill) ? '✓ ' : ''}{skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Add Portfolio Form */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '18px' }}>
                <Plus size={16} style={{ display: 'inline', marginRight: '8px' }} /> Add Portfolio Item
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <input value={newPortfolio.title} onChange={e => setNewPortfolio(p => ({ ...p, title: e.target.value }))} placeholder="Title *" className="input-base" />
                <input value={newPortfolio.media_url} onChange={e => setNewPortfolio(p => ({ ...p, media_url: e.target.value }))} placeholder="Image/Video URL *" className="input-base" />
                <textarea value={newPortfolio.description} onChange={e => setNewPortfolio(p => ({ ...p, description: e.target.value }))} placeholder="Description" className="input-base" rows={2} style={{ resize: 'vertical' }} />
              </div>
              <button onClick={handleAddPortfolio} className="btn-gradient" style={{ padding: '11px 24px' }}>
                <Plus size={15} style={{ display: 'inline', marginRight: '6px' }} /> Add Item
              </button>
            </div>

            {/* Portfolio Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {portfolio.map(item => (
                <motion.div key={item.id} whileHover={{ y: -4 }} style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ aspectRatio: '4/3', overflow: 'hidden', position: 'relative' }}>
                    <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = `https://picsum.photos/400/300?random=${item.id}` }} />
                    <button onClick={() => handleDeletePortfolio(item.id)} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ padding: '14px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{item.title}</div>
                    {item.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.description}</div>}
                  </div>
                </motion.div>
              ))}
              {portfolio.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎨</div>
                  <p>Add your first portfolio item above</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Add Service Form */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '18px' }}>
                <Plus size={16} style={{ display: 'inline', marginRight: '8px' }} /> Add Service Package
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '16px', marginBottom: '16px' }}>
                <input value={newService.title} onChange={e => setNewService(s => ({ ...s, title: e.target.value }))} placeholder="Package Title *" className="input-base" />
                <input type="number" value={newService.price} onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} placeholder="Price (₹) *" className="input-base" />
                <input type="number" value={newService.delivery_days} onChange={e => setNewService(s => ({ ...s, delivery_days: parseInt(e.target.value) }))} placeholder="Delivery Days" className="input-base" />
                <textarea value={newService.description} onChange={e => setNewService(s => ({ ...s, description: e.target.value }))} placeholder="Service description..." className="input-base" rows={2} style={{ resize: 'vertical', gridColumn: '1/-1' }} />
              </div>
              <button onClick={handleAddService} className="btn-gradient" style={{ padding: '11px 24px' }}>
                <Plus size={15} style={{ display: 'inline', marginRight: '6px' }} /> Add Service
              </button>
            </div>

            {/* Services List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {services.map(svc => (
                <motion.div key={svc.id} whileHover={{ y: -2 }} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>{svc.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '10px' }}>{svc.description}</p>
                      <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span>⏱️ {svc.delivery_days} days</span>
                        <span>🔄 {svc.revisions} revisions</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--color-accent)' }}>{formatMoney(svc.price)}</div>
                      </div>
                      <button onClick={() => handleDeleteService(svc.id)} style={{ width: '34px', height: '34px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {services.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💼</div>
                  <p>Add your first service package above</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
