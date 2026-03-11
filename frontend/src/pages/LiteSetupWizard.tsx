import { useState, useEffect, useRef } from 'react'
import { useFrappeGetCall, useFrappeGetDoc } from '@/lib/frappe'
import DynamicForm from '@/components/DynamicForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, Check, Star, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useRestaurant } from '@/contexts/RestaurantContext'

interface WizardStep {
  id: string
  title: string
  description: string
  doctype: string
  required: boolean
  depends_on?: string | null
  view_only?: boolean
  lite_safe?: boolean
}

const stepIdToSlug = (stepId: string): string => {
  const slugMap: Record<string, string> = {
    'restaurant': 'CreateRestaurant',
    'config': 'RestaurantConfiguration',
    'categories': 'MenuCategories',
    'products': 'MenuProducts',
    'home_features': 'HomeFeatures',
  }
  return slugMap[stepId] || stepId
}

const slugToStepId = (slug: string): string => {
  const idMap: Record<string, string> = {
    'CreateRestaurant': 'restaurant',
    'RestaurantConfiguration': 'config',
    'MenuCategories': 'categories',
    'MenuProducts': 'products',
    'HomeFeatures': 'home_features',
  }
  return idMap[slug] || slug
}

export default function LiteSetupWizard() {
  const navigate = useNavigate()
  const { stepId: urlStepId } = useParams<{ stepId?: string }>()
  const location = useLocation()
  const { selectedRestaurant, isLite, isPro } = useRestaurant()
  
  // Smart routing: Check if we should show Pro or Lite setup
  useEffect(() => {
    // If we have a selected restaurant and it's Pro, redirect to pro setup
    if (selectedRestaurant && isPro) {
      const currentPath = location.pathname
      if (currentPath.startsWith('/lite-setup')) {
        const stepId = urlStepId || ''
        if (stepId) {
          navigate(`/setup/${stepId}`, { replace: true })
        } else {
          navigate('/setup', { replace: true })
        }
      }
    }
  }, [selectedRestaurant, isPro, navigate, location.pathname, urlStepId])
  
  const { data: allStepsData } = useFrappeGetCall<{ message: { steps: WizardStep[] } }>(
    'dinematters.dinematters.api.ui.get_setup_wizard_steps',
    {},
    'setup-wizard-steps'
  )

  const steps: WizardStep[] = (() => {
    if (!allStepsData?.message) return []
    const msg = allStepsData.message
    const allSteps: WizardStep[] = Array.isArray(msg) ? msg : (msg.steps && Array.isArray(msg.steps) ? msg.steps : [])
    
    const liteSafeSteps = ['restaurant', 'config', 'categories', 'products', 'home_features']
    return allSteps.filter(step => liteSafeSteps.includes(step.id))
  })()

  const getStepIndexFromId = (stepId: string | undefined): number => {
    if (!stepId || steps.length === 0) return 0
    const id = slugToStepId(stepId)
    const index = steps.findIndex(step => step.id === id)
    return index >= 0 ? index : 0
  }

  const getStepIdFromIndex = (index: number): string => {
    if (index < 0 || index >= steps.length) return ''
    return stepIdToSlug(steps[index].id)
  }

  const { data: progressData } = useFrappeGetCall<{ message: Record<string, boolean> }>(
    'dinematters.dinematters.api.ui.get_restaurant_setup_progress',
    { restaurant_id: selectedRestaurant || '' },
    selectedRestaurant ? `restaurant-progress-${selectedRestaurant}` : null
  )

  const progress = progressData?.message || {}

  const { data: restaurantData } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant
  })

  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (urlStepId && steps.length > 0) {
      const stepIndex = getStepIndexFromId(urlStepId)
      if (stepIndex >= 0) return stepIndex
    }
    try {
      const saved = localStorage.getItem('dinematters-lite-setup-step')
      return saved ? parseInt(saved, 10) : 0
    } catch {
      return 0
    }
  })

  const isUpdatingFromUrl = useRef(false)
  
  useEffect(() => {
    if (steps.length === 0) return
    
    if (urlStepId) {
      const stepIndex = getStepIndexFromId(urlStepId)
      if (stepIndex >= 0 && stepIndex !== currentStep) {
        isUpdatingFromUrl.current = true
        setCurrentStep(stepIndex)
      }
    } else if (location.pathname === '/lite-setup') {
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug) {
        navigate(`/lite-setup/${stepSlug}`, { replace: true })
      }
    }
  }, [urlStepId, steps.length, currentStep, navigate, location.pathname])

  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false
      return
    }
    
    if (steps.length > 0 && currentStep >= 0 && currentStep < steps.length) {
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug) {
        const expectedPath = `/lite-setup/${stepSlug}`
        if (location.pathname !== expectedPath) {
          navigate(expectedPath, { replace: true })
        }
      }
    }
  }, [currentStep, steps.length, navigate, location.pathname])

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('dinematters-lite-setup-completed-steps')
      if (saved) {
        const parsed = JSON.parse(saved)
        return new Set(parsed)
      }
    } catch {
    }
    return new Set()
  })
  
  useEffect(() => {
    try {
      localStorage.setItem('dinematters-lite-setup-completed-steps', JSON.stringify(Array.from(completedSteps)))
    } catch (e) {
      console.error('Failed to save completed steps to localStorage:', e)
    }
  }, [completedSteps])

  const [stepData, setStepData] = useState<Record<string, any>>({})
  const [formHasChanges, setFormHasChanges] = useState(false)
  const [triggerSave, setTriggerSave] = useState(0)
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(false) // Collapsible state for features

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    try {
      if (selectedRestaurant) {
        localStorage.setItem('dinematters-lite-setup-restaurant', selectedRestaurant)
      } else {
        localStorage.removeItem('dinematters-lite-setup-restaurant')
      }
    } catch (e) {
      console.error('Failed to save restaurant to localStorage:', e)
    }
  }, [selectedRestaurant])

  useEffect(() => {
    if (isInitialMount.current) return
    try {
      localStorage.setItem('dinematters-lite-setup-step', currentStep.toString())
    } catch (e) {
      console.error('Failed to save step to localStorage:', e)
    }
  }, [currentStep])

  const progressInitialized = useRef<string | null>(null)
  
  useEffect(() => {
    if (selectedRestaurant && steps.length > 0 && progressInitialized.current !== selectedRestaurant) {
      progressInitialized.current = selectedRestaurant
      
      const stepMapping: Record<string, string> = {
        'restaurant': 'restaurant',
        'config': 'config',
        'categories': 'categories',
        'products': 'products',
        'home_features': 'home_features',
      }

      const completed = new Set<number>()
      const newStepData: Record<string, any> = {}

      if (restaurantData) {
        newStepData['restaurant'] = restaurantData
      }

      // Only mark steps as completed if they actually have progress data
      steps.forEach((step, index) => {
        const progressKey = stepMapping[step.id]
        if (progressKey && progress && progress[progressKey]) {
          completed.add(index)
        }
      })

      // Don't automatically merge with persisted completed steps for Lite
      // Only use actual progress from backend
      setCompletedSteps(completed)
      setStepData(prev => ({ ...prev, ...newStepData }))
    }
  }, [selectedRestaurant, steps, restaurantData, progress])

  useEffect(() => {
    setFormHasChanges(false)
    setTriggerSave(0)
  }, [currentStep, urlStepId])

  // Get step-specific fields to hide for Lite plan
  const getLiteHideFields = (stepId: string): string[] => {
    const commonFields = [
      // Always hide Pro/advanced fields
      'razorpay_account_id',
      'razorpay_customer_id', 
      'razorpay_token_id',
      'mandate_status',
      'billing_status',
      'platform_fee_percent',
      'monthly_minimum_fee',
      'total_orders',
      'total_revenue', 
      'commission_earned',
      'razorpay_merchant_key_id',
      'razorpay_keys_updated_at',
      'razorpay_keys_updated_by',
      'onboarding_date',
      'recommendation_run_count', // Remove recommendation engine
      // Advanced features not available in free tier
      'enable_table_booking',
      'enable_banquet_booking',
      'enable_events',
      'enable_offers',
      'enable_coupons',
      'enable_experience_lounge',
      // Media and recommendations not for Lite setup
      'media',
      'media_items',
      'recommendations',
      'recommendations_json',
    ]

    const stepSpecificFields: Record<string, string[]> = {
      'restaurant': [
        ...commonFields,
        // Auto-generated or advanced fields
        'slug',
        'base_url',
        'subdomain',
        // Company info (optional for Lite)
        'company',
      ],
      'config': [
        ...commonFields,
        // Advanced config fields
        'base_url',
      ],
      'categories': [
        ...commonFields,
        // Category-specific advanced fields (if any)
      ],
      'products': [
        ...commonFields,
        // Product-specific advanced fields (if any)
      ],
      'home_features': [
        ...commonFields,
        // Advanced home features (if any)
      ]
    }

    return stepSpecificFields[stepId] || commonFields
  }

  const currentStepData = steps.length > 0 && currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null
  
  const progressCount = completedSteps.size > 0 ? completedSteps.size : 0

  const progressPercentage = steps.length > 0 ? (progressCount / steps.length) * 100 : 0

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1
      const stepSlug = getStepIdFromIndex(nextStep)
      if (stepSlug) {
        navigate(`/lite-setup/${stepSlug}`)
      } else {
        setCurrentStep(nextStep)
      }
    }
  }

  const handlePrevious = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      const stepSlug = getStepIdFromIndex(prevStep)
      if (stepSlug) {
        navigate(`/lite-setup/${stepSlug}`)
      } else {
        setCurrentStep(prevStep)
      }
    }
  }

  if (!selectedRestaurant) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lite Restaurant Setup</h2>
          <p className="text-muted-foreground">Please select a restaurant from the dropdown above to continue.</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">No restaurant selected</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (steps.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lite Restaurant Setup</h2>
          <p className="text-muted-foreground">Loading setup steps...</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lite Restaurant Setup</h1>
            <p className="text-muted-foreground">
              Configure your restaurant with essential features for the Lite plan
            </p>
          </div>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Star className="w-3 h-3 mr-1" />
            Lite Plan
          </Badge>
        </div>
      </div>

      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader 
          className="cursor-pointer hover:bg-yellow-100/50 transition-colors"
          onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded)}
        >
          <CardTitle className="flex items-center justify-between text-yellow-800">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Lite Plan Features
            </div>
            {isFeaturesExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </CardTitle>
          <CardDescription>
            Your Lite plan includes essential features to get your restaurant started
          </CardDescription>
        </CardHeader>
        {isFeaturesExpanded && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Digital QR Menu</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Basic Restaurant Info</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Menu Categories (up to 10)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Menu Items (up to 50)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Basic Home Features</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Mobile Friendly</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Lite plan includes up to 200 menu images. Video uploads and advanced features are available in the Pro plan.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Setup Progress</CardTitle>
            <span className="text-sm text-muted-foreground">
              {progressCount} of {steps.length} completed
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">
            {Math.round(progressPercentage)}% complete
          </p>
        </CardContent>
      </Card>

      {currentStepData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                Step {currentStep + 1} of {steps.length}
              </span>
              {currentStepData.title}
            </CardTitle>
            <CardDescription>
              {currentStepData.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicForm
              doctype={currentStepData.doctype}
              docname={selectedRestaurant}
              mode="edit"
              initialData={stepData[currentStepData.id] || {}}
              readOnlyFields={currentStepData.view_only ? [] : undefined}
              onChange={setFormHasChanges}
              showSaveButton={false}
              hideFields={getLiteHideFields(currentStepData.id)}
              onSave={(data: any) => {
                setCompletedSteps(prev => new Set([...prev, currentStep]))
                setStepData(prev => ({ ...prev, [currentStepData.id]: data }))
                toast.success(`${currentStepData.title} completed successfully!`)
                setTimeout(() => {
                  handleNext()
                }, 1000)
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </div>
        
        <Button
          onClick={handleNext}
          disabled={currentStep === steps.length - 1}
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
