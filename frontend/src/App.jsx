import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useThemeStore } from './store'
import { recordVisit } from './hooks/useInAppBack'

// Layout
import Navbar from './components/layout/Navbar'

// Auth Guards
import { ProtectedRoute, AdminRoute, GuestRoute } from './components/auth/ProtectedRoute'

// Public Pages
import HomePage from './pages/public/HomePage'
import CreatorsPage from './pages/public/CreatorsPage'
import CreatorProfilePage from './pages/public/CreatorProfilePage'

// Auth Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Client Pages
import ClientDashboard from './pages/client/ClientDashboard'
import ChatPage from './pages/chat/ChatPage'

// Shared Pages
import OrderDetailPage from './pages/shared/OrderDetailPage'
import OrdersListPage from './pages/shared/OrdersListPage'
import PaymentsPage from './pages/shared/PaymentsPage'

// Client-specific
import HireCreatorPage from './pages/client/HireCreatorPage'

// Creator Pages
import CreatorDashboard from './pages/creator/CreatorDashboard'
import CreatorProfileEditor from './pages/creator/CreatorProfileEditor'

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminCreators from './pages/admin/AdminCreators'
import AdminOrders from './pages/admin/AdminOrders'
import AdminAssignments from './pages/admin/AdminAssignments'
import AdminChats from './pages/admin/AdminChats'
import AdminPayments from './pages/admin/AdminPayments'
import AdminReviews from './pages/admin/AdminReviews'
import AdminDisputes from './pages/admin/AdminDisputes'
import AdminSettings from './pages/admin/AdminSettings'

// New feature pages
import SavedCreatorsPage from './pages/client/SavedCreatorsPage'
import EditingRequestsPage from './pages/client/EditingRequestsPage'
import CreatorEditingRequestsPage from './pages/creator/EditingRequestsPage'
import CreatorReviewsPage from './pages/creator/CreatorReviewsPage'
import ProfilePage from './pages/shared/ProfilePage'
import HowItWorksPage from './pages/public/HowItWorksPage'
import CreatorPortfolioPage from './pages/creator/CreatorPortfolioPage'
import CreatorServicesPage from './pages/creator/CreatorServicesPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import StudioProjectsPage from './pages/creator/StudioProjectsPage'
import StudioEditorPage from './pages/creator/StudioEditorPage'
import AIGeneratorPage from './pages/creator/AIGeneratorPage'
import GeminiAssistantPage from './pages/creator/GeminiAssistantPage'

// Informational Pages
import AboutPage from './pages/public/AboutPage'
import BlogPage from './pages/public/BlogPage'
import BlogPostPage from './pages/public/BlogPostPage'
import CareersPage from './pages/public/CareersPage'
import ContactPage from './pages/public/ContactPage'
import SupportPage from './pages/public/SupportPage'
import HelpCenterPage from './pages/public/HelpCenterPage'
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage'
import TermsOfServicePage from './pages/public/TermsOfServicePage'

// Admin Video Approvals & Support
import AdminVideoApprovals from './pages/admin/AdminVideoApprovals'
import AdminSupport from './pages/admin/AdminSupport'

// Global widgets

// Lazy-loaded placeholder for missing pages
const PlaceholderPage = ({ title }) => (
  <div style={{ padding: '120px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚧</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title || 'Coming Soon'}</h2>
    <p>This page is under construction</p>
  </div>
)

/**
 * Records every in-app route the user visits, so Back buttons on full-screen
 * pages (the Video Studio) can return to a known-valid in-app location instead
 * of guessing from window.history.
 */
function InAppHistoryTracker() {
  const location = useLocation()
  useEffect(() => {
    recordVisit(location.pathname)
  }, [location.pathname])
  return null
}

function AppRoutes() {
  return (
    <Routes>
      {/* ─── Public with Navbar ─────────────────────────────── */}
      <Route path="/" element={<><Navbar /><HomePage /></>} />
      <Route path="/creators" element={<><Navbar /><CreatorsPage /></>} />
      <Route path="/creators/:id" element={<><Navbar /><CreatorProfilePage /></>} />
      <Route path="/how-it-works" element={<><Navbar /><HowItWorksPage /></>} />

      {/* ─── Informational Pages ─────────────────────────────── */}
      <Route path="/about" element={<><Navbar /><AboutPage /></>} />
      <Route path="/blog" element={<><Navbar /><BlogPage /></>} />
      <Route path="/blog/:slug" element={<><Navbar /><BlogPostPage /></>} />
      <Route path="/careers" element={<><Navbar /><CareersPage /></>} />
      <Route path="/contact" element={<><Navbar /><ContactPage /></>} />
      <Route path="/support" element={<><Navbar /><SupportPage /></>} />
      <Route path="/help-center" element={<><Navbar /><HelpCenterPage /></>} />
      <Route path="/privacy-policy" element={<><Navbar /><PrivacyPolicyPage /></>} />
      <Route path="/terms-of-service" element={<><Navbar /><TermsOfServicePage /></>} />

      {/* ─── Auth ────────────────────────────────────────────── */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/admin/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* ─── Client ──────────────────────────────────────────── */}
      <Route path="/client/dashboard" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <ClientDashboard />
        </ProtectedRoute>
      } />
      <Route path="/client/chat" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <ChatPage />
        </ProtectedRoute>
      } />
      <Route path="/client/orders" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <OrdersListPage />
        </ProtectedRoute>
      } />
      <Route path="/client/orders/:id" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <OrderDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/client/payments" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <PaymentsPage />
        </ProtectedRoute>
      } />
      <Route path="/client/saved" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <SavedCreatorsPage />
        </ProtectedRoute>
      } />
      <Route path="/client/editing-requests" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <EditingRequestsPage />
        </ProtectedRoute>
      } />
      <Route path="/client/hire/:creatorId" element={
        <ProtectedRoute allowedRoles={['client']}>
          <Navbar />
          <HireCreatorPage />
        </ProtectedRoute>
      } />

      {/* ─── Creator ─────────────────────────────────────────── */}
      <Route path="/creator/dashboard" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/creator/chat" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <ChatPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/profile" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorProfileEditor />
        </ProtectedRoute>
      } />
      <Route path="/creator/portfolio" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorPortfolioPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/services" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorServicesPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/orders" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <OrdersListPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/orders/:id" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <OrderDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/reviews" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorReviewsPage />
        </ProtectedRoute>
      } />

      <Route path="/creator/editing-requests" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <CreatorEditingRequestsPage />
        </ProtectedRoute>
      } />

      {/* ─── AI Generator (creator-only, PixVerse) ─────────────── */}
      <Route path="/creator/ai-generator" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <AIGeneratorPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/gemini-assistant" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <Navbar />
          <GeminiAssistantPage />
        </ProtectedRoute>
      } />

      {/* ─── Video Studio (full-screen, no Navbar) ─────────────── */}
      <Route path="/creator/video-studio" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <StudioProjectsPage />
        </ProtectedRoute>
      } />
      <Route path="/creator/video-studio/:projectId" element={
        <ProtectedRoute allowedRoles={['creator']}>
          <StudioEditorPage />
        </ProtectedRoute>
      } />

      {/* Legacy /creator/ai-studio links keep working */}
      <Route path="/creator/ai-studio" element={<Navigate to="/creator/video-studio" replace />} />
      <Route path="/creator/ai-studio/:projectId" element={<LegacyStudioRedirect />} />

      {/* ─── Shared Profile ──────────────────────────────────── */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <Navbar />
          <ProfilePage />
        </ProtectedRoute>
      } />

      {/* ─── Admin ───────────────────────────────────────────── */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/users" element={
        <AdminRoute>
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/creators" element={
        <AdminRoute>
          <AdminLayout>
            <AdminCreators />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/orders" element={
        <AdminRoute>
          <AdminLayout>
            <AdminOrders />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/assignments" element={
        <AdminRoute>
          <AdminLayout>
            <AdminAssignments />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/chats" element={
        <AdminRoute>
          <AdminLayout>
            <AdminChats />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/payments" element={
        <AdminRoute>
          <AdminLayout>
            <AdminPayments />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/reviews" element={
        <AdminRoute>
          <AdminLayout>
            <AdminReviews />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/disputes" element={
        <AdminRoute>
          <AdminLayout>
            <AdminDisputes />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/settings" element={
        <AdminRoute>
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/video-approvals" element={
        <AdminRoute>
          <AdminLayout>
            <AdminVideoApprovals />
          </AdminLayout>
        </AdminRoute>
      } />
      <Route path="/admin/support" element={
        <AdminRoute>
          <AdminLayout>
            <AdminSupport />
          </AdminLayout>
        </AdminRoute>
      } />

      {/* ─── 404 ─────────────────────────────────────────────── */}
      <Route path="*" element={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-primary)' }}>
          <div style={{ fontSize: '80px' }}>🔍</div>
          <h2 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>Page Not Found</h2>
          <a href="/" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: '600' }}>Go Home →</a>
        </div>
      } />
    </Routes>
  )
}

export default function App() {
  const { initTheme } = useThemeStore()
  
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <BrowserRouter>
      <InAppHistoryTracker />
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: 'var(--shadow-xl)',
          },
          success: { iconTheme: { primary: '#059669', secondary: 'white' } },
          error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
        }}
      />
    </BrowserRouter>
  )
}

function LegacyStudioRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/creator/video-studio/${projectId}`} replace />
}
