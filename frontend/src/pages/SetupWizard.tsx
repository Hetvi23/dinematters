import { useState, useEffect, useRef } from 'react'
import { useFrappeGetCall, useFrappeGetDocList, useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import DynamicForm from '@/components/DynamicForm'
import StaffMembersList from '@/components/StaffMembersList'
import RestaurantDataList from '@/components/RestaurantDataList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Stepper, Step } from '@/components/ui/stepper'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
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
  view_only?: boolean  // Show list instead of form
}

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  owner_email?: string
  is_active: number
  creation: string
  modified: string
}

// Helper function to convert step ID to URL-friendly slug
const stepIdToSlug = (stepId: string): string => {
  const slugMap: Record<string, string> = {
    'restaurant': 'CreateRestaurant',
    'config': 'RestaurantConfiguration',
    'users': 'StaffMembers',
    'categories': 'MenuCategories',
    'products': 'MenuProducts',
    'offers': 'CreateOffers',
    'coupons': 'CreateCoupons',
    'events': 'CreateEvents',
    'games': 'AddGames',
    'home_features': 'HomeFeatures',
    'table_booking': 'TableBookingSetup',
    'banquet_booking': 'BanquetBookingSetup',
  }
  return slugMap[stepId] || stepId
}

// Helper function to convert URL slug back to step ID
const slugToStepId = (slug: string): string => {
  const idMap: Record<string, string> = {
    'CreateRestaurant': 'restaurant',
    'RestaurantConfiguration': 'config',
    'StaffMembers': 'users',
    'MenuCategories': 'categories',
    'MenuProducts': 'products',
    'CreateOffers': 'offers',
    'CreateCoupons': 'coupons',
    'CreateEvents': 'events',
    'AddGames': 'games',
    'HomeFeatures': 'home_features',
    'TableBookingSetup': 'table_booking',
    'BanquetBookingSetup': 'banquet_booking',
  }
  return idMap[slug] || slug
}

export default function SetupWizard() {
  const navigate = useNavigate()
  const { stepId: urlStepId } = useParams<{ stepId?: string }>()
  const location = useLocation()
  const { selectedRestaurant, setSelectedRestaurant, isLite } = useRestaurant()
  
  // Smart routing: Check if we should show Lite or Pro setup
  useEffect(() => {
    if (selectedRestaurant && isLite) {
      if (location.pathname.startsWith('/setup')) {
        const stepId = urlStepId || ''
        navigate(stepId ? `/lite-setup/${stepId}` : '/lite-setup', { replace: true })
      }
    }
  }, [selectedRestaurant, isLite, navigate, location.pathname, urlStepId])
  
  // Get user's restaurants
  const { isLoading: restaurantsLoading } = useFrappeGetCall<{ message: { restaurants: Restaurant[] } }>(
    'dinematters.dinematters.api.ui.get_user_restaurants',
    {},
    'user-restaurants'
  )
  
  // Get setup wizard steps
  const { data: stepsData } = useFrappeGetCall<{ message: { steps: WizardStep[] } }>(
    'dinematters.dinematters.api.ui.get_setup_wizard_steps',
    {},
    'setup-wizard-steps'
  )

  const steps: WizardStep[] = (() => {
    if (!stepsData?.message) return []
    const msg = stepsData.message
    if (Array.isArray(msg)) return msg
    if (msg.steps && Array.isArray(msg.steps)) return msg.steps
    return []
  })()

  const getStepIndexFromId = (stepId: string | undefined): number => {
    if (!stepId) return -1
    const id = slugToStepId(stepId)
    if (steps.length > 0) {
      const index = steps.findIndex(step => step.id === id)
      return index >= 0 ? index : -1
    }
    const hardcodedOrder = ['restaurant', 'config', 'users', 'categories', 'products', 'offers', 'coupons', 'events', 'games', 'home_features', 'table_booking', 'banquet_booking']
    return hardcodedOrder.indexOf(id)
  }

  const getStepIdFromIndex = (index: number): string => {
    if (index < 0) return ''
    if (steps.length > 0 && index < steps.length) return stepIdToSlug(steps[index].id)
    const hardcodedOrder = ['restaurant', 'config', 'users', 'categories', 'products', 'offers', 'coupons', 'events', 'games', 'home_features', 'table_booking', 'banquet_booking']
    return index < hardcodedOrder.length ? stepIdToSlug(hardcodedOrder[index]) : ''
  }

  // Get setup progress
  const { data: progressData, mutate: refreshProgress } = useFrappeGetCall<{ message: Record<string, boolean> }>(
    'dinematters.dinematters.api.ui.get_restaurant_setup_progress',
    { restaurant_id: selectedRestaurant || '' },
    selectedRestaurant ? `restaurant-progress-${selectedRestaurant}` : null
  )

  const progress = progressData?.message || {}
  
  const { data: restaurantData, isLoading: restaurantLoading, mutate: refreshRestaurant } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant
  })
  
  const { data: configData, isLoading: configLoading, mutate: refreshConfig } = useFrappeGetDoc('Restaurant Config', selectedRestaurant || '', {
    enabled: !!selectedRestaurant
  })

  // State Management
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const pathParts = window.location.pathname.split('/')
    const slugFromUrl = pathParts[pathParts.length - 1]
    if (slugFromUrl && slugFromUrl !== 'setup' && slugFromUrl !== '') {
      const id = slugToStepId(slugFromUrl)
      const hardcodedOrder = ['restaurant', 'config', 'users', 'categories', 'products', 'offers', 'coupons', 'events', 'games', 'home_features', 'table_booking', 'banquet_booking']
      const index = hardcodedOrder.indexOf(id)
      if (index >= 0) return index
    }
    return parseInt(localStorage.getItem('dinematters-setup-step') || '0', 10)
  })

  const isUpdatingFromUrl = useRef(false)
  const isInitialMount = useRef(true)

  // Sync URL with currentStep
  useEffect(() => {
    if (steps.length === 0) return
    if (urlStepId) {
      const stepIndex = getStepIndexFromId(urlStepId)
      if (stepIndex >= 0 && stepIndex !== currentStep) {
        isUpdatingFromUrl.current = true
        setCurrentStep(stepIndex)
      }
    } else if (location.pathname === '/setup') {
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug) navigate(`/setup/${stepSlug}`, { replace: true })
    }
  }, [urlStepId, steps.length, navigate, location.pathname])

  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false
      return
    }
    if (steps.length > 0 && currentStep >= 0 && currentStep < steps.length) {
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug && location.pathname !== `/setup/${stepSlug}`) {
        navigate(`/setup/${stepSlug}`, { replace: true })
      }
      localStorage.setItem('dinematters-setup-step', currentStep.toString())
    }
  }, [currentStep, steps.length, navigate, location.pathname])

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (steps.length > 0 && progress) {
      const completed = new Set<number>()
      steps.forEach((step, index) => {
        if (progress[step.id] || (step.id === 'restaurant' && selectedRestaurant)) {
          completed.add(index)
        }
      })
      setCompletedSteps(completed)
    }
  }, [progress, steps, selectedRestaurant])

  const [stepData, setStepData] = useState<Record<string, any>>({})
  const [formHasChanges, setFormHasChanges] = useState(false)
  const [triggerSave, setTriggerSave] = useState(0)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [loadingStepData, setLoadingStepData] = useState(false)

  // Unified Data Fetching Effect
  const { call: getDocList } = useFrappePostCall('frappe.client.get_list')
  const { call: getDoc } = useFrappePostCall('frappe.client.get')

  useEffect(() => {
    if (!selectedRestaurant || steps.length === 0 || currentStep < 0 || currentStep >= steps.length) return
    
    const stepId = steps[currentStep].id
    const doctype = steps[currentStep].doctype
    
    // Always use the dedicated hooks for restaurant/config to maintain reactivity
    if (stepId === 'restaurant') {
      if (restaurantData) setStepData(prev => ({ ...prev, restaurant: restaurantData }))
      setLoadingStepData(restaurantLoading)
      return
    }
    if (stepId === 'config') {
      if (configData) setStepData(prev => ({ ...prev, config: configData }))
      setLoadingStepData(configLoading)
      return
    }

    if (doctype && progress[stepId] && !stepData[stepId]) {
      setLoadingStepData(true)
      const fetchStepData = async () => {
        try {
          const result: any = await getDocList({
            doctype,
            filters: JSON.stringify({ restaurant: selectedRestaurant }),
            fields: JSON.stringify(['name']),
            limit_page_length: 1
          })
          if (result?.message?.[0]?.name) {
            const fullDoc: any = await getDoc({ doctype, name: result.message[0].name })
            if (fullDoc?.message) setStepData(prev => ({ ...prev, [stepId]: fullDoc.message }))
          }
        } catch (e) {
          console.error(`Error loading step data for ${stepId}:`, e)
        } finally {
          setLoadingStepData(false)
        }
      }
      fetchStepData()
    } else {
      setLoadingStepData(false)
    }
  }, [currentStep, selectedRestaurant, progress, steps, restaurantData, configData, restaurantLoading, configLoading])

  // Handlers
  const handleStepComplete = (data: any) => {
    const stepId = steps[currentStep]?.id
    if (stepId) {
      setStepData(prev => ({ ...prev, [stepId]: data }))
      if (stepId === 'restaurant') {
        setSelectedRestaurant(data.name || data.restaurant_id)
        refreshRestaurant()
      } else if (stepId === 'config') {
        refreshConfig()
      }
    }
    refreshProgress()
    setFormHasChanges(false)
    setTriggerSave(0)
    toast.success('Changes saved successfully')
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextIndex = currentStep + 1
      const nextStepId = steps[nextIndex]?.id
      
      setCurrentStep(nextIndex)
      setFormHasChanges(false)
      
      // Force reload when going to Restaurant Configuration to ensure data binding
      if (nextStepId === 'config') {
        const slug = getStepIdFromIndex(nextIndex)
        window.location.href = `/dinematters/setup/${slug}`
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevIndex = currentStep - 1
      const prevStepId = steps[prevIndex]?.id
      
      setCurrentStep(prevIndex)
      setFormHasChanges(false)
      
      // Force reload when going back to Restaurant Configuration
      if (prevStepId === 'config') {
        const slug = getStepIdFromIndex(prevIndex)
        window.location.href = `/dinematters/setup/${slug}`
      }
    }
  }

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      setFormHasChanges(false)
    } else {
      toast.success('Setup wizard completed!')
      navigate('/dashboard')
    }
  }

  const handleFinish = () => {
    toast.success('Setup wizard completed!')
    navigate('/dashboard')
  }

  const handleStepClick = (index: number) => {
    if (completedSteps.has(index) || index === currentStep) {
      const targetStepId = steps[index]?.id
      
      if (targetStepId === 'config') {
        const slug = getStepIdFromIndex(index)
        window.location.href = `/dinematters/setup/${slug}`
      } else {
        setCurrentStep(index)
      }
      setShowProgressModal(false)
    }
  }

  const progressPercentage = steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0
  const currentStepData = steps[currentStep] || null

  const isFormDataLoading = loadingStepData || 
    (currentStepData?.id === 'restaurant' && restaurantLoading) || 
    (currentStepData?.id === 'config' && configLoading) ||
    (!selectedRestaurant && currentStep > 0) // Cannot load data for steps > 0 without a restaurant

  if (!selectedRestaurant && !restaurantsLoading && currentStep > 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Please select a restaurant to continue</h2>
        <p className="text-muted-foreground">The setup progress is linked to a specific restaurant.</p>
        <Button onClick={() => setCurrentStep(0)} className="rounded-xl">Go Back to Create Restaurant</Button>
      </div>
    )
  }

  if (steps.length === 0) return <div className="p-8 text-center">Loading setup steps...</div>

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{restaurantData?.restaurant_name || 'Restaurant'} Wizard</h2>
          <p className="text-muted-foreground">Follow these steps to perfectly set up your restaurant experience.</p>
        </div>
        <Button variant="outline" onClick={() => setShowProgressModal(true)} className="bg-green-600 hover:bg-green-700 text-white border-none shadow-lg">
          Progress: {Math.round(progressPercentage)}%
        </Button>
      </div>

      {currentStepData && (
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-background/50 backdrop-blur-xl border border-white/10">
          <CardHeader className="pb-4 border-b border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 0} className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip} className="rounded-xl">Skip</Button>
                {formHasChanges ? (
                  <Button onClick={() => setTriggerSave(prev => prev + 1)} className="rounded-xl px-8 shadow-blue-500/20 shadow-lg bg-blue-600 hover:bg-blue-700">
                    <Check className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
                ) : (
                  <Button onClick={currentStep < steps.length - 1 ? handleNext : handleFinish} className="rounded-xl px-8 shadow-blue-500/20 shadow-lg bg-blue-600 hover:bg-blue-700">
                    {currentStep < steps.length - 1 ? 'Next' : 'Finish'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{currentStepData.title}</CardTitle>
              <CardDescription className="text-base mt-2">{currentStepData.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="bg-muted/10 rounded-2xl p-0">
              {currentStepData.id === 'users' ? (
                <StaffMembersList restaurantId={selectedRestaurant || ''} onAdd={() => refreshProgress()} />
              ) : currentStepData.view_only ? (
                <RestaurantDataList doctype={currentStepData.doctype} restaurantId={selectedRestaurant || ''} titleField={currentStepData.id === 'categories' ? 'category_name' : 'product_name'} />
              ) : (
                <>
                  {isFormDataLoading ? (
                    <div className="p-20 text-center space-y-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Loading information...</p>
                    </div>
                  ) : (
                    <DynamicForm
                      key={`step-${currentStepData.id}-${selectedRestaurant}`}
                      doctype={currentStepData.doctype}
                      docname={(() => {
                        const id = currentStepData.id
                        // For singleton docs per restaurant (Restaurant and Restaurant Config), 
                        // the doc name is usually the restaurant ID itself
                        if (id === 'restaurant' || id === 'config') return selectedRestaurant
                        return stepData[id]?.name
                      })()}
                      initialData={(() => {
                        const id = currentStepData.id
                        const currentData = stepData[id]
                        
                        if (id === 'restaurant') return currentData || restaurantData || {}
                        if (id === 'config') return currentData || configData || { restaurant: selectedRestaurant }
                        
                        const saved = currentData || {}
                        if (currentStepData.depends_on === 'restaurant') return { ...saved, restaurant: selectedRestaurant }
                        return saved
                      })()}
                      mode={(progress[currentStepData.id] || (currentStepData.id === 'restaurant' && selectedRestaurant)) ? 'edit' : 'create'}
                      hideFields={currentStepData.id === 'restaurant' 
                        ? [
                            'restaurant_id', 'company', 'subdomain', 'slug', 'plan_type', 'plan_activated_on', 
                            'plan_changed_by', 'plan_change_reason', 'platform_fee_percent', 'monthly_minimum_fee', 
                            'monthly_minimum', 'billing_status', 'mandate_status', 'onboarding_date', 
                            'recommendation_run_count', 'recommendation_run', 'razorpay_account_id', 
                            'razorpay_kyc_status', 'razorpay_customer_id', 'razorpay_token_id', 
                            'razorpay_merchant_key_id', 'razorpay_keys_updated_at', 'razorpay_keys_updated_by', 
                            'max_images_lite', 'current_image_count', 'total_orders', 'total_revenue', 
                            'commission_earned', 'ai_credits_balance', 'ai_credits', 'total_ai_generations', 
                            'total_ai_cost', 'tax_rate', 'gst_number', 'enable_takeaway', 'enable_delivery', 
                            'no_ordering', 'default_delivery_fee', 'default_packaging_fee', 'minimum_order_value', 
                            'estimated_prep_time', 'restaurant_config'
                          ] 
                        : currentStepData.id === 'config' 
                        ? [
                            'restaurant_name', 'description', 'currency', 'primary_color', 'apple_touch_icon',
                            'section_break_ai_theme_background', 'menu_theme_background_enabled', 'menu_theme_paid_until',
                            'menu_theme_generation_status', 'menu_theme_background_active', 'menu_theme_wallpapers',
                            'menu_theme_main_index', 'menu_theme_selected_items', 'menu_theme_color_theme',
                            'column_break_ai_theme_background', 'menu_theme_background_preview', 'menu_theme_background_sources',
                            'menu_theme_background_history', 'menu_theme_last_error', 'section_break_color_palette',
                            'color_palette_violet', 'color_palette_indigo', 'color_palette_blue', 'color_palette_green',
                            'color_palette_yellow', 'color_palette_orange', 'color_palette_red',
                            'qr_code', 'brand_logo', 'hero_image', 'menu_theme', 'custom_css',
                            'hero_video', 'instagram_profile_link', 'facebook_profile_link', 'twitter_profile_link', 
                            'linkedin_profile_link', 'youtube_profile_link', 'google_review_link', 'verify_user', 
                            'experience_lounge_enabled', 'loyalty_referrals_enabled', 'coupons_enabled', 'offers_enabled', 
                            'events_enabled', 'banquet_booking_enabled', 'table_booking_enabled'
                          ] 
                        : []}
                      readOnlyFields={['restaurant']}
                      onChange={setFormHasChanges}
                      onSave={handleStepComplete}
                      triggerSave={triggerSave}
                      showSaveButton={false}
                    />
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="sm:max-w-2xl bg-background/90 backdrop-blur-2xl border-white/10 rounded-3xl p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-primary">{Math.round(progressPercentage)}%</h1>
              <p className="text-muted-foreground uppercase tracking-widest text-xs mt-1">Setup Complete</p>
            </div>
            <Progress value={progressPercentage} className="h-2 rounded-full" />
            <Stepper steps={steps.map((s, i) => ({ ...s, completed: completedSteps.has(i), active: i === currentStep }))} currentStep={currentStep} onStepClick={handleStepClick} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
