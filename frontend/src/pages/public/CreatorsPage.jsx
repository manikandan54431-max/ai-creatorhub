import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { creatorsAPI } from '../../services/api'
import { Search, Filter, Star, Shield, ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { formatMoney } from '../../utils/format'

const categories = [
  'AI Video Creation', 'AI Image Generation', 'UGC Ads',
  'Instagram Reels', 'YouTube Shorts', 'AI Animation',
  'Voiceover', 'Prompt Engineering'
]
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

export default function CreatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  // Derive all filter state directly from URL params — single source of truth
  const search    = searchParams.get('search')    || ''
  const category  = searchParams.get('category')  || ''
  const minPrice  = searchParams.get('min_price') || ''
  const maxPrice  = searchParams.get('max_price') || ''
  const minRating = searchParams.get('min_rating')|| ''
  const isVerified= searchParams.get('verified')  === 'true'
  const sortBy    = searchParams.get('sort_by')   || 'popular'

  // Local state only for the controlled search input (not yet submitted)
  const [searchInput, setSearchInput] = useState(search)

  // Helper: update one or more params; remove param if value is falsy
  const setParam = (updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '' && val !== false) {
          next.set(key, String(val))
        } else {
          next.delete(key)
        }
      })
      return next
    })
  }

  // Fetch whenever URL params change — single source of truth
  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true)
      setApiError(null)
      try {
        const params = {
          search:      search      || undefined,
          category:    category    || undefined,
          min_price:   minPrice    || undefined,
          max_price:   maxPrice    || undefined,
          min_rating:  minRating   || undefined,
          is_verified: isVerified  || undefined,
          sort_by:     sortBy,
          limit:       50,
        }
        const res = await creatorsAPI.getAll(params)
        setCreators(res.data)
      } catch (err) {
        console.error(err)
        setApiError('Failed to load creators. Please try again.')
        setCreators([])
      } finally {
        setLoading(false)
      }
    }
    fetchCreators()
  }, [search, category, minPrice, maxPrice, minRating, isVerified, sortBy])

  const handleSearch = (e) => {
    e.preventDefault()
    setParam({ search: searchInput || undefined })
  }

  const clearFilters = () => {
    setSearchInput('')
    // Clear all filter params at once — useEffect will trigger a fresh fetch
    setSearchParams(new URLSearchParams())
  }

  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingTop: '70px' }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '60px 0 48px'
      }}>
        <div className="container-custom">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: '42px', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '12px', textAlign: 'center' }}
          >
            Find Your Perfect{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Creator
            </span>
          </motion.h1>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '16px', marginBottom: '32px' }}>
            {creators.length > 0 ? `${creators.length} creators available` : 'Browse 5000+ verified AI creators'}
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name, skill, or category..."
                className="input-base"
                style={{
                  width: '100%', padding: '14px 16px 14px 48px',
                  borderRadius: '12px', fontSize: '15px', outline: 'none'
                }}
              />
            </div>
            <button type="submit" className="btn-gradient" style={{ padding: '14px 28px', whiteSpace: 'nowrap' }}>
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '32px 24px' }}>
        <div className="marketplace-layout">
          
          {/* Sidebar Filters */}
          <div className={`marketplace-filters-col ${filtersOpen ? 'mobile-open' : ''}`} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '24px',
            height: 'fit-content'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Filter size={16} /> Filters
              </h3>
              <button onClick={clearFilters} style={{ fontSize: '12px', color: 'var(--color-accent)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: '600' }}>
                Clear All
              </button>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
                CATEGORY
              </label>
              {categories.map(cat => (
                <div
                  key={cat}
                  onClick={() => setParam({ category: category === cat ? '' : cat })}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: category === cat ? 'var(--color-accent-subtle)' : 'transparent',
                    color: category === cat ? 'var(--color-accent)' : 'var(--text-secondary)',
                    fontWeight: category === cat ? '600' : '400',
                    fontSize: '13px', marginBottom: '2px',
                    transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between'
                  }}
                >
                  {cat}
                  {category === cat && <X size={12} />}
                </div>
              ))}
            </div>

            {/* Price Range */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
                PRICE RANGE (₹)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number" placeholder="Min"
                  value={minPrice} onChange={e => setParam({ min_price: e.target.value || '' })}
                  className="input-base" style={{ padding: '8px 12px' }}
                />
                <input
                  type="number" placeholder="Max"
                  value={maxPrice} onChange={e => setParam({ max_price: e.target.value || '' })}
                  className="input-base" style={{ padding: '8px 12px' }}
                />
              </div>
            </div>

            {/* Rating */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
                MINIMUM RATING
              </label>
              {[4.5, 4.0, 3.5, 3.0].map(r => (
                <div
                  key={r}
                  onClick={() => setParam({ min_rating: minRating == r ? '' : r })}
                  style={{
                    padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: minRating == r ? 'var(--color-accent-subtle)' : 'transparent',
                    color: minRating == r ? 'var(--color-accent)' : 'var(--text-secondary)',
                    fontSize: '13px', marginBottom: '2px', transition: 'all 0.2s'
                  }}
                >
                  {'⭐'.repeat(Math.round(r))} {r}+
                </div>
              ))}
            </div>

            {/* Verified Only */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={isVerified}
                  onChange={e => setParam({ verified: e.target.checked ? 'true' : '' })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  <Shield size={12} style={{ marginRight: '4px' }} /> Verified Only
                </span>
              </label>
            </div>

            <button
              onClick={() => setParam({ search: searchInput || '' })}
              className="btn-gradient"
              style={{ width: '100%', padding: '12px', marginTop: '20px', borderRadius: '10px' }}
            >
              Apply Filters
            </button>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1 }}>
            {/* Sort Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{creators.length}</strong> creators found
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="mobile-filter-btn"
                  style={{
                    display: 'none', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '10px',
                    background: filtersOpen ? 'var(--color-primary)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: filtersOpen ? 'var(--color-primary-foreground)' : 'var(--text-primary)',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  <Filter size={14} /> {filtersOpen ? 'Hide Filters' : 'Filters'}
                </button>
                <select
                  value={sortBy}
                  onChange={e => setParam({ sort_by: e.target.value })}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', fontSize: '13px',
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Creator Grid */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {Array(9).fill(0).map((_, i) => (
                  <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden' }}>
                    <div className="skeleton" style={{ height: '100px' }} />
                    <div style={{ padding: '48px 20px 20px', textAlign: 'center' }}>
                      <div className="skeleton" style={{ width: '70%', height: '14px', margin: '0 auto 8px', borderRadius: '4px' }} />
                      <div className="skeleton" style={{ width: '50%', height: '12px', margin: '0 auto', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : apiError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}
              >
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>Error loading creators</h3>
                <p>{apiError}</p>
                <button onClick={() => setSearchParams(new URLSearchParams(searchParams))} className="btn-gradient" style={{ padding: '12px 24px', marginTop: '20px' }}>
                  Retry
                </button>
              </motion.div>
            ) : creators.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}
              >
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>No creators found</h3>
                <p>Try adjusting your filters or search terms</p>
                <button onClick={clearFilters} className="btn-gradient" style={{ padding: '12px 24px', marginTop: '20px' }}>
                  Clear Filters
                </button>
              </motion.div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                <AnimatePresence>
                  {creators.map((creator, i) => (
                    <motion.div
                      key={creator.user_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      layout
                    >
                      <CreatorCard creator={creator} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreatorCard({ creator }) {
  const colors = ['var(--color-accent)', 'var(--color-accent)', 'var(--color-accent)', '#f59e0b', '#06b6d4', '#059669']
  const color = colors[creator.user_id % colors.length]

  return (
    <Link to={`/creators/${creator.user_id}`} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
        className="creator-card"
      >
        <div className="card-banner" style={{ position: 'relative', height: '100px' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${color}, ${color}aa)` }} />
          {creator.is_featured && (
            <span style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(0,0,0,0.4)', color: 'white',
              fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px'
            }}>
              ⚡ Featured
            </span>
          )}
        </div>
        <div style={{ padding: '44px 20px 20px', textAlign: 'center', position: 'relative' }}>
          <img
            src={creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=${color.replace('#', '')}&color=fff`}
            alt={creator.name}
            style={{
              width: '68px', height: '68px', borderRadius: '50%',
              border: '4px solid var(--bg-card)',
              position: 'absolute', top: '-34px', left: '50%', transform: 'translateX(-50%)',
              objectFit: 'cover'
            }}
          />
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {creator.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', minHeight: '32px', lineHeight: '1.4' }}>
            {creator.headline || creator.category}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
            {creator.is_verified && (
              <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }}>
                ✓ Verified
              </span>
            )}
            {(creator.skills || []).slice(0, 2).map(s => (
              <span key={s} className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>{s}</span>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: creator.rating > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                {creator.rating > 0 ? `⭐ ${creator.rating}` : 'New'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {creator.total_reviews > 0 ? `${creator.total_reviews} reviews` : 'No reviews yet'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{creator.total_orders}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>orders</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Starting at</div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-accent)' }}>
                {formatMoney(creator.starting_price)}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
