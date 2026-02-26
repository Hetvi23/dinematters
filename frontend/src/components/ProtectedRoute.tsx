import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function ProtectedRoute() {
  const location = useLocation()
  const bootUser = (window as any)?.frappe?.boot?.user
  // boot.user is an object { name, email, ... }; for Guest, name === 'Guest'
  const userName = typeof bootUser === 'object' && bootUser != null ? bootUser.name : bootUser
  const isAuthenticated = !!userName && userName !== 'Guest'

  if (!isAuthenticated) {
    // Preserve attempted path so user can be redirected after login if desired
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

