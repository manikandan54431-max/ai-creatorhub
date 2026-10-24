import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store'

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

export function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

export function GuestRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()

  if (isAuthenticated) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />
    if (user?.role === 'creator') return <Navigate to="/creator/dashboard" replace />
    return <Navigate to="/client/dashboard" replace />
  }

  return children
}
