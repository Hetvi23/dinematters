import { Navigate, Outlet } from 'react-router-dom'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useState, useEffect } from 'react'

interface FeatureProtectedRouteProps {
  feature?: string
  requirePro?: boolean
}

export default function FeatureProtectedRoute({ feature, requirePro = false }: FeatureProtectedRouteProps) {
  const { isPro, features, isLoading, restaurantConfig } = useRestaurant()
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
    restaurantConfig?.subscription?.planType === 'PRO' ||
    (requirePro && isPro) ||
    (feature && (isPro || (features as any)?.[feature])) ||
    (!requirePro && !feature) ||
    hasTimedOut
  )

  if (!hasAccess) {
    return <Navigate to="/feature-locked" replace />
  }

  return <Outlet />
}
