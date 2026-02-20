import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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

  // Load restaurants (this will be set by Layout component)
  const setRestaurantsData = (data: Restaurant[]) => {
    setRestaurants(data)
    setIsLoading(false)
    
    // Check current state and localStorage to determine if we need to set a default
    setSelectedRestaurantState(current => {
      if (!current && data.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved && data.find(r => r.name === saved || r.restaurant_id === saved)) {
          return saved
        } else {
          const firstRestaurant = data[0]
          localStorage.setItem(STORAGE_KEY, firstRestaurant.name)
          return firstRestaurant.name
        }
      }
      return current
    })
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

  // Fetch restaurant config (branding, features) when selectedRestaurant changes
  useEffect(() => {
    const fetchConfig = async () => {
      if (!selectedRestaurant) {
        setRestaurantConfig(null)
        return
      }
      try {
        const resp = await fetch(`/api/method/dinematters.dinematters.api.config.get_restaurant_config?restaurant_id=${encodeURIComponent(selectedRestaurant)}`)
        const json = await resp.json()
        // Frappe wraps returned value in message sometimes; handle both shapes
        const payload = json?.message ?? json
        if (payload?.success) {
          setRestaurantConfig(payload.data || null)
        } else if (payload?.data) {
          setRestaurantConfig(payload.data)
        } else {
          setRestaurantConfig(null)
        }
      } catch (e) {
        console.error('Failed to fetch restaurant config:', e)
        setRestaurantConfig(null)
      }
    }

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

  return (
    <RestaurantContext.Provider 
      value={{ 
        selectedRestaurant, 
        setSelectedRestaurant,
        restaurants,
        isLoading,
        setRestaurantsData,
        restaurantConfig,
        setRestaurantConfig
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

