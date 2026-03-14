'use client';

import { useRouter } from 'next/navigation';
import { PricingPlans } from '@/components/features/subscription/PricingPlans';

export default function PricingPage() {
  const router = useRouter();

  const handleSelectPlan = (planId: string) => {
    // Redirect to subscription creation/checkout page
    router.push(`/checkout?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <PricingPlans onSelectPlan={handleSelectPlan} />
      </div>
    </div>
  );
}
