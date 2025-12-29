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
        setRestaurantsData
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

