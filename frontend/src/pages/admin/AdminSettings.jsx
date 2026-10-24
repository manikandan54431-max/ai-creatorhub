import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Settings, Globe, DollarSign, Users, Shield,
  Save, RotateCcw, Loader, Database,
  Clock, TrendingUp, AlertTriangle, Server,
  Sparkles, Lock, CreditCard, Star, Tag, Plus, X
} from 'lucide-react'

const SECTIONS = [
  { id: 'general',       label: 'General',         icon: Globe,      color: 'var(--color-accent)' },
  { id: 'financial',     label: 'Financial',        icon: DollarSign, color: 'var(--color-success)' },
  { id: 'creator_rules', label: 'Creator Rules',    icon: Users,      color: 'var(--color-accent)' },
  { id: 'moderation',    label: 'Moderation',       icon: Shield,     color: 'var(--color-warning)' },
  { id: 'security',      label: 'Security',         icon: Shield,     color: 'var(--color-danger)' },
  { id: 'diagnostics',   label: 'System Info',      icon: Server,     color: '#06b6d4' },
]

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width:'44px',height:'24px',borderRadius:'12px',flexShrink:0,cursor:'pointer',
      background: value ? 'linear-gradient(90deg,#4f46e5,#7c3aed)' : '#374151',
      position:'relative', transition:'background 0.2s',
    }}>
      <motion.div animate={{ x: value ? 22 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
        style={{ position:'absolute',top:'2px',width:'20px',height:'20px',borderRadius:'50%',
                 background:'white',boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
    </div>
  )
}

function NumInput({ value, onChange, min, max, step=1, prefix, suffix }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      {prefix && <span style={{ color:'var(--text-muted)', fontSize:'13px' }}>{prefix}</span>}
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="form-input" style={{ width:'110px', textAlign:'right' }} />
      {suffix && <span style={{ color:'var(--text-muted)', fontSize:'13px' }}>{suffix}</span>}
    </div>
  )
}

function Row({ label, desc, children, danger }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                  gap:'24px', padding:'18px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'14px', fontWeight:'600',
                      color: danger ? '#ef4444' : 'var(--text-primary)', marginBottom:'3px' }}>{label}</div>
        {desc && <div style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.5 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  )
}

function Card({ title, icon: Icon, color, children }) {
  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }}
      className="card" style={{ padding:'28px', marginBottom:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
        <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`${color}18`,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={color} />
        </div>
        <h3 style={{ fontSize:'17px', fontWeight:'700', color:'var(--text-primary)' }}>{title}</h3>
      </div>
      <div style={{ borderTop:'1px solid var(--border)', paddingTop:'4px' }}>{children}</div>
    </motion.div>
  )
}

function TagInput({ values, onChange }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !values.includes(v)) { onChange([...values, v]); setInput('') }
  }
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
        {values.map(tag => (
          <span key={tag} style={{ display:'inline-flex', alignItems:'center', gap:'4px',
            padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'500',
            background:'var(--color-accent-subtle)', color:'var(--color-primary)', border:'1px solid var(--color-accent-subtle)' }}>
            {tag}
            <X size={11} style={{ cursor:'pointer' }} onClick={() => onChange(values.filter(t => t !== tag))} />
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:'8px' }}>
        <input className="form-input" style={{ flex:1, fontSize:'13px', padding:'6px 12px' }}
          placeholder="Add entry, press Enter..." value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button onClick={add} style={{ padding:'6px 12px', borderRadius:'8px', border:'none',
          background:'var(--color-accent-subtle)', color:'var(--color-primary)', cursor:'pointer', fontSize:'13px' }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

function GeneralSection({ cfg, onChange }) {
  const s = cfg.general || {}
  const set = (k, v) => onChange({ ...cfg, general: { ...s, [k]: v } })
  return (
    <>
      <Card title="Platform Identity" icon={Globe} color="var(--color-accent)">
        <Row label="Platform Name" desc="Displayed across all pages and emails">
          <input className="form-input" style={{ width:'230px' }} value={s.platform_name||''} onChange={e=>set('platform_name',e.target.value)} />
        </Row>
        <Row label="Tagline" desc="Short description shown on the homepage hero">
          <input className="form-input" style={{ width:'320px', fontSize:'13px' }} value={s.tagline||''} onChange={e=>set('tagline',e.target.value)} />
        </Row>
        <Row label="Support Email" desc="All support queries are routed here">
          <input className="form-input" style={{ width:'230px' }} value={s.support_email||''} onChange={e=>set('support_email',e.target.value)} />
        </Row>
        <Row label="Contact Phone" desc="Displayed on the public contact page">
          <input className="form-input" style={{ width:'180px' }} value={s.contact_phone||''} onChange={e=>set('contact_phone',e.target.value)} />
        </Row>
        <Row label="Currency" desc="Platform currency (applied to orders and payouts)">
          <select className="form-input" style={{ width:'200px' }} value={s.currency||'INR'} onChange={e=>set('currency',e.target.value)}>
            <option value="INR">INR - Indian Rupee (Rs.)</option>
            <option value="USD">USD - US Dollar ($)</option>
            <option value="EUR">EUR - Euro (E)</option>
            <option value="GBP">GBP - British Pound</option>
          </select>
        </Row>
        <Row label="Timezone" desc="Server and reporting timezone">
          <select className="form-input" style={{ width:'220px' }} value={s.timezone||''} onChange={e=>set('timezone',e.target.value)}>
            <option>Asia/Kolkata (IST)</option>
            <option>UTC</option>
            <option>America/New_York (EST)</option>
            <option>Europe/London (GMT)</option>
            <option>Asia/Dubai (GST)</option>
          </select>
        </Row>
      </Card>
      <Card title="Maintenance Mode" icon={AlertTriangle} color="#f59e0b">
        <Row label="Enable Maintenance Mode" desc="Blocks all non-admin users and shows the maintenance message" danger={s.maintenance_mode}>
          <Toggle value={!!s.maintenance_mode} onChange={v=>set('maintenance_mode',v)} />
        </Row>
        <Row label="Maintenance Message" desc="Shown to users when the platform is under maintenance">
          <textarea className="form-input" style={{ width:'340px', minHeight:'72px', fontSize:'13px', resize:'vertical' }}
            value={s.maintenance_message||''} onChange={e=>set('maintenance_message',e.target.value)} />
        </Row>
      </Card>
    </>
  )
}

function FinancialSection({ cfg, onChange }) {
  const s = cfg.financial || {}
  const set = (k, v) => onChange({ ...cfg, financial: { ...s, [k]: v } })
  return (
    <Card title="Financial Configuration" icon={CreditCard} color="#059669">
      <Row label="Platform Commission %" desc="Percentage taken from each completed order payment">
        <NumInput value={s.commission_percentage??20} onChange={v=>set('commission_percentage',v)} min={0} max={50} suffix="%" />
      </Row>
      <Row label="Minimum Order Budget" desc="Clients cannot place orders below this amount">
        <NumInput value={s.min_order_budget??500} onChange={v=>set('min_order_budget',v)} min={0} prefix="Rs." />
      </Row>
      <Row label="Maximum Order Budget" desc="Largest budget a client can set for an order">
        <NumInput value={s.max_order_budget??500000} onChange={v=>set('max_order_budget',v)} min={0} prefix="Rs." />
      </Row>
      <Row label="Creator Payout Threshold" desc="Minimum balance required before a creator can withdraw">
        <NumInput value={s.creator_payout_threshold??2000} onChange={v=>set('creator_payout_threshold',v)} min={0} prefix="Rs." />
      </Row>
      <Row label="Escrow Hold Period" desc="Days funds are held in escrow after order completion">
        <NumInput value={s.escrow_hold_days??7} onChange={v=>set('escrow_hold_days',v)} min={1} max={30} suffix="days" />
      </Row>
      <Row label="Payment Gateway" desc="Active payment processor for this deployment">
        <input className="form-input" style={{ width:'280px' }} value={s.payment_gateway||''} onChange={e=>set('payment_gateway',e.target.value)} />
      </Row>
      <Row label="Auto-Refund on Cancellation" desc="Automatically trigger refund when order is cancelled">
        <Toggle value={!!s.auto_refund_on_cancel} onChange={v=>set('auto_refund_on_cancel',v)} />
      </Row>
      <Row label="Allow Crypto Payouts" desc="Let creators receive earnings in supported cryptocurrencies">
        <Toggle value={!!s.allow_crypto_payouts} onChange={v=>set('allow_crypto_payouts',v)} />
      </Row>
    </Card>
  )
}

function CreatorRulesSection({ cfg, onChange }) {
  const s = cfg.creator_rules || {}
  const set = (k, v) => onChange({ ...cfg, creator_rules: { ...s, [k]: v } })
  return (
    <>
      <Card title="Creator Approval and Verification" icon={Star} color="var(--color-accent)">
        <Row label="Auto-Approve New Creators" desc="Skip manual review - new creators are instantly approved upon registration">
          <Toggle value={!!s.auto_approve_creators} onChange={v=>set('auto_approve_creators',v)} />
        </Row>
        <Row label="Require Portfolio Approval" desc="Admin must review and approve portfolio items before they appear publicly">
          <Toggle value={!!s.require_portfolio_approval} onChange={v=>set('require_portfolio_approval',v)} />
        </Row>
        <Row label="Auto-Verify After (Orders)" desc="Creators with this many completed orders get the verified badge automatically">
          <NumInput value={s.auto_verify_min_orders??10} onChange={v=>set('auto_verify_min_orders',v)} min={1} max={100} suffix="orders" />
        </Row>
        <Row label="Auto-Verify Min Rating" desc="Minimum average rating for auto-verification">
          <NumInput value={s.auto_verify_min_rating??4.8} onChange={v=>set('auto_verify_min_rating',v)} min={1} max={5} step={0.1} suffix="/ 5.0" />
        </Row>
      </Card>
      <Card title="Creator Limits and Features" icon={Users} color="var(--color-accent)">
        <Row label="Max Concurrent Orders" desc="Maximum active orders a creator can handle simultaneously">
          <NumInput value={s.max_concurrent_orders??5} onChange={v=>set('max_concurrent_orders',v)} min={1} max={50} />
        </Row>
        <Row label="Allow Direct Messaging" desc="Creators can message clients before an order is placed">
          <Toggle value={!!s.allow_direct_messaging} onChange={v=>set('allow_direct_messaging',v)} />
        </Row>
        <Row label="Featured Creator Slots" desc="Number of creators shown in the Featured section on the marketplace homepage">
          <NumInput value={s.featured_creator_slots??6} onChange={v=>set('featured_creator_slots',v)} min={2} max={24} />
        </Row>
      </Card>
      <Card title="Supported AI Tools" icon={Sparkles} color="var(--color-accent)">
        <div style={{ paddingTop:'12px' }}>
          <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'12px' }}>
            Tools listed here appear as selectable tags on creator profiles and filters in the marketplace.
          </div>
          <TagInput values={s.supported_ai_tools||[]} onChange={v=>set('supported_ai_tools',v)} />
        </div>
      </Card>
    </>
  )
}

function ModerationSection({ cfg, onChange }) {
  const s = cfg.moderation || {}
  const set = (k, v) => onChange({ ...cfg, moderation: { ...s, [k]: v } })
  const OPTS = ['low', 'medium', 'high', 'strict']
  return (
    <>
      <Card title="Chat Auto-Moderation" icon={Shield} color="#f59e0b">
        <Row label="Enable Auto-Moderation" desc="Automatically flag messages containing disallowed content">
          <Toggle value={!!s.chat_auto_moderation} onChange={v=>set('chat_auto_moderation',v)} />
        </Row>
        <Row label="Sensitivity Level" desc="How aggressively to flag messages (low = few flags, strict = maximum coverage)">
          <div style={{ display:'flex', gap:'6px' }}>
            {OPTS.map(opt => (
              <button key={opt} onClick={() => set('moderation_sensitivity', opt)}
                style={{ padding:'5px 12px', borderRadius:'8px', border:'none', cursor:'pointer',
                  fontSize:'12px', fontWeight:'600', textTransform:'capitalize',
                  background: s.moderation_sensitivity===opt ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                  color: s.moderation_sensitivity===opt ? 'white' : 'var(--text-muted)', transition:'all 0.15s' }}>
                {opt}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Flagged Keywords" desc="Messages containing these phrases are auto-flagged for admin review">
          <div style={{ minWidth:'340px' }}>
            <TagInput values={s.flagged_keywords||[]} onChange={v=>set('flagged_keywords',v)} />
          </div>
        </Row>
      </Card>
    </>
  )
}

function SecuritySection({ cfg, onChange }) {
  const s = cfg.security || {}
  const set = (k, v) => onChange({ ...cfg, security: { ...s, [k]: v } })
  return (
    <Card title="Security and Access Control" icon={Lock} color="#ef4444">
      <Row label="Enforce Strong Passwords" desc="Require passwords with uppercase, lowercase, numbers and symbols">
        <Toggle value={!!s.enforce_strong_passwords} onChange={v=>set('enforce_strong_passwords',v)} />
      </Row>
      <Row label="Session Timeout" desc="Automatically log out users after inactivity">
        <NumInput value={s.session_timeout_minutes??10080} onChange={v=>set('session_timeout_minutes',v)} min={60} max={43200} suffix="min" />
      </Row>
      <Row label="Max Login Attempts" desc="Lock account after this many failed attempts in 10 minutes">
        <NumInput value={s.max_login_attempts??5} onChange={v=>set('max_login_attempts',v)} min={3} max={20} />
      </Row>
      <Row label="Rate Limiting" desc="Throttle API requests to prevent brute-force and scraping">
        <Toggle value={!!s.rate_limiting_enabled} onChange={v=>set('rate_limiting_enabled',v)} />
      </Row>
      <Row label="Admin Email Alerts" desc="Send email to admin for critical events">
        <Toggle value={!!s.admin_email_alerts} onChange={v=>set('admin_email_alerts',v)} />
      </Row>
      <Row label="Instant Dispute Alert" desc="Ping admin email immediately when a new dispute is filed">
        <Toggle value={!!s.dispute_immediate_alert} onChange={v=>set('dispute_immediate_alert',v)} />
      </Row>
      <Row label="High-Value Order Alert" desc="Alert admin when an order exceeds this budget threshold">
        <NumInput value={s.high_value_order_alert_threshold??50000} onChange={v=>set('high_value_order_alert_threshold',v)} min={1000} prefix="Rs." />
      </Row>
    </Card>
  )
}

function DiagnosticsSection({ diag }) {
  if (!diag) return null
  const rows = [
    { icon: Database,   label: 'Database Type',     value: diag.database_type },
    { icon: Server,     label: 'Database Path',     value: diag.database_url_masked },
    { icon: Clock,      label: 'Server Time (UTC)', value: diag.server_time?.replace('T',' ').replace('Z','') + ' UTC' },
    { icon: Globe,      label: 'Frontend URL',      value: diag.frontend_url },
    { icon: Lock,       label: 'Session Expiry',    value: `${diag.access_token_expire_minutes} min (${Math.round(diag.access_token_expire_minutes/60/24)} days)` },
    { icon: Shield,     label: 'Admin Account',     value: diag.admin_email },
  ]
  const stats = [
    { label:'Total Users',    value: diag.total_users,    icon: Users,      color:'var(--color-accent)' },
    { label:'Total Creators', value: diag.total_creators, icon: Star,       color:'var(--color-accent)' },
    { label:'Total Clients',  value: diag.total_clients,  icon: TrendingUp, color:'#059669' },
    { label:'Total Orders',   value: diag.total_orders,   icon: Tag,        color:'#f59e0b' },
  ]
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'20px' }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="stat-card">
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:`${color}18`,
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div style={{ fontSize:'28px', fontWeight:'900', color:'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{label}</div>
          </motion.div>
        ))}
      </div>
      <Card title="System Diagnostics" icon={Server} color="#06b6d4">
        {rows.map(({ icon: Icon, label, value }) => (
          <Row key={label} label={label}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'5px 14px',
              borderRadius:'8px', background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.15)',
              fontSize:'13px', fontWeight:'500', color:'var(--text-secondary)', maxWidth:'360px' }}>
              <Icon size={12} color="#06b6d4" />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</span>
            </div>
          </Row>
        ))}
      </Card>
    </>
  )
}

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState('general')
  const [cfg, setCfg]     = useState(null)
  const [diag, setDiag]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    adminAPI.getSettings()
      .then(r => { setCfg(r.data.settings); setDiag(r.data.diagnostics); setDirty(false) })
      .catch(() => toast.error('Failed to load platform settings'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleChange = c => { setCfg(c); setDirty(true) }

  const handleSave = async () => {
    setSaving(true)
    try { await adminAPI.updateSettings(cfg); toast.success('Settings saved!'); setDirty(false) }
    catch { toast.error('Failed to save settings.') }
    finally { setSaving(false) }
  }

  const handleReset = async () => {
    if (!window.confirm('Reset ALL platform settings to factory defaults?')) return
    try { await adminAPI.resetSettings(); toast.success('Settings restored to defaults!'); load() }
    catch { toast.error('Reset failed.') }
  }

  if (loading) return (
    <div style={{ padding:'32px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'20px', marginBottom:'24px' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:'100px', borderRadius:'14px' }} />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:'220px', borderRadius:'14px', marginBottom:'16px' }} />)}
    </div>
  )

  return (
    <div style={{ padding:'32px', background:'var(--bg-primary)', minHeight:'100vh' }}>
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:'28px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
          <div>
            <h1 style={{ fontSize:'28px', fontWeight:'800', color:'var(--text-primary)', marginBottom:'6px',
                         display:'flex', alignItems:'center', gap:'10px' }}>
              <Settings size={28} style={{ color:'var(--color-accent)' }} />
              Platform Settings
            </h1>
            <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>
              Configure every aspect of the AI CreatorHub platform.
            </p>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            {dirty && (
              <motion.span initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
                style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'600',
                         background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.25)' }}>
                Unsaved changes
              </motion.span>
            )}
            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={handleReset}
              style={{ padding:'9px 18px', borderRadius:'10px', border:'none', cursor:'pointer',
                background:'rgba(239,68,68,0.1)', color:'#ef4444',
                fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'6px' }}>
              <RotateCcw size={14} /> Reset Defaults
            </motion.button>
            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
              onClick={handleSave} disabled={saving || !dirty}
              style={{ padding:'9px 22px', borderRadius:'10px', border:'none',
                cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                background: dirty ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                color: dirty ? 'white' : 'var(--text-muted)',
                fontSize:'13px', fontWeight:'700', display:'flex', alignItems:'center', gap:'6px',
                opacity: saving ? 0.7 : 1,
                boxShadow: dirty ? '0 4px 15px rgba(15,118,110,0.25)' : 'none', transition:'all 0.2s' }}>
              {saving ? <Loader size={14}/> : <Save size={14}/>}
              {saving ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'24px', flexWrap:'wrap' }}>
        {SECTIONS.map(sec => {
          const active = activeSection === sec.id
          return (
            <motion.button key={sec.id} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
              onClick={() => setActiveSection(sec.id)}
              style={{ padding:'8px 18px', borderRadius:'10px', border:'none', cursor:'pointer',
                background: active ? `linear-gradient(135deg,${sec.color}cc,${sec.color}88)` : 'rgba(255,255,255,0.05)',
                color: active ? 'white' : 'var(--text-muted)',
                fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'6px',
                boxShadow: active ? `0 4px 14px ${sec.color}33` : 'none', transition:'all 0.18s' }}>
              <sec.icon size={14} />
              {sec.label}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <div key={activeSection}>
          {activeSection === 'general'       && <GeneralSection       cfg={cfg} onChange={handleChange} />}
          {activeSection === 'financial'     && <FinancialSection     cfg={cfg} onChange={handleChange} />}
          {activeSection === 'creator_rules' && <CreatorRulesSection  cfg={cfg} onChange={handleChange} />}
          {activeSection === 'moderation'    && <ModerationSection    cfg={cfg} onChange={handleChange} />}
          {activeSection === 'security'      && <SecuritySection      cfg={cfg} onChange={handleChange} />}
          {activeSection === 'diagnostics'   && <DiagnosticsSection   diag={diag} />}
        </div>
      </AnimatePresence>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
            style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
              background:'rgba(15,23,42,0.95)', backdropFilter:'blur(16px)',
              border:'1px solid rgba(15,118,110,0.25)', borderRadius:'16px',
              padding:'14px 24px', display:'flex', alignItems:'center', gap:'16px',
              boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:1000 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <span style={{ color:'white', fontSize:'14px', fontWeight:'500' }}>You have unsaved changes</span>
            <button onClick={load} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
              background:'rgba(255,255,255,0.08)', color:'var(--text-muted)', fontSize:'13px', fontWeight:'600' }}>
              Discard
            </button>
            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} onClick={handleSave} disabled={saving}
              style={{ padding:'6px 18px', borderRadius:'8px', border:'none', cursor:'pointer',
                background:'var(--color-primary)', color:'white',
                fontSize:'13px', fontWeight:'700', display:'flex', alignItems:'center', gap:'6px' }}>
              {saving ? <Loader size={13}/> : <Save size={13}/>}
              {saving ? 'Saving...' : 'Save Now'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}