/**
 * FeatureGate Component
 * 
 * Conditionally renders children based on feature access
 */

import React from 'react';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { FeatureKey } from '../../utils/featureGate';
import { LockedFeature } from './LockedFeature';

interface FeatureGateProps {
  feature: FeatureKey;
  restaurantId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedUI?: boolean;
}

export function FeatureGate({
  feature,
  restaurantId,
  children,
  fallback,
  showLockedUI = true,
}: FeatureGateProps) {
  const { access, loading } = useFeatureGate(feature, restaurantId);

  if (loading) {
    return null;
  }

  if (!access) {
    return null;
  }

  if (!access.hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showLockedUI) {
      return <LockedFeature feature={feature} requiredPlan={access.requiredPlans} />;
    }
    
    return null;
  }

  return <>{children}</>;
}
