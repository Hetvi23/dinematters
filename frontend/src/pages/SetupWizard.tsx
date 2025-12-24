import { useState, useEffect, useRef } from 'react'
import { useFrappeGetCall, useFrappeGetDocList, useFrappeGetDoc, useFrappePostCall } from '@/lib/frappe'
import { Stepper, Step } from '@/components/ui/stepper'
import DynamicForm from '@/components/DynamicForm'
import StaffMembersList from '@/components/StaffMembersList'
import RestaurantDataList from '@/components/RestaurantDataList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, ArrowRight, Check, Info, Plus, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

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

export default function SetupWizard() {
  const navigate = useNavigate()
  
  // Restaurant selection state - initialize from localStorage only once using function initializer
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dinematters-setup-restaurant')
    } catch {
      return null
    }
  })
  const [showRestaurantSelection, setShowRestaurantSelection] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dinematters-setup-show-selection')
      return saved !== 'false'
    } catch {
      return true
    }
  })
  
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

  // Get setup progress for selected restaurant
  const { data: progressData } = useFrappeGetCall<{ message: Record<string, boolean> }>(
    'dinematters.dinematters.api.ui.get_restaurant_setup_progress',
    { restaurant_id: selectedRestaurant || '' },
    selectedRestaurant ? `restaurant-progress-${selectedRestaurant}` : null
  )

  const progress = progressData?.message || {}

  // Get restaurant name from step data if available (define early to avoid initialization errors)
  const restaurantId = selectedRestaurant || null
  
  // Get restaurant data if editing existing
  const { data: restaurantData, mutate: refreshRestaurantData } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant && showRestaurantSelection === false
  })
  
  // Get Restaurant Config data if restaurant exists
  const { data: configData } = useFrappeGetDoc('Restaurant Config', restaurantId || '', {
    enabled: !!restaurantId && showRestaurantSelection === false
  })

  const [currentStep, setCurrentStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dinematters-setup-step')
      return saved ? parseInt(saved, 10) : 0
    } catch {
      return 0
    }
  })
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

  useEffect(() => {
    if (isInitialMount.current) return
    try {
      localStorage.setItem('dinematters-setup-show-selection', showRestaurantSelection.toString())
    } catch (e) {
      console.error('Failed to save showSelection to localStorage:', e)
    }
  }, [showRestaurantSelection])

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
            return new Set(JSON.parse(saved))
          }
        } catch {
          // Ignore errors
        }
        return new Set<number>()
      })()
      
      // Merge: backend progress + persisted completed steps
      const merged = new Set([...completed, ...persistedCompleted])
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

      // Check if we have a persisted step from localStorage
      try {
        const savedStep = localStorage.getItem('dinematters-setup-step')
        const persistedStep = savedStep ? parseInt(savedStep, 10) : null
        
        if (persistedStep !== null && persistedStep >= 0 && persistedStep < steps.length) {
          // Use persisted step if valid
          setCurrentStep(persistedStep)
        } else {
          // No valid persisted step, find first incomplete required step
          const firstIncomplete = steps.findIndex((step, index) => !completed.has(index) && step.required)
          if (firstIncomplete !== -1) {
            setCurrentStep(firstIncomplete)
          }
        }
      } catch (e) {
        // Fallback to finding first incomplete step
        const firstIncomplete = steps.findIndex((step, index) => !completed.has(index) && step.required)
        if (firstIncomplete !== -1) {
          setCurrentStep(firstIncomplete)
        }
      }
    }
    
    // Reset initialization flag when restaurant changes
    if (!selectedRestaurant) {
      progressInitialized.current = null
    }
  }, [selectedRestaurant, progress, steps, restaurantData, configData])
  
  // Load step documents when restaurant and progress are available
  const { call: getDocList } = useFrappePostCall('frappe.client.get_list')
  const { call: getDoc } = useFrappePostCall('frappe.client.get')
  
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
  const restaurantName = restaurantId || stepData['restaurant']?.name || stepData['restaurant']?.restaurant_id || selectedRestaurant
  
  // Update restaurantId with step data if available (but keep the early definition above)
  const finalRestaurantId = restaurantId || stepData['restaurant']?.name || stepData['restaurant']?.restaurant_id || selectedRestaurant
  const { data: restaurantUsers } = useFrappeGetDocList(
    'Restaurant User',
    {
      fields: ['name', 'user', 'restaurant', 'role'],
      filters: { restaurant: finalRestaurantId || '' },
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
  
  // Reset form state when step changes
  useEffect(() => {
    setFormHasChanges(false)
    setTriggerSave(0)
  }, [currentStep])

  const handleRestaurantSelect = (restaurantId: string) => {
    // Reset initialization flag to reload all data for the new restaurant
    progressInitialized.current = null
    setSelectedRestaurant(restaurantId)
    setShowRestaurantSelection(false)
    // Clear step data to force reload
    setStepData({})
    setCompletedSteps(new Set())
    // Persist the selection
    try {
      localStorage.setItem('dinematters-setup-restaurant', restaurantId)
      localStorage.setItem('dinematters-setup-show-selection', 'false')
    } catch (e) {
      console.error('Failed to save restaurant selection to localStorage:', e)
    }
  }

  const handleCreateNew = () => {
    setSelectedRestaurant(null)
    setShowRestaurantSelection(false)
    setCurrentStep(0)
    setCompletedSteps(new Set())
    setStepData({})
  }

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
        setSelectedRestaurant(data.name || data.restaurant_id)
      }
    }
    setCompletedSteps(prev => new Set([...prev, currentStep]))
    
    // Reset form changes flag and trigger save
    setFormHasChanges(false)
    setTriggerSave(0) // Reset trigger
    
    // Auto-advance to next step if not last
    if (currentStep < steps.length - 1) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, 500)
    } else {
      navigate('/dashboard')
    }
  }

  const handleNext = () => {
    // Allow moving to next step even if not completed
    // This allows users to navigate forward without being stuck
    if (currentStep < steps.length - 1) {
      setFormHasChanges(false) // Reset changes flag when moving forward
      setCurrentStep(prev => prev + 1)
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
      setCurrentStep(prev => prev + 1)
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
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (completedSteps.has(stepIndex) || stepIndex === currentStep) {
      setCurrentStep(stepIndex)
    }
  }

  const stepperSteps: Step[] = steps.length > 0 ? steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    completed: completedSteps.has(index),
    active: index === currentStep,
  })) : []

  // Restaurant Selection Screen
  if (showRestaurantSelection && !restaurantsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
          <p className="text-muted-foreground">
            Select an existing restaurant to continue setup, or create a new one
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Create New Restaurant Card */}
          <Card 
            className="border-2 border-dashed hover:border-primary cursor-pointer transition-all hover:shadow-lg"
            onClick={handleCreateNew}
          >
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl mb-2">Create New Restaurant</CardTitle>
              <CardDescription className="text-center">
                Start setting up a new restaurant from scratch
              </CardDescription>
            </CardContent>
          </Card>

          {/* Existing Restaurants */}
          {restaurants.map((restaurant) => (
            <Card 
              key={restaurant.name}
              className="border-2 hover:border-primary cursor-pointer transition-all hover:shadow-lg"
              onClick={() => handleRestaurantSelect(restaurant.name)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{restaurant.restaurant_name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        ID: {restaurant.restaurant_id}
                      </CardDescription>
                    </div>
                  </div>
                  {restaurant.is_active ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {restaurant.owner_email && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Owner: {restaurant.owner_email}
                  </p>
                )}
                <Button variant="outline" className="w-full">
                  Continue Setup
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {restaurants.length === 0 && (
          <Card className="border-2">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                You don't have access to any restaurants yet.
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Restaurant
              </Button>
            </CardContent>
          </Card>
        )}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup Wizard</h2>
          <p className="text-muted-foreground">
            Follow these steps to set up your restaurant
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setShowRestaurantSelection(true)
            setSelectedRestaurant(null)
          }}
        >
          <Building2 className="mr-2 h-4 w-4" />
          Change Restaurant
        </Button>
      </div>

      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-xl">Setup Progress</CardTitle>
              <CardDescription className="mt-1">
                Step {currentStep + 1} of {steps.length}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{Math.round(progressPercentage)}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Complete</div>
            </div>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <Stepper 
            steps={stepperSteps} 
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </CardContent>
      </Card>

      {currentStepData && (
        <Card className="border-2">
          <CardHeader className="pb-4">
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
              <div className="bg-muted/30 rounded-lg p-6 border">
                <DynamicForm
                  onChange={setFormHasChanges}
                  showSaveButton={false}
                  doctype={currentStepData.doctype}
                  hideFields={currentStepData.id === 'restaurant' ? ['restaurant_id', 'company'] : undefined}
                  docname={(() => {
                    const savedData = stepData[currentStepData.id]
                    // For restaurant, use the selected restaurant name
                    if (currentStepData.id === 'restaurant' && selectedRestaurant) {
                      return selectedRestaurant
                    }
                    // For config, use restaurant as docname (autoname: field:restaurant)
                    if (currentStepData.id === 'config' && finalRestaurantId) {
                      return finalRestaurantId
                    }
                    return savedData?.name || savedData?.restaurant_id || undefined
                  })()}
                  mode={(() => {
                    // If restaurant exists, always use edit mode
                    if (currentStepData.id === 'restaurant' && selectedRestaurant && restaurantData) {
                      return 'edit'
                    }
                    // If config exists, use edit mode
                    if (currentStepData.id === 'config' && progress?.config) {
                      return 'edit'
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
                    
                    // For Restaurant Config - always set restaurant and load existing data
                    if (currentStepData.id === 'config') {
                      const restaurantValue = finalRestaurantId || restaurantName
                      const configData = stepData['config'] || {}
                      return {
                        restaurant: restaurantValue,
                        ...configData
                      }
                    }
                    
                    // For other steps that depend on restaurant
                    if (currentStepData.depends_on === 'restaurant') {
                      const restaurantValue = finalRestaurantId || restaurantName
                      const savedData = stepData[currentStepData.id]
                      return {
                        restaurant: restaurantValue,
                        ...(savedData ? { ...savedData, name: undefined } : {})
                      }
                    }
                    
                    // Load saved data for completed steps
                    if (completedSteps.has(currentStep) && stepData[currentStepData.id]) {
                      const saved = { ...stepData[currentStepData.id] }
                      delete saved.name
                      return saved
                    }
                    
                    return {}
                  })()}
                  onSave={handleStepComplete}
                  triggerSave={triggerSave}
                />
              </div>
            )}

            <div className="flex justify-between mt-6 pt-6 border-t">
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

