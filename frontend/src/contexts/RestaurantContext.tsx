import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'

interface Restaurant {
  name: string
  restaurant_id: string
  restaurant_name: string
  is_active: boolean
}

interface RestaurantContextType {
  selectedRestaurant: string | null
  setSelectedRestaurant: (restaurantId: string | null) => void
  restaurants: Restaurant[]
  isLoading: boolean
  setRestaurantsData: (data: Restaurant[]) => void
  restaurantConfig?: any | null
  setRestaurantConfig?: (cfg: any | null) => void
  refreshConfig: () => Promise<void>
  planType: 'LITE' | 'PRO' | 'LUX'
  isLux: boolean
  isPro: boolean
  isLite: boolean
  coinsBalance: number
  billingStatus: 'active' | 'overdue' | 'suspended'
  isActive: boolean
  features: {
    ordering: boolean
    videoUpload: boolean
    analytics: boolean
    aiRecommendations: boolean
    loyalty: boolean
    coupons: boolean
    games: boolean
    tableBooking: boolean
  }
  billingInfo: any | null
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

const STORAGE_KEY = 'dinematters-selected-restaurant'

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [selectedRestaurant, setSelectedRestaurantState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY)
      } catch {
        return null
      }
    }
    return null
  })
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restaurantConfig, setRestaurantConfig] = useState<any | null>(null)

  // Set a timeout to prevent infinite loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 3000) // 3 second timeout

    return () => clearTimeout(timer)
  }, [])

  // Load restaurants (this will be set by Layout component)
  const setRestaurantsData = (data: Restaurant[]) => {
    setRestaurants(data)
    setIsLoading(false)
    
    // Check current state and localStorage to determine if we need to set a default
    const currentSelected = selectedRestaurant
    if (!currentSelected && data.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY)
      let newSelectedRestaurant: string | null = null
      
      if (saved && data.find(r => r.name === saved || r.restaurant_id === saved)) {
        newSelectedRestaurant = saved
      } else {
        const firstRestaurant = data[0]
        newSelectedRestaurant = firstRestaurant.name
        localStorage.setItem(STORAGE_KEY, firstRestaurant.name)
      }
      
      if (newSelectedRestaurant) {
        setSelectedRestaurantState(newSelectedRestaurant)
      }
    }
  }

  const setSelectedRestaurant = (restaurantId: string | null) => {
    setSelectedRestaurantState(restaurantId)
    if (restaurantId) {
      try {
        localStorage.setItem(STORAGE_KEY, restaurantId)
      } catch {
        // Ignore errors
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore errors
      }
    }
  }

  const fetchConfig = useCallback(async () => {
    if (!selectedRestaurant) {
      setRestaurantConfig(null)
      return
    }
    
    try {
      const resp = await fetch(
        `/api/method/dinematters.dinematters.api.config.get_restaurant_config?restaurant_id=${encodeURIComponent(selectedRestaurant)}`,
        { cache: 'no-store' }
      )
      const json = await resp.json()
      
      const payload = json?.message ?? json
      if (payload?.success) {
        const configData = payload.data || null
        setRestaurantConfig(configData)
        setIsLoading(false)
      } else if (payload?.data) {
        setRestaurantConfig(payload.data)
        setIsLoading(false)
      } else {
        setRestaurantConfig(null)
        setIsLoading(false)
      }
    } catch (e) {
      setRestaurantConfig(null)
      setIsLoading(false)
    }
  }, [selectedRestaurant])

  // Fetch restaurant config (branding, features) when selectedRestaurant changes
  useEffect(() => {
    fetchConfig()
  }, [selectedRestaurant])

  // Sync with localStorage changes (e.g., from Layout component)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved !== selectedRestaurant) {
          setSelectedRestaurantState(saved)
        }
      } catch {
        // Ignore errors
      }
    }

    window.addEventListener('storage', handleStorageChange)
    // Also listen for custom events (for same-tab updates)
    window.addEventListener('restaurant-selected', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('restaurant-selected', handleStorageChange)
    }
  }, [selectedRestaurant])

  // Extract subscription data from config
  const planType = restaurantConfig?.subscription?.planType || 'LITE'
  const billingStatus = restaurantConfig?.subscription?.billingStatus || 'active'
  const coinsBalance = restaurantConfig?.subscription?.coinsBalance || 0
  const isActive = restaurantConfig?.subscription?.isActive ?? true
  
  const isLux = planType === 'LUX'
  const isPro = planType === 'PRO'
  const isLite = planType === 'LITE'
  
  const features = restaurantConfig?.subscription?.features ? {
    ordering: restaurantConfig.subscription.features.ordering ?? false,
    videoUpload: restaurantConfig.subscription.features.videoUpload ?? false,
    analytics: restaurantConfig.subscription.features.analytics ?? false,
    aiRecommendations: restaurantConfig.subscription.features.aiRecommendations ?? false,
    loyalty: restaurantConfig.subscription.features.loyalty ?? false,
    coupons: restaurantConfig.subscription.features.coupons ?? false,
    games: restaurantConfig.subscription.features.games ?? false,
    tableBooking: restaurantConfig.subscription.features.tableBooking ?? false,
  } : {
    ordering: false,
    videoUpload: false,
    analytics: false,
    aiRecommendations: false,
    loyalty: false,
    coupons: false,
    games: false,
    tableBooking: false,
  }

  const billingInfo = restaurantConfig?.subscription ? {
    coins_balance: restaurantConfig.subscription.coinsBalance,
    deferred_plan_type: restaurantConfig.subscription.deferredPlanType,
    plan_change_date: restaurantConfig.subscription.planChangeDate,
    mandate_active: restaurantConfig.subscription.mandateActive,
    auto_recharge_enabled: restaurantConfig.subscription.autoRechargeEnabled,
    auto_recharge_threshold: restaurantConfig.subscription.autoRechargeThreshold,
    auto_recharge_amount: restaurantConfig.subscription.autoRechargeAmount,
    daily_limit: restaurantConfig.subscription.dailyLimit,
    current_daily_vol: restaurantConfig.subscription.currentDailyVol,
    billing_status: restaurantConfig.subscription.billingStatus,
    onboarding_date: restaurantConfig.subscription.onboardingDate,
    last_auto_recharge_date: restaurantConfig.subscription.lastAutoRechargeDate,
    monthly_minimum: restaurantConfig.subscription.monthly_minimum,
    platform_fee_percent: restaurantConfig.subscription.platform_fee_percent
  } : null

  return (
    <RestaurantContext.Provider 
      value={{ 
        selectedRestaurant, 
        setSelectedRestaurant,
        restaurants,
        isLoading,
        setRestaurantsData,
        restaurantConfig,
        setRestaurantConfig,
        refreshConfig: fetchConfig,
        planType,
        isLux,
        isPro,
        isLite,
        coinsBalance,
        billingStatus,
        isActive,
        features,
        billingInfo,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurant() {
  const context = useContext(RestaurantContext)
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider')
  }
  return context
}

