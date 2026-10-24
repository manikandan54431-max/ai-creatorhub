import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401 & normalize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    // Normalize FastAPI 422 validation errors if detail is an array or object
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail
      if (Array.isArray(detail)) {
        error.response.data.detail = detail
          .map(d => (typeof d === 'object' && d?.msg ? `${d.loc ? d.loc.slice(-1)[0] + ': ' : ''}${d.msg}` : String(d)))
          .join(', ')
      } else if (typeof detail === 'object' && detail !== null) {
        error.response.data.detail = detail.msg || JSON.stringify(detail)
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
  updateMe: (data) => api.put('/api/auth/me', data),
  logout: () => api.post('/api/auth/logout'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
}

// ─── Creators ────────────────────────────────────────────────────────
export const creatorsAPI = {
  getAll: (params) => api.get('/api/creators', { params }),
  getFeatured: () => api.get('/api/creators/featured'),
  getMe: () => api.get('/api/creators/me'),
  getById: (id) => api.get(`/api/creators/${id}`),
  search: (q) => api.get('/api/creators/search', { params: { q } }),
  updateProfile: (data) => api.put('/api/creators/profile', data),
  addPortfolio: (data) => api.post('/api/creators/portfolio', data),
  deletePortfolio: (id) => api.delete(`/api/creators/portfolio/${id}`),
  createService: (data) => api.post('/api/creators/services', data),
  getMyServices: () => api.get('/api/creators/services/my'),
  getCreatorServices: (id) => api.get(`/api/creators/services/${id}`),
  updateService: (id, data) => api.put(`/api/creators/services/${id}`, data),
  deleteService: (id) => api.delete(`/api/creators/services/${id}`),
}

// ─── Orders ──────────────────────────────────────────────────────────
export const ordersAPI = {
  create: (data) => api.post('/api/orders', data),
  getMyOrders: () => api.get('/api/orders/my-orders'),
  getById: (id) => api.get(`/api/orders/${id}`),
  updateStatus: (id, status) => api.put(`/api/orders/${id}/status`, { status }),
  uploadDelivery: (id, data) => api.post(`/api/orders/${id}/delivery`, data),
  requestRevision: (id, reason) => api.post(`/api/orders/${id}/revision`, { reason }),
  approveDelivery: (id) => api.post(`/api/orders/${id}/approve`),
  raiseDispute: (id, reason) => api.post(`/api/orders/${id}/dispute`, { order_id: id, reason }),
}

// ─── Chats ───────────────────────────────────────────────────────────
export const chatsAPI = {
  getAll: () => api.get('/api/chats'),
  getMessages: (chatId) => api.get(`/api/chats/${chatId}/messages`),
  sendMessage: (chatId, data) => api.post(`/api/chats/${chatId}/messages`, data),
  createChat: (creatorId) => api.post(`/api/chats/create/${creatorId}`),
}

// ─── Reviews ─────────────────────────────────────────────────────────
export const reviewsAPI = {
  create: (data) => api.post('/api/reviews', data),
  getByCreator: (id) => api.get(`/api/reviews/creator/${id}`),
  getMyReviews: () => api.get('/api/reviews/my-reviews'),
}

// ─── Payments ────────────────────────────────────────────────────────
export const paymentsAPI = {
  create: (data) => api.post('/api/payments/create', data),
  verify: (data) => api.post('/api/payments/verify', data),
  getMyPayments: () => api.get('/api/payments/my-payments'),
  getConfig: () => api.get('/api/payments/config'),
}

// ─── Notifications ────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: () => api.get('/api/notifications'),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/mark-all-read'),
}

// ─── Gemini AI helpers ────────────────────────────────────────────────
export const aiAPI = {
  improvePrompt: (roughIdea) => api.post('/api/ai/improve-prompt', {
    rough_idea: roughIdea,
    category: 'AI video',
    platform: 'Instagram Reels / YouTube Shorts / Web',
  }),
}

// ─── Gemini Creator Assistant ────────────────────────────────────────
export const helpbotAPI = {
  status: () => api.get('/api/helpbot/status'),
  chat: (message, history = []) => api.post('/api/helpbot/chat', { message, history }),
}

// ─── Admin ───────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard: () => api.get('/api/admin/dashboard'),
  
  getUsers: (params) => api.get('/api/admin/users', { params }),
  blockUser: (id) => api.put(`/api/admin/users/${id}/block`),
  unblockUser: (id) => api.put(`/api/admin/users/${id}/unblock`),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  changeUserRole: (id, role) => api.put(`/api/admin/users/${id}/role`, { role }),
  
  getCreators: (params) => api.get('/api/admin/creators', { params }),
  approveCreator: (id) => api.put(`/api/admin/creators/${id}/approve`),
  rejectCreator: (id) => api.put(`/api/admin/creators/${id}/reject`),
  // Pass the intended result so the request is idempotent (see Issue 7).
  verifyCreator: (id, verified) => api.put(`/api/admin/creators/${id}/verify`, verified === undefined ? {} : { verified }),
  suspendCreator: (id) => api.put(`/api/admin/creators/${id}/suspend`),
  unsuspendCreator: (id) => api.put(`/api/admin/creators/${id}/unsuspend`),
  featureCreator: (id) => api.put(`/api/admin/creators/${id}/feature`),
  
  getOrders: (params) => api.get('/api/admin/orders', { params }),
  updateOrderStatus: (id, status) => api.put(`/api/admin/orders/${id}/status`, { status }),
  
  createAssignment: (data) => api.post('/api/admin/assignments', data),
  getAssignments: () => api.get('/api/admin/assignments'),
  updateAssignmentStatus: (id, status) => api.put(`/api/admin/assignments/${id}/status`, { status }),
  
  getChats: () => api.get('/api/admin/chats'),
  getChatMessages: (id) => api.get(`/api/admin/chats/${id}/messages`),
  blockChat: (id) => api.put(`/api/admin/chats/${id}/block`),
  flagMessage: (chatId, msgId) => api.post(`/api/admin/chats/${chatId}/flag/${msgId}`),
  
  getPayments: (params) => api.get('/api/admin/payments', { params }),
  getTurnover: (params) => api.get('/api/admin/turnover', { params }),
  getTurnoverSeries: (params) => api.get('/api/admin/turnover/series', { params }),
  getReviews: () => api.get('/api/admin/reviews'),
  hideReview: (id) => api.put(`/api/admin/reviews/${id}/hide`),
  deleteReview: (id) => api.delete(`/api/admin/reviews/${id}`),
  
  getDisputes: () => api.get('/api/admin/disputes'),
  resolveDispute: (id, data) => api.put(`/api/admin/disputes/${id}/resolve`, data),

  getSettings: () => api.get('/api/admin/settings'),
  updateSettings: (data) => api.put('/api/admin/settings', data),
  resetSettings: () => api.post('/api/admin/settings/reset'),

  // Video Approvals
  getVideoApprovals: (params) => api.get('/api/admin/video-approvals', { params }),
  getVideoApprovalDetail: (id) => api.get(`/api/admin/video-approvals/${id}`),
  approveVideo: (id, data) => api.post(`/api/admin/video-approvals/${id}/approve`, data),
  requestVideoChanges: (id, data) => api.post(`/api/admin/video-approvals/${id}/request-changes`, data),

  // Support Tickets (admin)
  getSupportTickets: (params) => api.get('/api/support/admin/tickets', { params }),
  getSupportTicket: (id) => api.get(`/api/support/admin/tickets/${id}`),
  replySupportTicket: (id, data) => api.post(`/api/support/admin/tickets/${id}/reply`, data),
  updateSupportTicketStatus: (id, data) => api.put(`/api/support/admin/tickets/${id}/status`, data),
}

// ─── Deliveries ───────────────────────────────────────────────────────
export const deliveryAPI = {
  getConfig: () => api.get('/api/deliveries/config'),
  getOrderDeliveries: (orderId) => api.get(`/api/orders/${orderId}/deliveries`),
  getApprovedDeliveries: (orderId) => api.get(`/api/orders/${orderId}/approved-deliveries`),
  uploadDelivery: (orderId, formData, onProgress) =>
    api.post(`/api/orders/${orderId}/deliveries`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (pe) => onProgress && onProgress(Math.round((pe.loaded / pe.total) * 100)),
    }),
  submitForReview: (deliveryId) => api.post(`/api/deliveries/${deliveryId}/submit`),
  streamUrl: (deliveryId) => `${import.meta.env.VITE_API_URL || ''}/api/deliveries/${deliveryId}/stream`,
  downloadUrl: (deliveryId) => `${import.meta.env.VITE_API_URL || ''}/api/deliveries/${deliveryId}/download`,
}

// ─── Editing Requests (client source media -> creator edits) ──────────
export const editingRequestsAPI = {
  getLimits: () => api.get('/api/editing-requests/config/limits'),
  create: (formData, onProgress) =>
    api.post('/api/editing-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (pe) => onProgress && pe.total && onProgress(Math.round((pe.loaded / pe.total) * 100)),
    }),
  getMine: (params) => api.get('/api/editing-requests/my', { params }),
  getAssigned: (params) => api.get('/api/editing-requests/assigned', { params }),
  getById: (id) => api.get(`/api/editing-requests/${id}`),
  respond: (id, data) => api.post(`/api/editing-requests/${id}/respond`, data),
  cancel: (id) => api.post(`/api/editing-requests/${id}/cancel`),
  // Media URLs carry the token as a query param so <video>/<img> tags can load
  // them; the endpoint re-checks authorisation on every request.
  mediaStreamUrl: (requestId, mediaId) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/editing-requests/${requestId}/media/${mediaId}/stream${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
  mediaDownloadUrl: (requestId, mediaId) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/editing-requests/${requestId}/media/${mediaId}/download${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
}

// ─── Support ──────────────────────────────────────────────────────────
export const supportAPI = {
  createPublicTicket: (data) => api.post('/api/support/tickets', data),
  createAuthTicket: (data) => api.post('/api/support/tickets/authenticated', data),
  getMyTickets: () => api.get('/api/support/tickets/my'),
  getMyTicket: (id) => api.get(`/api/support/tickets/my/${id}`),
  replyToTicket: (id, data) => api.post(`/api/support/tickets/my/${id}/reply`, data),
}

// ─── Blog ─────────────────────────────────────────────────────────────
export const blogAPI = {
  getPosts: (params) => api.get('/api/blog/posts', { params }),
  getPost: (slug) => api.get(`/api/blog/posts/${slug}`),
  getCategories: () => api.get('/api/blog/posts/categories'),
}

// ─── Studio ───────────────────────────────────────────────────────────
export const studioAPI = {
  // Projects
  listProjects: () => api.get('/api/creator/studio/projects'),
  createProject: (data) => api.post('/api/creator/studio/projects', data),
  getProject: (id) => api.get(`/api/creator/studio/projects/${id}`),
  updateProject: (id, data) => api.patch(`/api/creator/studio/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/api/creator/studio/projects/${id}`),
  duplicateProject: (id) => api.post(`/api/creator/studio/projects/${id}/duplicate`),
  getEligibleOrders: () => api.get('/api/creator/studio/my-orders'),

  // Assets
  listAssets: (params) => api.get('/api/creator/studio/assets', { params }),
  uploadAsset: (formData, onProgress) =>
    api.post('/api/creator/studio/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (pe) => onProgress && onProgress(Math.round((pe.loaded / pe.total) * 100)),
    }),
  deleteAsset: (id) => api.delete(`/api/creator/studio/assets/${id}`),
  assetStreamUrl: (id) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/creator/studio/assets/${id}/stream${token ? '?token=' + encodeURIComponent(token) : ''}`
  },

  // Render jobs
  startRenderJob: (data) => api.post('/api/creator/studio/render-jobs', data),
  uploadRenderOutput: (jobId, formData, onProgress) =>
    api.post(`/api/creator/studio/render-jobs/${jobId}/upload-output`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (pe) => onProgress && onProgress(Math.round((pe.loaded / pe.total) * 100)),
    }),
  failRenderJob: (jobId, error) => api.post(`/api/creator/studio/render-jobs/${jobId}/fail`, { error }),
  listRenderJobs: (params) => api.get('/api/creator/studio/render-jobs', { params }),
  getRenderJob: (id) => api.get(`/api/creator/studio/render-jobs/${id}`),
  renderDownloadUrl: (id) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/creator/studio/render-jobs/${id}/download${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
  submitForReview: (jobId, data) => api.post(`/api/creator/studio/render-jobs/${jobId}/submit-for-review`, data),
}

// ─── AI Generator (creator-only, PixVerse) ────────────────────────────
export const aiGeneratorAPI = {
  getConfig: () => api.get('/api/creator/ai-generator/config'),
  generate: (data) => api.post('/api/creator/ai-generator/generate', data),
  listJobs: () => api.get('/api/creator/ai-generator/jobs'),
  getJob: (id) => api.get(`/api/creator/ai-generator/jobs/${id}`),
  saveToMedia: (id) => api.post(`/api/creator/ai-generator/jobs/${id}/save-to-media`),
  openInStudio: (id) => api.post(`/api/creator/ai-generator/jobs/${id}/open-in-studio`),
  retrySave: (id) => api.post(`/api/creator/ai-generator/jobs/${id}/retry-save`),
  jobStreamUrl: (id) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/creator/ai-generator/jobs/${id}/stream${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
  jobDownloadUrl: (id) => {
    const token = localStorage.getItem('token') || ''
    const base = import.meta.env.VITE_API_URL || ''
    return `${base}/api/creator/ai-generator/jobs/${id}/download${token ? '?token=' + encodeURIComponent(token) : ''}`
  },
}

// ─── Public (no auth) ─────────────────────────────────────────────────
export const publicAPI = {
  getStats: () => api.get('/api/public/stats'),
}

export default api
