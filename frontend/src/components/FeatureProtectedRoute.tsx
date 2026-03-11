import { Navigate, Outlet } from 'react-router-dom'
import { useRestaurant } from '@/contexts/RestaurantContext'
import { useEffect } from 'react'
import { toast } from 'sonner'

interface FeatureProtectedRouteProps {
  feature?: string
  requirePro?: boolean
}

export default function FeatureProtectedRoute({ feature, requirePro = false }: FeatureProtectedRouteProps) {
  const { isPro, features, isLoading } = useRestaurant()

  // Wait for restaurant data to load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check if feature is accessible
  const hasAccess = feature 
    ? isPro || (features as any)[feature]
    : requirePro 
      ? isPro 
      : true

  useEffect(() => {
    if (!hasAccess) {
      toast.error('This feature requires PRO plan', {
        description: 'Upgrade to PRO to unlock this feature',
        duration: 5000,
      })
    }
  }, [hasAccess])

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
