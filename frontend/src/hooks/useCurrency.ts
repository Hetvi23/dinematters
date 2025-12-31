import { useMemo } from 'react'
import { useFrappeGetDoc } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'

/**
 * Hook to get currency symbol for the selected restaurant
 * Fetches currency from Restaurant Config and then gets symbol from Currency doctype
 */
export function useCurrency() {
  const { selectedRestaurant } = useRestaurant()
  
  // Fetch Restaurant Config to get currency
  const { data: configData } = useFrappeGetDoc('Restaurant Config', selectedRestaurant || '', {
    enabled: !!selectedRestaurant,
    fields: ['currency']
  })
  
  // If config doesn't exist, try fetching from Restaurant doctype
  const { data: restaurantData } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant && !configData?.currency,
    fields: ['currency']
  })
  
  const currencyCode = configData?.currency || restaurantData?.currency || 'USD'
  
  // Fetch Currency doctype to get symbol
  const { data: currencyDoc } = useFrappeGetDoc('Currency', currencyCode, {
    enabled: !!currencyCode
  })
  
  const currencySymbol = useMemo(() => {
    if (currencyDoc?.symbol) {
      return currencyDoc.symbol
    }
    // Fallback to common currency symbols
    const fallbackSymbols: Record<string, string> = {
      'USD': '$',
      'INR': '₹',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'AUD': 'A$',
      'CAD': 'C$',
      'CHF': 'CHF',
      'CNY': '¥',
      'SGD': 'S$',
    }
    return fallbackSymbols[currencyCode] || currencyCode
  }, [currencyDoc?.symbol, currencyCode])
  
  const symbolOnRight = currencyDoc?.symbol_on_right || false
  
  return {
    currency: currencyCode,
    symbol: currencySymbol,
    symbolOnRight,
    formatAmount: (amount: number | string | null | undefined): string => {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
      if (symbolOnRight) {
        return `${numAmount.toFixed(2)} ${currencySymbol}`
      }
      return `${currencySymbol}${numAmount.toFixed(2)}`
    },
    formatAmountNoDecimals: (amount: number | string | null | undefined): string => {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
      if (symbolOnRight) {
        return `${numAmount.toFixed(0)} ${currencySymbol}`
      }
      return `${currencySymbol}${numAmount.toFixed(0)}`
    }
  }
}

