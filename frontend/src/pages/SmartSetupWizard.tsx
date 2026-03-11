import { useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useRestaurant } from '@/contexts/RestaurantContext'
import SetupWizard from './SetupWizard'
import LiteSetupWizard from './LiteSetupWizard'

export default function SmartSetupWizard() {
  const navigate = useNavigate()
  const { stepId: urlStepId } = useParams<{ stepId?: string }>()
  const location = useLocation()
  const { selectedRestaurant, isLite, isLoading } = useRestaurant()

  // Smart routing logic
  useEffect(() => {
    // If we have a selected restaurant and it's Lite, redirect to lite setup
    if (selectedRestaurant && isLite) {
      const currentPath = location.pathname
      if (currentPath.startsWith('/setup')) {
        const stepId = urlStepId || ''
        if (stepId) {
          navigate(`/lite-setup/${stepId}`, { replace: true })
        } else {
          navigate('/lite-setup', { replace: true })
        }
      }
    }
  }, [selectedRestaurant, isLite, navigate, location.pathname, urlStepId])

  // If no restaurant is selected, show a smart loader that will route appropriately
  if (!selectedRestaurant && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
          <p className="text-muted-foreground">Please select a restaurant from the dropdown above to continue.</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> If you have a Lite restaurant, you'll automatically be redirected to the Lite Setup Wizard with simplified features.
          </div>
        </div>
      </div>
    )
  }

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
          <p className="text-muted-foreground">Loading setup configuration...</p>
        </div>
      </div>
    )
  }

  // Show appropriate setup wizard based on restaurant plan
  if (isLite) {
    return <LiteSetupWizard />
  }

  return <SetupWizard />
}
