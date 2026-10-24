import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { creatorsAPI, ordersAPI, paymentsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import { ChevronLeft, Clock, DollarSign, CreditCard, CheckCircle, ShieldCheck, Zap } from 'lucide-react'
import { formatMoney } from '../../utils/format'

const categories = [
  'AI Video Creation', 'AI Image Generation', 'UGC Ads',
  'Instagram Reels', 'YouTube Shorts', 'AI Animation',
  'Voiceover', 'Prompt Engineering'
]

export default function HireCreatorPage() {
  const { creatorId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1) // 1: Brief, 2: Payment, 3: Confirm
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('simulated') // 'razorpay' or 'simulated'

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    budget: '',
    deadline: '',
    requirements: '',
    selected_service_id: null,
  })

  useEffect(() => {
    creatorsAPI.getById(creatorId)
      .then(r => setCreator(r.data))
      .catch(() => { toast.error('Creator not found'); navigate('/creators') })
      .finally(() => setLoading(false))
  }, [creatorId])


  const handlePlaceOrder = async () => {
    if (!form.title || !form.category || !form.budget) {
      toast.error('Fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const orderRes = await ordersAPI.create({
        creator_id: parseInt(creatorId),
        title: form.title,
        description: form.description,
        category: form.category,
        budget: parseFloat(form.budget),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        requirements: form.requirements,
        service_id: form.selected_service_id,
      })
      const newOrderId = orderRes.data.id
      setOrderId(newOrderId)

      if (paymentMethod === 'razorpay' && window.Razorpay) {
        const paymentRes = await paymentsAPI.create({
          order_id: newOrderId,
          amount: parseFloat(form.budget),
          payment_gateway: 'razorpay',
        })

        if (paymentRes.data?.razorpay_order_id) {
          const options = {
            key: paymentRes.data.razorpay_key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: Math.round(parseFloat(form.budget) * 100),
            currency: 'INR',
            name: 'AI CreatorHub',
            description: `Order #${newOrderId} - ${form.title}`,
            order_id: paymentRes.data.razorpay_order_id,
            handler: async function (response) {
              try {
                await paymentsAPI.verify({
                  order_id: newOrderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  amount: parseFloat(form.budget),
                })
                setStep(3)
                toast.success('Payment verified & order placed! 🎉')
              } catch (vErr) {
                const msg = typeof vErr.response?.data?.detail === 'string' ? vErr.response.data.detail : 'Verification failed'
                toast.error(msg)
              } finally {
                setSubmitting(false)
              }
            },
            prefill: {
              name: user?.name || '',
              email: user?.email || '',
            },
            theme: {
              color: 'var(--color-accent)',
            },
            modal: {
              ondismiss: function () {
                setSubmitting(false)
                toast('Payment modal closed. You can complete payment from Order page.', { icon: 'ℹ️' })
                navigate(`/client/orders/${newOrderId}`)
              }
            }
          }
          const rzp = new window.Razorpay(options)
          rzp.on('payment.failed', function (failRes) {
            toast.error(failRes.error?.description || 'Payment failed')
            setSubmitting(false)
          })
          rzp.open()
          return
        }
      }

      // Simulated instant test payment
      const paymentRes = await paymentsAPI.create({
        order_id: newOrderId,
        amount: parseFloat(form.budget),
        payment_gateway: 'simulated',
      })
      await paymentsAPI.verify({
        order_id: newOrderId,
        payment_id: paymentRes.data.id || paymentRes.data.payment_id,
        transaction_id: paymentRes.data.transaction_id || `TXN_${Date.now()}`,
        amount: parseFloat(form.budget),
      })

      setStep(3)
      toast.success('Order placed & payment processed! 🎉')
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : Array.isArray(err.response?.data?.detail)
          ? err.response.data.detail.map(d => (typeof d === 'object' && d?.msg ? d.msg : String(d))).join(', ')
          : (err.response?.data?.message || err.message || 'Failed to place order')
      toast.error(errorMsg)
    } finally {
      if (paymentMethod !== 'razorpay') {
        setSubmitting(false)
      }
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-accent-subtle)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // Step 3 — Success
  if (step === 3) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '60px 40px', maxWidth: '500px' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}
        >
          <CheckCircle size={40} color="white" />
        </motion.div>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px' }}>Order Placed! 🎉</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '32px', lineHeight: '1.7' }}>
          Your order <strong>#{orderId}</strong> has been placed and payment processed successfully.
          The creator will review and accept your order shortly.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => navigate(`/client/orders/${orderId}`)} className="btn-gradient" style={{ padding: '14px 28px' }}>
            View Order
          </button>
          <button onClick={() => navigate('/client/dashboard')} style={{ padding: '14px 28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
            Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: '70px' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '12px 24px' }}>
        <div className="container-custom">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '14px' }}>
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="container-custom" style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '36px' }}>
          {[{ n: 1, label: 'Project Brief' }, { n: 2, label: 'Review & Pay' }].map(({ n, label }, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px',
                  background: step >= n ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: step >= n ? 'white' : 'var(--text-muted)',
                  border: `2px solid ${step >= n ? 'var(--color-accent)' : 'var(--border-color)'}`
                }}>
                  {step > n ? '✓' : n}
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: step >= n ? 'var(--color-accent)' : 'var(--text-muted)' }}>{label}</span>
              </div>
              {i < 1 && <div style={{ flex: 1, height: '2px', background: step > n ? 'var(--color-accent)' : 'var(--border-color)', margin: '0 8px', marginBottom: '20px' }} />}
            </div>
          ))}
        </div>

        <div className="hire-layout">
          <div>
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="card" style={{ padding: '32px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '24px' }}>📋 Project Brief</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Project Title *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Brand video for my skincare product" className="input-base" required />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Category *</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-base" required>
                      <option value="">Select category</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Project Description *</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe your project in detail..." className="input-base" rows={5} style={{ resize: 'vertical' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Budget (₹) *</label>
                      <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                        placeholder="e.g. 10000" className="input-base" required min="100" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Deadline</label>
                      <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="input-base"
                        min={new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Special Requirements</label>
                    <textarea value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                      placeholder="Any specific requirements, brand guidelines, references..." className="input-base" rows={3} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <button onClick={() => {
                  if (!form.title || !form.category || !form.budget) { toast.error('Fill required fields'); return }
                  setStep(2)
                }} className="btn-gradient" style={{ width: '100%', padding: '14px', marginTop: '24px', fontSize: '16px' }}>
                  Review Order →
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card" style={{ padding: '32px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '24px' }}>💳 Review & Pay</h2>

                {/* Order Summary */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>Order Summary</h3>
                  {[
                    { label: 'Project', value: form.title },
                    { label: 'Category', value: form.category },
                    { label: 'Creator', value: creator?.name },
                    { label: 'Deadline', value: form.deadline || 'Flexible' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Payment breakdown */}
                <div style={{ background: 'var(--color-primary-subtle)', border: '1px solid var(--color-accent-subtle)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>Payment Details</h3>
                  {[
                    { label: 'Project Budget', value: formatMoney(form.budget) },
                    { label: 'Platform Fee (0%)', value: '₹0', color: 'var(--color-success)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-accent-subtle)', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: '700', color: color || 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: '18px' }}>
                    <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontWeight: '900', color: 'var(--color-accent)' }}>{formatMoney(form.budget)}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Select Payment Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '12px' }}>
                    <div
                      onClick={() => setPaymentMethod('razorpay')}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: `2px solid ${paymentMethod === 'razorpay' ? 'var(--color-accent)' : 'var(--border-color)'}`,
                        background: paymentMethod === 'razorpay' ? 'rgba(79,70,229,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <ShieldCheck size={18} color="var(--color-accent)" />
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Razorpay</span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>UPI, Cards, Netbanking</p>
                    </div>

                    <div
                      onClick={() => setPaymentMethod('simulated')}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: `2px solid ${paymentMethod === 'simulated' ? '#059669' : 'var(--border-color)'}`,
                        background: paymentMethod === 'simulated' ? 'rgba(5,150,105,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Zap size={18} color="#059669" />
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Simulated</span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Instant Escrow Demo</p>
                    </div>
                  </div>
                </div>

                {/* Escrow Guarantee Notice */}
                <div style={{ padding: '14px 16px', background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-subtle)', borderRadius: '12px', marginBottom: '24px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={18} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                  <span><strong>100% Escrow Protection:</strong> Funds are held safely and only released when you review and approve creator's delivery.</span>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={handlePlaceOrder} disabled={submitting} className="btn-gradient" style={{ flex: 2, padding: '14px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {submitting ? (
                      <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <><CreditCard size={18} /> {paymentMethod === 'razorpay' ? 'Pay with Razorpay' : 'Place Order & Pay'}</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Creator Card Sidebar */}
          {creator && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '24px', position: 'sticky', top: '90px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img src={creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.name)}&background=0F766E&color=fff`}
                  alt={creator.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />
                <div style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>{creator.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{creator.headline}</div>
                {creator.is_verified && <span className="verified-badge">✓ Verified</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: '800', color: 'var(--color-warning)' }}>⭐ {creator.rating}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rating</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{creator.total_orders}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Orders</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Starting at <span style={{ fontWeight: '800', color: 'var(--color-accent)', fontSize: '16px' }}>{formatMoney(creator.starting_price)}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
