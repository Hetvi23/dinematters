import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Crown, ArrowLeft, Star, Zap, Shield, TrendingUp } from 'lucide-react'
import { useRestaurant } from '@/contexts/RestaurantContext'

export default function FeatureLocked() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isPro, planType } = useRestaurant()

  // Get the attempted path from location state or current path
  const attemptedPath = location.state?.from || location.pathname
  const featureName = getFeatureName(attemptedPath)

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  const handleUpgrade = () => {
    // Navigate to billing/upgrade page
    navigate('/restaurant/' + (location.state?.restaurantId || '') + '/billing')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Main Lock Card */}
        <Card className="text-center shadow-lg border-0">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Feature Locked
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
              {featureName} requires a PRO plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You're currently on the <span className="font-semibold">{planType || 'LITE'}</span> plan. 
                Upgrade to PRO to unlock this feature and more.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to PRO
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleGoBack}
                  className="py-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleGoToDashboard}
                  className="py-2"
                >
                  Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PRO Benefits */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-center text-gray-900 dark:text-white">
              <Crown className="h-5 w-5 mr-2 inline text-yellow-500" />
              PRO Plan Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Advanced Order Management</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Customer Management</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                  <Star className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">AI Recommendations</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Advanced Analytics</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Text */}
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Need help? Contact our support team for assistance with upgrading.
          </p>
        </div>
      </div>
    </div>
  )
}

// Helper function to get feature name from path
function getFeatureName(path: string): string {
  const featureMap: Record<string, string> = {
    '/orders': 'Order Management',
    '/accept-orders': 'Accept Orders',
    '/past-orders': 'Past Orders',
    '/bookings': 'Table Bookings',
    '/customers': 'Customer Management',
    '/coupons': 'Coupons Management',
    '/recommendations-engine': 'AI Recommendations',
    '/payment-stats': 'Payment Analytics',
  }

  // Find exact match or partial match
  if (featureMap[path]) {
    return featureMap[path]
  }
  
  // Check for partial matches (e.g., /orders/123)
  for (const [key, value] of Object.entries(featureMap)) {
    if (path.startsWith(key)) {
      return value
    }
  }
  
  return 'This Feature'
}
