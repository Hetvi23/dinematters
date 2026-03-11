/**
 * useFeatureGate Hook
 * 
 * React hook for checking feature access based on subscription plan
 */

import { useState, useEffect } from 'react';
import { checkFeatureAccess, FeatureAccess, FeatureKey } from '../utils/featureGate';

export function useFeatureGate(feature: FeatureKey, restaurantId?: string) {
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchAccess() {
      if (!restaurantId) return;
      
      try {
        setLoading(true);
        const result = await checkFeatureAccess(restaurantId, feature);
        if (mounted) {
          setAccess(result);
        }
      } catch (error) {
        console.error('Error in useFeatureGate:', error);
        if (mounted) {
          setAccess({
            hasAccess: false,
            currentPlan: 'LITE',
            requiredPlans: ['PRO'],
            feature,
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchAccess();

    return () => {
      mounted = false;
    };
  }, [feature, restaurantId]);

  return { access, loading };
}

export function usePlanType(restaurantId?: string) {
  const [planType, setPlanType] = useState<'LITE' | 'PRO' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchPlan() {
      try {
        setLoading(true);
        const response = await fetch('/api/method/dinematters.api.subscription.get_restaurant_plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': (window as any).csrf_token || '',
          },
          body: JSON.stringify({ restaurant_id: restaurantId }),
        });

        if (!response.ok) throw new Error('Failed to fetch plan');

        const data = await response.json();
        if (mounted) {
          setPlanType(data.message?.plan_type || 'LITE');
        }
      } catch (error) {
        console.error('Error fetching plan type:', error);
        if (mounted) {
          setPlanType('LITE');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchPlan();

    return () => {
      mounted = false;
    };
  }, [restaurantId]);

  return { planType, isPro: planType === 'PRO', isLite: planType === 'LITE', loading };
}
