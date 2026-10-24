import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ArrowLeft, Home, Send, Sparkles, Loader, RotateCcw } from 'lucide-react'
import { helpbotAPI } from '../../services/api'

const starter = {
  role: 'assistant',
  content: 'Hi! I’m your Gemini Assistant for AI CreatorHub. Ask me about your projects, orders, Video Studio, AI Generator, delivery reviews, or creator workflow. You can write in English or Tamil.',
}

export default function GeminiAssistantPage() {
  const [messages, setMessages] = useState([starter])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    helpbotAPI.status().then(() => setOnline(true)).catch(() => setOnline(false))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const sendMessage = async (event) => {
    event?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    const previousHistory = messages.filter((_, index) => index > 0)
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setSending(true)
    try {
      const response = await helpbotAPI.chat(text, previousHistory)
      const history = response.data?.history
      if (Array.isArray(history) && history.length) setMessages([starter, ...history])
      else if (response.data?.reply) setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error.response?.data?.detail || 'Gemini is temporarily unavailable. Please try again in a moment.',
      }])
    } finally {
      setSending(false)
    }
  }

  const resetChat = () => setMessages([starter])
  const ask = (text) => { setInput(text); setTimeout(() => document.getElementById('gemini-chat-input')?.focus(), 0) }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          <Link to="/creator/dashboard" style={navBtn}><ArrowLeft size={16} /> Creator Dashboard</Link>
          <Link to="/creator/ai-generator" style={navBtn}><Sparkles size={16} /> AI Generator</Link>
          <Link to="/" style={navBtn}><Home size={16} /> Home</Link>
        </div>

        <div style={headerCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={iconBox}><Bot size={25} color="#fff" /></div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: 'var(--text-primary)' }}>Gemini Creator Assistant</h1>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                Your private AI guide for creator projects and platform workflow.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: online === false ? '#ef4444' : '#10b981' }} />
            {online === false ? 'Offline' : 'Gemini online'}
          </div>
        </div>

        <div style={layout}>
          <section style={chatCard}>
            <div style={chatHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-primary)' }}>
                <Bot size={17} color="var(--color-accent)" /> Chat with Gemini
              </div>
              <button onClick={resetChat} type="button" style={smallButton}><RotateCcw size={13} /> New chat</button>
            </div>
            <div style={messagesBox}>
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  <div style={{ ...bubble, background: message.role === 'user' ? 'var(--color-accent)' : 'var(--bg-secondary)', color: message.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                    {message.content}
                  </div>
                </div>
              ))}
              {sending && <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', gap: 7, alignItems: 'center' }}><Loader size={14} className="spin" /> Gemini is thinking…</div>}
              <div ref={endRef} />
            </div>
            <form onSubmit={sendMessage} style={composer}>
              <input id="gemini-chat-input" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Gemini about your creator work…" maxLength={1000} style={inputStyle} />
              <button type="submit" disabled={!input.trim() || sending} style={{ ...sendButton, opacity: !input.trim() || sending ? 0.55 : 1 }}><Send size={16} /> Send</button>
            </form>
          </section>

          <aside style={sideCard}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15 }}>Try asking</h3>
            {[
              'How do I improve my creator profile?',
              'What should I do after a client order is assigned?',
              'How do I submit a video for admin review?',
              'என் project workflow என்ன?',
            ].map(question => <button key={question} type="button" onClick={() => ask(question)} style={suggestion}>{question}</button>)}
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, margin: '14px 0 0' }}>
              Gemini can explain CreatorHub features and your creator workflow. It cannot approve deliveries, change orders, or perform account actions.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

const navBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }
const headerCard = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20, marginBottom: 14 }
const iconBox = { width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }
const layout = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 14 }
const chatCard = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, overflow: 'hidden' }
const chatHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }
const smallButton = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', fontSize: 12 }
const messagesBox = { minHeight: 440, maxHeight: '58vh', overflowY: 'auto', padding: 18 }
const bubble = { maxWidth: '82%', padding: '11px 14px', borderRadius: 14, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14 }
const composer = { display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--border-color)' }
const inputStyle = { flex: 1, minWidth: 0, border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }
const sendButton = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '10px 14px', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const sideCard = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 16, alignSelf: 'start' }
const suggestion = { display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: 9, padding: '10px 11px', marginTop: 9, cursor: 'pointer', fontSize: 12, lineHeight: 1.4 }
