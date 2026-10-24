import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Auth Store ───────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (user, token) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ user, token, isAuthenticated: true })
      },
      
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ user: null, token: null, isAuthenticated: false })
      },
      
      updateUser: (userData) => {
        const updated = { ...get().user, ...userData }
        localStorage.setItem('user', JSON.stringify(updated))
        set({ user: updated })
      },
      
      isAdmin: () => get().user?.role === 'admin',
      isCreator: () => get().user?.role === 'creator',
      isClient: () => get().user?.role === 'client',
    }),
    { name: 'auth-storage' }
  )
)

// ─── Theme Store ──────────────────────────────────────────────────────
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light',
      
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light'
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
        set({ theme: newTheme })
      },
      
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      
      initTheme: () => {
        const theme = get().theme
        document.documentElement.classList.toggle('dark', theme === 'dark')
      }
    }),
    { name: 'theme-storage' }
  )
)

// ─── Notification Store ───────────────────────────────────────────────
export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,
  
  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length
  }),
  
  addNotification: (notif) => set((state) => ({
    notifications: [notif, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),
  
  markRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  
  markAllRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, is_read: true })),
    unreadCount: 0
  })),
}))

// ─── Chat Store ───────────────────────────────────────────────────────
export const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  
  setChats: (chats) => set({ chats }),
  
  setActiveChat: (chat) => set({ activeChat: chat }),
  
  setMessages: (chatId, messages) => set((state) => ({
    messages: { ...state.messages, [chatId]: messages }
  })),
  
  addMessage: (chatId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [chatId]: [...(state.messages[chatId] || []), message]
    }
  })),
  
  updateLastMessage: (chatId, lastMessage) => set((state) => ({
    chats: state.chats.map(c => c.id === chatId ? { ...c, last_message: lastMessage } : c)
  })),
}))
