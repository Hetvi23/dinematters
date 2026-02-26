import { useMemo } from 'react'
import { useFrappeGetDoc } from '@/lib/frappe'
import { useRestaurant } from '@/contexts/RestaurantContext'

const FALLBACK_SYMBOLS: Record<string, string> = {
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

/**
 * Hook to get currency symbol for the selected restaurant.
 * Uses restaurantConfig from get_restaurant_config API as primary source (avoids SWR cache).
 * Fallback to direct DocType fetch when config not yet loaded.
 */
export function useCurrency() {
  const { selectedRestaurant, restaurantConfig } = useRestaurant()
  const pricing = restaurantConfig?.pricing

  // Fallback: fetch Restaurant Config and Restaurant when pricing not from context
  const { data: configData } = useFrappeGetDoc('Restaurant Config', selectedRestaurant || '', {
    enabled: !!selectedRestaurant && !pricing?.currency,
    fields: ['currency']
  })
  const { data: restaurantData } = useFrappeGetDoc('Restaurant', selectedRestaurant || '', {
    enabled: !!selectedRestaurant && !pricing?.currency && !configData?.currency,
    fields: ['currency']
  })

  const currencyCode = pricing?.currency || configData?.currency || restaurantData?.currency || 'USD'

  // Fetch Currency doctype only when not using pricing from context
  const { data: currencyDoc } = useFrappeGetDoc('Currency', currencyCode, {
    enabled: !!currencyCode && !pricing?.symbol
  })

  const currencySymbol = useMemo(() => {
    if (pricing?.symbol) return pricing.symbol
    if (currencyDoc?.symbol) return currencyDoc.symbol
    return FALLBACK_SYMBOLS[currencyCode] || currencyCode
  }, [pricing?.symbol, currencyDoc?.symbol, currencyCode])

  const symbolOnRight = pricing?.symbolOnRight ?? currencyDoc?.symbol_on_right ?? false
  
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

