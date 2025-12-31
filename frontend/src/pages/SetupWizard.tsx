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
  // Map step IDs to URL-friendly slugs
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
  // Reverse mapping
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
  const { selectedRestaurant, setSelectedRestaurant } = useRestaurant()
  
  // Get user's restaurants
  const { data: restaurantsData, isLoading: restaurantsLoading } = useFrappeGetCall<{ message: { restaurants: Restaurant[] } }>(
    'dinematters.dinematters.api.ui.get_user_restaurants',
    {},
    'user-restaurants'
  )
  
  const restaurants = restaurantsData?.message?.restaurants || []
  
  // Get setup wizard steps
  const { data: stepsData } = useFrappeGetCall<{ message: { steps: WizardStep[] } }>(
    'dinematters.dinematters.api.ui.get_setup_wizard_steps',
    {},
    'setup-wizard-steps'
  )

  // Safely extract steps from API response
  const steps: WizardStep[] = (() => {
    if (!stepsData?.message) return []
    const msg = stepsData.message
    if (Array.isArray(msg)) return msg
    if (msg.steps && Array.isArray(msg.steps)) return msg.steps
    return []
  })()

  // Helper function to get step index from step ID
  const getStepIndexFromId = (stepId: string | undefined): number => {
    if (!stepId || steps.length === 0) return 0
    const id = slugToStepId(stepId)
    const index = steps.findIndex(step => step.id === id)
    return index >= 0 ? index : 0
  }

  // Helper function to get step ID from index
  const getStepIdFromIndex = (index: number): string => {
    if (index < 0 || index >= steps.length) return ''
    return stepIdToSlug(steps[index].id)
  }

  // Get setup progress for selected restaurant
  const { data: progressData } = useFrappeGetCall<{ message: Record<string, boolean> }>(
    'dinematters.dinematters.api.ui.get_restaurant_setup_progress',
    { restaurant_id: selectedRestaurant || '' },
    selectedRestaurant ? `restaurant-progress-${selectedRestaurant}` : null
  )

  const progress = progressData?.message || {}

  // Get restaurant name from step data if available (define early to avoid initialization errors)
  // Always use selectedRestaurant from context as the primary source
  const restaurantId = selectedRestaurant || null
  
  // Get restaurant data if editing existing
  const { data: restaurantData } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant
  })
  
  // Get Restaurant Config data if restaurant exists
  const { data: configData } = useFrappeGetDoc('Restaurant Config', restaurantId || '', {
    enabled: !!restaurantId
  })

  // Initialize currentStep from URL or localStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    // First priority: URL parameter
    if (urlStepId && steps.length > 0) {
      const stepIndex = getStepIndexFromId(urlStepId)
      if (stepIndex >= 0) return stepIndex
    }
    // Fallback: localStorage
    try {
      const saved = localStorage.getItem('dinematters-setup-step')
      return saved ? parseInt(saved, 10) : 0
    } catch {
      return 0
    }
  })

  // Track if we're updating from URL to prevent circular updates
  const isUpdatingFromUrl = useRef(false)
  
  // Sync URL with currentStep when steps are loaded or URL changes
  useEffect(() => {
    if (steps.length === 0) return
    
    // If URL has a stepId, use it to set currentStep
    if (urlStepId) {
      const stepIndex = getStepIndexFromId(urlStepId)
      if (stepIndex >= 0 && stepIndex !== currentStep) {
        isUpdatingFromUrl.current = true
        setCurrentStep(stepIndex)
      }
    } else if (location.pathname === '/setup') {
      // If no stepId in URL but we're on /setup, redirect to first step
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug) {
        navigate(`/setup/${stepSlug}`, { replace: true })
      }
    }
  }, [urlStepId, steps.length, currentStep, navigate, location.pathname])

  // Update URL when currentStep changes (but not from URL sync)
  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false
      return
    }
    
    if (steps.length > 0 && currentStep >= 0 && currentStep < steps.length) {
      const stepSlug = getStepIdFromIndex(currentStep)
      if (stepSlug) {
        const expectedPath = `/setup/${stepSlug}`
        if (location.pathname !== expectedPath) {
          navigate(expectedPath, { replace: true })
        }
      }
    }
  }, [currentStep, steps.length, navigate, location.pathname])
  // Initialize completedSteps from localStorage if available
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('dinematters-setup-completed-steps')
      if (saved) {
        const parsed = JSON.parse(saved)
        return new Set(parsed)
      }
    } catch {
      // Ignore errors
    }
    return new Set()
  })
  
  // Persist completedSteps to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('dinematters-setup-completed-steps', JSON.stringify(Array.from(completedSteps)))
    } catch (e) {
      console.error('Failed to save completed steps to localStorage:', e)
    }
  }, [completedSteps])
  const [stepData, setStepData] = useState<Record<string, any>>({})
  const [formHasChanges, setFormHasChanges] = useState(false) // Track if current form has unsaved changes
  const [triggerSave, setTriggerSave] = useState(0) // Trigger save in DynamicForm
  const [showProgressModal, setShowProgressModal] = useState(false) // Control progress modal visibility

  // Use ref to track if this is the initial mount (prevent saving on initial load)
  const isInitialMount = useRef(true)

  // Persist state to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    try {
      if (selectedRestaurant) {
        localStorage.setItem('dinematters-setup-restaurant', selectedRestaurant)
      } else {
        localStorage.removeItem('dinematters-setup-restaurant')
      }
    } catch (e) {
      console.error('Failed to save restaurant to localStorage:', e)
    }
  }, [selectedRestaurant])

  useEffect(() => {
    if (isInitialMount.current) return
    try {
      localStorage.setItem('dinematters-setup-step', currentStep.toString())
    } catch (e) {
      console.error('Failed to save step to localStorage:', e)
    }
  }, [currentStep])


  // Initialize progress when restaurant is selected
  // Use a ref to track if we've already initialized to prevent loops
  const progressInitialized = useRef<string | null>(null)
  
  // Load all step data when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant && progress && steps.length > 0 && progressInitialized.current !== selectedRestaurant) {
      progressInitialized.current = selectedRestaurant
      
      const stepMapping: Record<string, string> = {
        'restaurant': 'restaurant',
        'config': 'config',
        'users': 'users',
        'categories': 'categories',
        'products': 'products',
        'offers': 'offers',
        'coupons': 'coupons',
        'events': 'events',
        'games': 'games',
        'home_features': 'home_features',
        'table_booking': 'table_booking',
        'banquet_booking': 'banquet_booking',
      }

      const completed = new Set<number>()
      const newStepData: Record<string, any> = {}

      // Load restaurant data
      if (restaurantData) {
        newStepData['restaurant'] = restaurantData
      }

      // Load data for each step that has progress
      steps.forEach((step, index) => {
        const progressKey = stepMapping[step.id]
        if (progressKey && progress[progressKey]) {
          completed.add(index)
          
          // Load the actual document data for this step
          if (step.doctype && step.id !== 'restaurant') {
            // For steps that depend on restaurant, load the document
            if (step.depends_on === 'restaurant' || step.id === 'config') {
              // Load document by restaurant filter
              // We'll use useFrappeGetDocList to get the first matching document
              // This will be handled in a separate effect
            }
          }
        }
      })

      // Merge backend progress with any persisted completed steps
      const persistedCompleted = (() => {
        try {
          const saved = localStorage.getItem('dinematters-setup-completed-steps')
          if (saved) {
            const parsed = JSON.parse(saved) as number[]
            return new Set<number>(parsed)
          }
        } catch {
          // Ignore errors
        }
        return new Set<number>()
      })()
      
      // Merge: backend progress + persisted completed steps
      const merged = new Set<number>([...completed, ...persistedCompleted])
      setCompletedSteps(merged)
      
      // Load restaurant data
      if (restaurantData) {
        newStepData['restaurant'] = restaurantData
      }
      
      // Load config data if it exists
      if (configData && progress['config']) {
        newStepData['config'] = configData
      }
      
      setStepData(prev => ({ ...prev, ...newStepData }))

      // Only set step from localStorage if URL doesn't have a stepId
      // URL takes priority over localStorage
      if (!urlStepId) {
        try {
          const savedStep = localStorage.getItem('dinematters-setup-step')
          const persistedStep = savedStep ? parseInt(savedStep, 10) : null
          
          if (persistedStep !== null && persistedStep >= 0 && persistedStep < steps.length) {
            // Use persisted step if valid, but update URL
            const stepSlug = getStepIdFromIndex(persistedStep)
            if (stepSlug) {
              navigate(`/setup/${stepSlug}`, { replace: true })
            } else {
              setCurrentStep(persistedStep)
            }
          } else {
            // No valid persisted step, find first incomplete required step
            const firstIncomplete = steps.findIndex((step, index) => !completed.has(index) && step.required)
            if (firstIncomplete !== -1) {
              const stepSlug = getStepIdFromIndex(firstIncomplete)
              if (stepSlug) {
                navigate(`/setup/${stepSlug}`, { replace: true })
              } else {
                setCurrentStep(firstIncomplete)
              }
            }
          }
        } catch (e) {
          // Fallback to finding first incomplete step
          const firstIncomplete = steps.findIndex((step, index) => !completed.has(index) && step.required)
          if (firstIncomplete !== -1) {
            const stepSlug = getStepIdFromIndex(firstIncomplete)
            if (stepSlug) {
              navigate(`/setup/${stepSlug}`, { replace: true })
            } else {
              setCurrentStep(firstIncomplete)
            }
          }
        }
      }
    }
    
    // Reset initialization flag when restaurant changes
    if (!selectedRestaurant) {
      progressInitialized.current = null
    }
  }, [selectedRestaurant, progress, steps, restaurantData, configData, urlStepId, navigate])
  
  // Load step documents when restaurant and progress are available
  const { call: getDocList } = useFrappePostCall('frappe.client.get_list')
  const { call: getDoc } = useFrappePostCall('frappe.client.get')
  
  // Load all step documents when restaurant and progress are available
  useEffect(() => {
    if (!selectedRestaurant || !progress || steps.length === 0) return

    const stepDocTypeMap: Record<string, string> = {
      'config': 'Restaurant Config',
      'offers': 'Offer',
      'coupons': 'Coupon',
      'events': 'Event',
      'games': 'Game',
      'home_features': 'Home Feature',
      'table_booking': 'Table Booking',
      'banquet_booking': 'Banquet Booking',
    }

    // Load documents for each completed step
    const loadStepData = async () => {
      const loadedData: Record<string, any> = {}
      
      for (const [stepId, doctype] of Object.entries(stepDocTypeMap)) {
        if (progress[stepId]) {
          try {
            // Get the first document for this restaurant
            const result: any = await getDocList({
              doctype,
              filters: JSON.stringify({ restaurant: selectedRestaurant }),
              fields: JSON.stringify(['name']),
              limit_page_length: 1,
              order_by: 'modified desc'
            })
            
            if (result?.message && Array.isArray(result.message) && result.message.length > 0) {
              // Get full document details
              const docName = result.message[0].name
              const fullDoc: any = await getDoc({
                doctype,
                name: docName
              })
              
              if (fullDoc?.message) {
                loadedData[stepId] = fullDoc.message
              } else if (result.message[0]) {
                // Fallback to the list result
                loadedData[stepId] = result.message[0]
              }
            }
          } catch (error) {
            console.error(`Error loading ${doctype} for step ${stepId}:`, error)
          }
        }
      }
      
      if (Object.keys(loadedData).length > 0) {
        setStepData(prev => ({ ...prev, ...loadedData }))
      }
    }

    loadStepData()
  }, [selectedRestaurant, progress, steps, getDocList, getDoc])

  // Load data for current step when URL changes or step changes
  // This ensures data is fetched immediately when navigating via URL
  const currentStepDataRef = useRef<{ stepId: string | null, urlStepId: string | null }>({ stepId: null, urlStepId: null })
  const [loadingStepData, setLoadingStepData] = useState<Record<string, boolean>>({})
  
  useEffect(() => {
    if (!selectedRestaurant || !progress || steps.length === 0 || currentStep < 0 || currentStep >= steps.length) return

    const currentStepInfo = steps[currentStep]
    if (!currentStepInfo) return

    const stepId = currentStepInfo.id
    
    // Always reload when URL changes, even if stepId is the same
    // This ensures we get fresh data from backend when navigating via URL
    const shouldReload = currentStepDataRef.current.stepId !== stepId || 
                         currentStepDataRef.current.urlStepId !== urlStepId
    
    if (!shouldReload) {
      return
    }
    
    currentStepDataRef.current = { stepId, urlStepId: urlStepId || null }

    const stepDocTypeMap: Record<string, string> = {
      'config': 'Restaurant Config',
      'offers': 'Offer',
      'coupons': 'Coupon',
      'events': 'Event',
      'games': 'Game',
      'home_features': 'Home Feature',
      'table_booking': 'Table Booking',
      'banquet_booking': 'Banquet Booking',
    }

    const doctype = stepDocTypeMap[stepId]

    // Load data if this step has a doctype and progress indicates it exists
    // Always reload when URL changes to ensure fresh data
    if (doctype && progress[stepId]) {
      // Mark as loading
      setLoadingStepData(prev => ({ ...prev, [stepId]: true }))
      
      const loadCurrentStepData = async () => {
        try {
          console.log(`[SetupWizard] Loading data for step ${stepId} (${doctype}) from URL: ${urlStepId}`)
          
          // Get the first document for this restaurant
          const result: any = await getDocList({
            doctype,
            filters: JSON.stringify({ restaurant: selectedRestaurant }),
            fields: JSON.stringify(['name']),
            limit_page_length: 1,
            order_by: 'modified desc'
          })
          
          if (result?.message && Array.isArray(result.message) && result.message.length > 0) {
            // Get full document details
            const docName = result.message[0].name
            const fullDoc: any = await getDoc({
              doctype,
              name: docName
            })
            
            if (fullDoc?.message) {
              console.log(`[SetupWizard] Loaded data for step ${stepId}:`, fullDoc.message)
              setStepData(prev => ({ ...prev, [stepId]: fullDoc.message }))
            } else if (result.message[0]) {
              // Fallback to the list result
              setStepData(prev => ({ ...prev, [stepId]: result.message[0] }))
            }
          } else {
            // No document found, clear stepData for this step
            console.log(`[SetupWizard] No document found for step ${stepId}, clearing stepData`)
            setStepData(prev => {
              const updated = { ...prev }
              delete updated[stepId]
              return updated
            })
          }
        } catch (error) {
          console.error(`Error loading ${doctype} for step ${stepId}:`, error)
        } finally {
          setLoadingStepData(prev => ({ ...prev, [stepId]: false }))
        }
      }

      loadCurrentStepData()
    } else if (!progress[stepId]) {
      // If step is not completed, ensure stepData is cleared
      setStepData(prev => {
        if (prev[stepId]) {
          const updated = { ...prev }
          delete updated[stepId]
          return updated
        }
        return prev
      })
      setLoadingStepData(prev => ({ ...prev, [stepId]: false }))
    }
  }, [currentStep, urlStepId, selectedRestaurant, progress, steps, getDocList, getDoc])

  const currentStepData = steps.length > 0 && currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null
  
  // Calculate progress based on completed steps state (prioritize this for real-time updates)
  // Use backend progress data only as fallback when completedSteps is empty (initial load)
  const progressCount = completedSteps.size > 0 ? completedSteps.size : (progress && steps.length > 0 ? (() => {
    const stepMapping: Record<string, string> = {
      'restaurant': 'restaurant',
      'config': 'config',
      'users': 'users',
      'categories': 'categories',
      'products': 'products',
      'offers': 'offers',
      'coupons': 'coupons',
      'events': 'events',
      'games': 'games',
      'home_features': 'home_features',
      'table_booking': 'table_booking',
      'banquet_booking': 'banquet_booking',
    }
    let count = 0
    steps.forEach((step) => {
      const progressKey = stepMapping[step.id]
      if (progressKey && progress[progressKey]) {
        count++
      }
    })
    return count
  })() : 0)
  
  const progressPercentage = steps.length > 0 ? (progressCount / steps.length) * 100 : 0
  
  // Debug: Log formHasChanges changes (after currentStepData is defined)
  useEffect(() => {
    if (currentStepData) {
      console.log('[SetupWizard] Button State:', {
        formHasChanges,
        currentStep,
        stepId: currentStepData.id,
        required: currentStepData.required,
        completed: completedSteps.has(currentStep),
        shouldShowSkip: !completedSteps.has(currentStep) && !currentStepData.required && !formHasChanges,
        shouldShowSave: formHasChanges && !completedSteps.has(currentStep),
        shouldShowNext: completedSteps.has(currentStep)
      })
    }
  }, [formHasChanges, currentStep, currentStepData, completedSteps])

  // Get restaurant name from step data if available
  // Priority: selectedRestaurant from context > stepData > fallback
  const restaurantName = selectedRestaurant || stepData['restaurant']?.name || stepData['restaurant']?.restaurant_id || restaurantId
  
  // Update restaurantId with step data if available (but keep the early definition above)
  // Always prioritize selectedRestaurant from context
  const finalRestaurantId = selectedRestaurant || stepData['restaurant']?.name || stepData['restaurant']?.restaurant_id || restaurantId
  const { data: restaurantUsers } = useFrappeGetDocList(
    'Restaurant User',
    {
      fields: ['name', 'user', 'restaurant', 'role'],
      filters: finalRestaurantId ? ({ restaurant: finalRestaurantId } as any) : undefined,
    },
    finalRestaurantId ? `restaurant-users-${finalRestaurantId}` : null
  )

  // Auto-mark "Add Staff Members" step as completed if Restaurant User was auto-created
  useEffect(() => {
    if (finalRestaurantId && restaurantUsers && restaurantUsers.length > 0) {
      const usersStepIndex = steps.findIndex(s => s.id === 'users')
      if (usersStepIndex !== -1 && !completedSteps.has(usersStepIndex)) {
        setCompletedSteps(prev => new Set([...prev, usersStepIndex]))
      }
    }
  }, [finalRestaurantId, restaurantUsers, steps, completedSteps])
  
  // Reset form state when step changes (including URL changes)
  useEffect(() => {
    setFormHasChanges(false)
    setTriggerSave(0)
  }, [currentStep, urlStepId])


  const handleStepComplete = (data: any) => {
    // Validate that we got some data back (any document should have a 'name' field)
    if (!data) {
      console.error('No data returned from save')
      return
    }

    // Check if data has a name field (all Frappe documents have this)
    // Restaurant Config uses restaurant as the name field (autoname: field:restaurant)
    // So check for restaurant field as well
    const hasValidIdentifier = data.name || data.restaurant || data.restaurant_id || data.product_id || data.category_name
    
    // If no identifier, check if it's at least a valid object with some fields
    if (!hasValidIdentifier) {
      const hasValidStructure = typeof data === 'object' && Object.keys(data).length > 0
      if (!hasValidStructure) {
        console.error('Invalid data returned from save:', data)
        toast.error('Failed to save: Invalid response format. Please check the console for details.')
        return
      }
      // If it's an object with fields but no identifier, it might still be valid
      // (e.g., Restaurant Config might return just the restaurant field)
    }

    const stepId = currentStepData?.id
    if (stepId) {
      setStepData(prev => ({ ...prev, [stepId]: data }))
      
      // If restaurant was created, set it as selected
      if (stepId === 'restaurant' && (data.name || data.restaurant_id)) {
        const restaurantId = data.name || data.restaurant_id
        setSelectedRestaurant(restaurantId)
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('restaurant-selected'))
      }
    }
    setCompletedSteps(prev => new Set([...prev, currentStep]))
    
    // Reset form changes flag and trigger save
    setFormHasChanges(false)
    setTriggerSave(0) // Reset trigger
    
    // Show success message - stay on current step after saving
    toast.success('Changes saved successfully')
    
    // Do NOT auto-advance to next step - user stays on current step
    // User can manually navigate using Next/Previous/Skip buttons
  }

  const handleNext = () => {
    // Allow moving to next step even if not completed
    // This allows users to navigate forward without being stuck
    if (currentStep < steps.length - 1) {
      setFormHasChanges(false) // Reset changes flag when moving forward
      const nextStep = currentStep + 1
      const nextStepSlug = getStepIdFromIndex(nextStep)
      if (nextStepSlug) {
        navigate(`/setup/${nextStepSlug}`, { replace: true })
        // Reload page to ensure fresh data
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setCurrentStep(nextStep)
      }
    }
  }

  const handleSkip = () => {
    // Skip step and mark as completed (increases progress)
    // This allows users to skip even required steps and come back later
    if (currentStep < steps.length - 1) {
      setFormHasChanges(false) // Reset changes flag
      // Mark step as completed when skipping
      setCompletedSteps(prev => {
        const updated = new Set([...prev, currentStep])
        // Persist immediately
        try {
          localStorage.setItem('dinematters-setup-completed-steps', JSON.stringify(Array.from(updated)))
        } catch (e) {
          console.error('Failed to save completed steps:', e)
        }
        return updated
      })
      const nextStep = currentStep + 1
      const nextStepSlug = getStepIdFromIndex(nextStep)
      if (nextStepSlug) {
        navigate(`/setup/${nextStepSlug}`, { replace: true })
        // Reload page to ensure fresh data
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setCurrentStep(nextStep)
      }
    } else if (currentStep === steps.length - 1) {
      // On last step, mark as completed and finish
      setFormHasChanges(false)
      setCompletedSteps(prev => {
        const updated = new Set([...prev, currentStep])
        // Persist immediately before navigation
        try {
          localStorage.setItem('dinematters-setup-completed-steps', JSON.stringify(Array.from(updated)))
        } catch (e) {
          console.error('Failed to save completed steps:', e)
        }
        return updated
      })
      // Small delay to ensure state updates before navigation
      setTimeout(() => {
        toast.success('Setup wizard completed!')
        navigate('/dashboard')
      }, 100)
    }
  }
  
  const handleFinish = () => {
    // Finish setup wizard - mark current step as completed if not already
    setCompletedSteps(prev => {
      const updated = prev.has(currentStep) ? prev : new Set([...prev, currentStep])
      // Persist immediately before navigation
      try {
        localStorage.setItem('dinematters-setup-completed-steps', JSON.stringify(Array.from(updated)))
      } catch (e) {
        console.error('Failed to save completed steps:', e)
      }
      return updated
    })
    // Small delay to ensure state updates before navigation
    setTimeout(() => {
      toast.success('Setup wizard completed!')
      navigate('/dashboard')
    }, 100)
  }


  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      const prevStepSlug = getStepIdFromIndex(prevStep)
      if (prevStepSlug) {
        navigate(`/setup/${prevStepSlug}`, { replace: true })
        // Reload page to ensure fresh data
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setCurrentStep(prevStep)
      }
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (completedSteps.has(stepIndex) || stepIndex === currentStep) {
      const stepSlug = getStepIdFromIndex(stepIndex)
      if (stepSlug) {
        navigate(`/setup/${stepSlug}`, { replace: true })
        // Reload page to ensure fresh data
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setCurrentStep(stepIndex)
      }
      setShowProgressModal(false)
    }
  }

  const stepperSteps: Step[] = steps.length > 0 ? steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    completed: completedSteps.has(index),
    active: index === currentStep,
  })) : []


  // Show loading state if no restaurant is selected
  if (!selectedRestaurant && !restaurantsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
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
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
          <p className="text-muted-foreground">Loading setup steps...</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading wizard steps...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get restaurant display name for showing in read-only fields
  const displayRestaurantName = restaurantData?.restaurant_name || 
    restaurants.find(r => r.name === selectedRestaurant)?.restaurant_name ||
    selectedRestaurant ||
    'Restaurant'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{displayRestaurantName} wizard</h2>
          <p className="text-muted-foreground">
            Follow these steps to set up your restaurant
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowProgressModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white border-green-600"
        >
          Check progress: {Math.round(progressPercentage)}%
        </Button>
            </div>

      {currentStepData && (
        <Card className="border-2">
          <CardHeader className="pb-4">
            {/* Navigation Buttons - Above Heading */}
            <div className="flex justify-between mb-6 pb-4 border-b">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStepData ? (
                  <>
                    {currentStep < steps.length - 1 ? (
                      /* Not last step */
                      <>
                        {formHasChanges ? (
                          /* Step has unsaved changes - show Skip, Save Changes, and Next */
                          <>
                            <Button
                              variant="outline"
                              onClick={handleSkip}
                            >
                              Skip
                            </Button>
                            <Button
                              onClick={() => {
                                // Trigger save by incrementing triggerSave
                                setTriggerSave(prev => prev + 1)
                              }}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Save Changes
                            </Button>
                            <Button
                              onClick={handleNext}
                              variant="outline"
                              title='Move to next step without saving (changes will be lost)'
                            >
                              Next
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          /* No changes - show Skip and Next buttons together */
                          <>
                            <Button
                              variant="outline"
                              onClick={handleSkip}
                            >
                              Skip
                            </Button>
                            <Button
                              onClick={handleNext}
                            >
                              Next
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      /* Last step - show Skip and Finish buttons */
                      <>
                        {formHasChanges ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleSkip}
                            >
                              Skip & Finish
                            </Button>
                            <Button
                              onClick={() => {
                                // Trigger save by incrementing triggerSave
                                setTriggerSave(prev => prev + 1)
                              }}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Save Changes
                            </Button>
                            <Button
                              onClick={handleFinish}
                              variant="outline"
                              title='Finish setup without saving (changes will be lost)'
                            >
                              Finish
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleSkip}
                            >
                              Skip & Finish
                            </Button>
                            <Button
                              onClick={handleFinish}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Finish
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={currentStep < steps.length - 1 ? handleNext : handleFinish}
                    disabled={true}
                    title="Loading step data..."
                  >
                    {currentStep < steps.length - 1 ? (
                      <>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Finish
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{currentStepData.title}</CardTitle>
                <CardDescription className="text-base">{currentStepData.description}</CardDescription>
              </div>
              {currentStepData.required && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                  Required
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Staff Members - Show list of existing members */}
            {currentStepData.id === 'users' && finalRestaurantId && (
              <StaffMembersList 
                restaurantId={finalRestaurantId}
                onAdd={() => {
                  setCompletedSteps(prev => new Set([...prev, currentStep]))
                }}
              />
            )}

            {/* Menu Categories - Show list */}
            {currentStepData.id === 'categories' && finalRestaurantId && currentStepData.view_only && (
              <RestaurantDataList 
                doctype="Menu Category"
                restaurantId={finalRestaurantId}
                titleField="category_name"
              />
            )}

            {/* Menu Products - Show list */}
            {currentStepData.id === 'products' && finalRestaurantId && currentStepData.view_only && (
              <RestaurantDataList 
                doctype="Menu Product"
                restaurantId={finalRestaurantId}
                titleField="product_name"
              />
            )}

            {/* Default - Use DynamicForm for other steps */}
            {currentStepData && !['users', 'categories', 'products'].includes(currentStepData.id) && (
              <div className="bg-muted/30 rounded-md p-6 border">
                <DynamicForm
                  key={`${currentStepData.id}-${selectedRestaurant || 'no-restaurant'}-${currentStep}-${urlStepId || ''}`}
                  onChange={setFormHasChanges}
                  showSaveButton={false}
                  skipLoadingState={true}
                  doctype={currentStepData.doctype}
                  hideFields={currentStepData.id === 'restaurant' 
                    ? ['restaurant_id', 'company', 'subdomain'] 
                    : currentStepData.id === 'config'
                    ? ['restaurant_name', 'description', 'currency', 'primary_color']
                    : undefined}
                  readOnlyFields={currentStepData.id === 'config' 
                    ? ['restaurant', 'base_url'] 
                    : currentStepData.depends_on === 'restaurant'
                    ? ['restaurant']
                    : currentStepData.doctype === 'Restaurant'
                    ? ['base_url']
                    : undefined}
                  docname={(() => {
                    const savedData = stepData[currentStepData.id]
                    // For restaurant, use the selected restaurant name
                    if (currentStepData.id === 'restaurant' && selectedRestaurant) {
                      return selectedRestaurant
                    }
                    // For config, use restaurant as docname (autoname: field:restaurant)
                    // Use progress to determine if config exists, then use restaurant name directly
                    if (currentStepData.id === 'config') {
                      // If progress indicates config exists, use restaurant name as docname
                      // This ensures DynamicForm can fetch immediately without waiting for stepData
                      if (progress?.config && selectedRestaurant) {
                        const docname = selectedRestaurant || finalRestaurantId || undefined
                        console.log('[SetupWizard] Config step docname (from progress):', {
                          selectedRestaurant,
                          finalRestaurantId,
                          docname,
                          progress: progress?.config,
                          hasStepData: !!savedData
                        })
                        return docname
                      }
                      // If no progress yet, return undefined (create mode)
                      return undefined
                    }
                    // For other steps, check progress first, then use stepData
                    const progressKey = currentStepData.id
                    if (progress?.[progressKey] && selectedRestaurant) {
                      // If progress indicates step is completed, try to get docname
                      // First try from stepData (if already loaded)
                      if (savedData?.name) {
                        console.log(`[SetupWizard] Step ${currentStepData.id} docname (from stepData):`, savedData.name)
                        return savedData.name
                      }
                      // If stepData not loaded yet, trigger loading and return undefined
                      // The loading effect will update stepData, which will update docname
                      // DynamicForm will then fetch data when docname becomes available
                      if (!loadingStepData[currentStepData.id] && !savedData) {
                        // Trigger loading by checking if we need to load
                        console.log(`[SetupWizard] Step ${currentStepData.id} - progress exists, will load stepData`)
                      }
                      // Return undefined while loading - DynamicForm will wait
                      return undefined
                    }
                    // No progress, return undefined (create mode)
                    return undefined
                  })()}
                  mode={(() => {
                    // If restaurant exists, always use edit mode
                    if (currentStepData.id === 'restaurant' && selectedRestaurant && restaurantData) {
                      return 'edit'
                    }
                    // If config exists, use edit mode
                    if (currentStepData.id === 'config') {
                      const isEdit = !!(progress?.config && selectedRestaurant)
                      console.log('[SetupWizard] Config step mode:', {
                        'progress?.config': progress?.config,
                        selectedRestaurant,
                        isEdit,
                        mode: isEdit ? 'edit' : 'create'
                      })
                      return isEdit ? 'edit' : 'create'
                    }
                    // For other steps, check if completed
                    return completedSteps.has(currentStep) ? 'edit' : 'create'
                  })()}
                  initialData={(() => {
                    // For Restaurant step - load existing data
                    if (currentStepData.id === 'restaurant' && restaurantData) {
                      const data = { ...restaurantData }
                      delete data.name // Remove name, it's the docname
                      return data
                    }
                    
                    // Get saved step data if available
                    const savedStepData = stepData[currentStepData.id]
                    
                    // For Restaurant Config - always pass restaurant from context
                    // Merge with saved step data if available
                    if (currentStepData.id === 'config') {
                      const restaurantValue = selectedRestaurant || finalRestaurantId || restaurantName
                      const baseData = { restaurant: restaurantValue }
                      // Merge with saved data, but prioritize restaurant from context
                      if (savedStepData) {
                        return { ...savedStepData, restaurant: restaurantValue }
                      }
                      return baseData
                    }
                    
                    // For other steps that depend on restaurant
                    // Always pass restaurant from context, merge with saved data if available
                    if (currentStepData.depends_on === 'restaurant') {
                      const restaurantValue = selectedRestaurant || finalRestaurantId || restaurantName
                      const baseData = { restaurant: restaurantValue }
                      // Merge with saved data, but prioritize restaurant from context
                      if (savedStepData) {
                        return { ...savedStepData, restaurant: restaurantValue }
                      }
                      return baseData
                    }
                    
                    // For other completed steps, pass saved data if available
                    if (savedStepData) {
                      // Remove name field as it's used as docname
                      const data = { ...savedStepData }
                      delete data.name
                      return data
                    }
                    
                    return {}
                  })()}
                  onSave={handleStepComplete}
                  triggerSave={triggerSave}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="sm:max-w-[800px]">
          <Card className="border border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Setup Progress</CardTitle>
                  <CardDescription className="mt-1 text-sm text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-bold text-primary">{Math.round(progressPercentage)}%</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Complete</div>
                  </div>
                </div>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </CardHeader>
            <CardContent className="pt-4 pb-6 px-4 sm:px-6">
              <Stepper 
                steps={stepperSteps} 
                currentStep={currentStep}
                onStepClick={handleStepClick}
              />
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  )
}



