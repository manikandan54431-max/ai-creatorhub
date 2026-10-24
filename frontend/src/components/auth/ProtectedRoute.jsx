import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { authAPI } from '../../services/api'

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, token, updateUser, logout } = useAuthStore()
  const [checkingSession, setCheckingSession] = useState(Boolean(isAuthenticated && token))

  useEffect(() => {
    let active = true
    if (!isAuthenticated || !token) {
      setCheckingSession(false)
      return () => { active = false }
    }
    setCheckingSession(true)
    authAPI.getMe()
      .then(({ data }) => {
        if (active) updateUser(data)
      })
      .catch(() => {
        if (active) logout()
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })
    return () => { active = false }
  }, [isAuthenticated, token])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (checkingSession) {
    return <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>Checking your account…</div>
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const destination = user?.role === 'admin' ? '/admin' : user?.role === 'client' ? '/client/dashboard' : '/login'
    return <Navigate to={destination} replace />
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
