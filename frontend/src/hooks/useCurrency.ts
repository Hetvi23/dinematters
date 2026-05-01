import { useMemo } from 'react'
import { useFrappeGetDoc, useFrappeGetCall } from '@/lib/frappe'
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

  const currencyCode = pricing?.currency || configData?.currency || restaurantData?.currency || 'INR'

  // Fetch Currency info via whitelisted method to bypass DocType permissions
  const { data: currencyResponse } = useFrappeGetCall('dinematters.dinematters.api.config.get_currency_info', {
    currency_code: currencyCode
  }, `currency-${currencyCode}`, {
    revalidateOnFocus: false,
    enabled: !!currencyCode && !pricing?.symbol
  })
  const currencyInfo = currencyResponse?.message?.data

  const currencySymbol = useMemo(() => {
    if (pricing?.symbol) return pricing.symbol
    if (currencyInfo?.symbol) return currencyInfo.symbol
    return FALLBACK_SYMBOLS[currencyCode] || currencyCode
  }, [pricing?.symbol, currencyInfo?.symbol, currencyCode])

  const symbolOnRight = pricing?.symbolOnRight ?? currencyInfo?.symbolOnRight ?? false
  
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

