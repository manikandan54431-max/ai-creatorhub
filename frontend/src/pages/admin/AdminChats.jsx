import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDate, formatNumber } from '../../utils/format'

/**
 * Admin chat monitoring.
 *
 * Every conversation and message shown here is fetched from the backend under
 * the admin moderation permission (`require_admin` on /api/admin/chats). No
 * conversations, messages, participants or counts are fabricated locally, and
 * nothing is created as a side effect of viewing.
 */
export default function AdminChats() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState(null)

  const loadChats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getChats()
      const data = res.data
      setChats(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      // A failed request must not be rendered as "no conversations".
      setError(err.response?.data?.detail || err.message || 'Could not load conversations')
      setChats([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadChats() }, [loadChats])

  const openChat = useCallback(async (chat) => {
    setActiveChat(chat)
    setMessages([])
    setMessagesError(null)
    setMessagesLoading(true)
    try {
      const res = await adminAPI.getChatMessages(chat.id)
      const data = res.data
      setMessages(Array.isArray(data) ? data : (data?.items ?? []))
    } catch (err) {
      setMessagesError(err.response?.data?.detail || 'Could not load messages for this conversation')
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  const handleBlockChat = async (chat) => {
    const verb = chat.is_blocked ? 'unblock' : 'block'
    if (!window.confirm(`${verb === 'block' ? 'Block' : 'Unblock'} the conversation between ${chat.client_name || 'this client'} and ${chat.creator_name || 'this creator'}?`)) {
      return
    }
    try {
      const res = await adminAPI.blockChat(chat.id)
      // Trust the server's resulting state rather than guessing it locally.
      const blocked = res.data?.is_blocked ?? !chat.is_blocked
      setChats(prev => prev.map(c => (c.id === chat.id ? { ...c, is_blocked: blocked } : c)))
      if (activeChat?.id === chat.id) setActiveChat(a => ({ ...a, is_blocked: blocked }))
      toast.success(blocked ? 'Conversation blocked' : 'Conversation unblocked')
    } catch (err) {
      toast.error(err.response?.data?.detail || `Could not ${verb} this conversation`)
    }
  }

  const handleFlagMessage = async (chatId, msg) => {
    try {
      const res = await adminAPI.flagMessage(chatId, msg.id)
      const flagged = res.data?.flagged ?? !msg.is_flagged
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, is_flagged: flagged } : m)))
      toast.success(flagged ? 'Message flagged' : 'Flag removed')
    } catch (err) {
      // No optimistic flip on failure — the UI must match the database.
      toast.error(err.response?.data?.detail || 'Could not update the flag')
    }
  }

  const panel = {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: '16px', overflow: 'hidden',
  }

  return (
    <div style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
            <MessageSquare size={22} style={{ display: 'inline', marginRight: '10px', color: 'var(--color-accent)' }} />
            Chat Monitoring
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Monitor real client–creator conversations</p>
        </div>
        <button
          onClick={loadChats}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
        {/* ── Conversation list ────────────────────────────────────────── */}
        <div style={panel}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: '700', color: 'var(--text-primary)' }}>
            All Conversations {!loading && !error && `(${formatNumber(chats.length)})`}
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '60px', margin: '8px', borderRadius: '8px' }} />
              ))
            ) : error ? (
              /* Error state — never confused with an empty inbox. */
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <AlertTriangle size={32} style={{ color: 'var(--color-danger)', marginBottom: '12px' }} />
                <p style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Could not load conversations
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
                <button onClick={loadChats} className="btn-gradient" style={{ padding: '9px 20px', fontSize: '13px' }}>
                  Retry
                </button>
              </div>
            ) : chats.length === 0 ? (
              /* Honest empty state — no records means no records. */
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '14px' }} />
                <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  No conversations yet
                </p>
                <p style={{ fontSize: '13px' }}>
                  Client–creator conversations appear here as soon as they start. Use Refresh to pick up new ones.
                </p>
              </div>
            ) : chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => openChat(chat)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat(chat) } }}
                style={{
                  padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                  background: activeChat?.id === chat.id ? 'var(--color-accent-subtle)' : 'transparent',
                  borderLeft: activeChat?.id === chat.id ? '3px solid #4f46e5' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {/* A deleted participant shows as unknown, not as a blank. */}
                    {chat.client_name || 'Unknown client'} ↔ {chat.creator_name || 'Unknown creator'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {chat.is_blocked && (
                      <span style={{ fontSize: '10px', background: '#fee2e2', color: 'var(--color-danger)', borderRadius: '6px', padding: '2px 6px', fontWeight: '700' }}>
                        Blocked
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleBlockChat(chat) }}
                      style={{
                        padding: '3px 8px', fontSize: '11px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
                        background: chat.is_blocked ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
                        color: chat.is_blocked ? '#059669' : '#ef4444',
                      }}
                    >
                      {chat.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.last_message || 'No messages yet'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Message view ─────────────────────────────────────────────── */}
        <div style={panel}>
          {!activeChat ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
              <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>Select a conversation to view its messages</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <span>💬 {activeChat.client_name || 'Unknown client'} ↔ {activeChat.creator_name || 'Unknown creator'}</span>
                {!messagesLoading && !messagesError && (
                  <span className="badge badge-info">{formatNumber(messages.length)} messages</span>
                )}
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messagesLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '10px' }} />
                  ))
                ) : messagesError ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <AlertTriangle size={28} style={{ color: 'var(--color-danger)', marginBottom: '10px' }} />
                    <p style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Could not load messages
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>{messagesError}</p>
                    <button onClick={() => openChat(activeChat)} className="btn-gradient" style={{ padding: '9px 20px', fontSize: '13px' }}>
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      No messages in this conversation
                    </p>
                    <p style={{ fontSize: '13px' }}>The conversation exists but nothing has been sent yet.</p>
                  </div>
                ) : messages.map(msg => (
                  <div key={msg.id} style={{
                    padding: '10px 14px', borderRadius: '10px',
                    background: msg.is_flagged ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                    border: msg.is_flagged ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {msg.sender_name || 'Unknown sender'} {msg.is_flagged && <span style={{ color: 'var(--color-danger)' }}>🚩</span>}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(msg.created_at, { withTime: true })}</span>
                        <button
                          onClick={() => handleFlagMessage(activeChat.id, msg)}
                          style={{
                            padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600',
                            background: msg.is_flagged ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
                            color: msg.is_flagged ? '#059669' : '#ef4444',
                          }}
                        >
                          {msg.is_flagged ? 'Unflag' : '🚩 Flag'}
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.message || <em style={{ color: 'var(--text-muted)' }}>(no text)</em>}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
