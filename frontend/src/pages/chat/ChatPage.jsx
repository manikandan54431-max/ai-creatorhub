import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { chatsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { Send, Search, MessageCircle, Paperclip, Image, ChevronLeft } from 'lucide-react'

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://manihub-hhznnkea.manus.space'

export default function ChatPage() {
  const { user } = useAuthStore()
  const location = useLocation()
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    fetchChats()
  }, [])

  useEffect(() => {
    // Auto-open chat from navigation state
    if (location.state?.chatId && chats.length > 0) {
      const chat = chats.find(c => c.id === location.state.chatId)
      if (chat) openChat(chat)
    }
  }, [location.state, chats])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => wsRef.current?.close()
  }, [])

  const fetchChats = async () => {
    try {
      const res = await chatsAPI.getAll()
      setChats(res.data)
    } catch {} finally { setLoading(false) }
  }

  const openChat = async (chat) => {
    setActiveChat(chat)
    // Close old WebSocket
    if (wsRef.current) wsRef.current.close()
    
    try {
      const res = await chatsAPI.getMessages(chat.id)
      setMessages(res.data)
    } catch {}

    // Open WebSocket
    const token = localStorage.getItem('token')
    const ws = new WebSocket(`${WS_URL}/api/chats/ws/${chat.id}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, last_message: msg.message } : c))
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChat || sending) return
    setSending(true)
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ message: newMessage.trim() }))
      } else {
        // Fallback to REST
        const res = await chatsAPI.sendMessage(activeChat.id, { message: newMessage.trim() })
        setMessages(prev => [...prev, res.data])
      }
      setNewMessage('')
    } catch {} finally { setSending(false) }
  }

  const getOtherUser = (chat) => {
    return user?.role === 'client' ? chat.creator : chat.client
  }

  const filteredChats = chats.filter(c => {
    const other = getOtherUser(c)
    return !search || other?.name?.toLowerCase().includes(search.toLowerCase())
  })

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      height: '100vh', paddingTop: '70px',
      display: 'flex', background: 'var(--color-background)', overflow: 'hidden'
    }}>
      {/* Chat List Sidebar */}
      <div style={{
        width: '320px', flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column'
      }} className="chat-sidebar">
        {/* Header */}
        <div style={{ padding: '18px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '14px', fontSize: '17px' }}>
            💬 Messages
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '13px', width: '100%' }}
            />
          </div>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '16px' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px', marginBottom: '4px' }}>
                  <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '13px', width: '60%', marginBottom: '6px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '11px', width: '80%', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '14px' }}>No conversations yet</p>
            </div>
          ) : (
            filteredChats.map(chat => {
              const other = getOtherUser(chat)
              const isActive = activeChat?.id === chat.id
              return (
                <motion.div
                  key={chat.id}
                  whileHover={{ backgroundColor: 'var(--bg-secondary)' }}
                  onClick={() => openChat(chat)}
                  style={{
                    display: 'flex', gap: '12px', padding: '14px 16px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={other?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.name || 'U')}&background=0F766E&color=fff`}
                      alt=""
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: '#22c55e',
                      border: '2px solid var(--bg-card)'
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {other?.name || 'Unknown'}
                      </span>
                      {chat.unread_count > 0 && (
                        <span style={{
                          background: 'var(--color-primary)', color: 'var(--color-primary-foreground)',
                          borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                          padding: '1px 7px', flexShrink: 0
                        }}>{chat.unread_count}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chat.last_message || 'Start a conversation...'}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      {!activeChat ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '72px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Select a Conversation</h3>
            <p style={{ fontSize: '14px' }}>Choose a chat from the left to start messaging</p>
          </motion.div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat Header */}
          <div style={{
            padding: '16px 24px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            {(() => {
              const other = getOtherUser(activeChat)
              return (
                <>
                  <button
                    onClick={() => setActiveChat(null)}
                    className="chat-mobile-back"
                    title="Back to conversations"
                    style={{
                      display: 'none',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: '6px', marginRight: '4px',
                      borderRadius: '8px'
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={other?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.name || 'U')}&background=0F766E&color=fff`}
                      alt=""
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: '11px', height: '11px', borderRadius: '50%',
                      background: '#22c55e', border: '2px solid var(--bg-card)'
                    }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>{other?.name}</div>
                    <div style={{ fontSize: '12px', color: wsConnected ? '#22c55e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected ? '#22c55e' : 'var(--color-text-muted)' }} />
                      {wsConnected ? 'Online' : 'Connecting...'}
                    </div>
                  </div>
                  {activeChat.order_id && (
                    <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
                      Order #{activeChat.order_id}
                    </span>
                  )}
                </>
              )
            })()}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AnimatePresence>
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}
                  >
                    {!isMine && (
                      <img
                        src={msg.sender?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.name || 'U')}&background=0F766E&color=fff`}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ maxWidth: '65%' }}>
                      {!isMine && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>{msg.sender?.name}</div>}
                      <div className={isMine ? 'chat-bubble-sent' : 'chat-bubble-received'}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                        {formatTime(msg.created_at)} {isMine && (msg.is_read ? '✓✓' : '✓')}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div style={{
            padding: '16px 20px',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)'
          }} className="chat-composer">
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="form-input"
                  style={{ width: '100%' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
                />
              </div>
              <motion.button
                type="submit"
                disabled={!newMessage.trim() || sending}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: '46px', height: '46px',
                  background: newMessage.trim() ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  border: 'none', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: newMessage.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s', flexShrink: 0
                }}
              >
                <Send size={18} color={newMessage.trim() ? 'var(--color-primary-foreground)' : 'var(--color-text-muted)'} />
              </motion.button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
