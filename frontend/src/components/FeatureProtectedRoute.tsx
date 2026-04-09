import { Navigate, Outlet } from 'react-router-dom'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useState, useEffect } from 'react'

interface FeatureProtectedRouteProps {
  feature?: string
  requireGold?: boolean
}

export default function FeatureProtectedRoute({ feature, requireGold = false }: FeatureProtectedRouteProps) {
  const { isGold, isDiamond, features, isLoading } = useRestaurant()
  const [hasTimedOut, setHasTimedOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  // Always return a valid JSX element
  if (isLoading && !hasTimedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Simple access determination
  const hasAccess = Boolean(
    isDiamond || 
    (requireGold && (isGold || isDiamond)) ||
    (feature && (features as any)?.[feature]) ||
    (!requireGold && !feature) ||
    hasTimedOut
  )


  if (!hasAccess) {
    return <Navigate to="/feature-locked" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
