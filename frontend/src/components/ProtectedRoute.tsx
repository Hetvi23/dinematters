import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function ProtectedRoute() {
  const location = useLocation()
  const bootUser = (window as any)?.frappe?.boot?.user
  const isAuthenticated = !!bootUser && bootUser !== 'Guest'

  if (!isAuthenticated) {
    // Preserve attempted path so user can be redirected after login if desired
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

