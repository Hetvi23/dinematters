/**
 * LockedFeature Component
 * 
 * Displays upgrade prompt for locked features
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { FeatureKey } from '../../utils/featureGate';

interface LockedFeatureProps {
  feature: FeatureKey;
  requiredPlan: string[];
}

const FEATURE_LABELS: Record<string, string> = {
  ordering: 'Online Ordering',
  video_upload: 'Video Upload',
  analytics: 'Analytics Dashboard',
  ai_recommendations: 'AI Recommendations',
  loyalty: 'Loyalty Programs',
  coupons: 'Coupons & Discounts',
  pos_integration: 'POS Integration',
  data_export: 'Data Export',
  games: 'Games & Engagement',
  table_booking: 'Table Booking',
  custom_branding: 'Custom Branding',
};

export function LockedFeature({ feature, requiredPlan }: LockedFeatureProps) {
  const featureLabel = FEATURE_LABELS[feature] || feature;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
        <Lock className="w-8 h-8 text-orange-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {featureLabel} is Locked
      </h3>
      <p className="text-sm text-gray-600 text-center mb-4">
        This feature requires a {requiredPlan.join(' or ')} subscription plan.
      </p>
      <button
        onClick={() => {
          window.location.href = '/upgrade';
        }}
        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
      >
        Upgrade to PRO
      </button>
    </div>
  );
}
