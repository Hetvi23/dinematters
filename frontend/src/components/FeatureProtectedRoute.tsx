import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useRestaurant } from '@/contexts/RestaurantContext'

interface FeatureProtectedRouteProps {
  feature?: string
  requirePro?: boolean
}

export default function FeatureProtectedRoute({ feature, requirePro = false }: FeatureProtectedRouteProps) {
  const { isPro, features, isLoading, selectedRestaurant } = useRestaurant()
  const location = useLocation()

  // Check if feature is accessible (use default values while loading)
  const hasAccess = feature 
    ? isPro || (features as any)[feature]
    : requirePro 
      ? isPro 
      : true

  // If user doesn't have access, redirect immediately to FeatureLocked page
  // Don't wait for loading to complete - this prevents the loading screen issue
  if (!hasAccess && selectedRestaurant) {
    return <Navigate 
      to="/feature-locked" 
      state={{ 
        from: location.pathname,
        restaurantId: location.state?.restaurantId 
      }} 
      replace 
    />
  }

  // If no restaurant is selected, show loading (this is normal)
  if (!selectedRestaurant || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If user has access, show the protected content
  return <Outlet />
}
