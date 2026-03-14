'use client';

import { useState, useEffect } from 'react';
import { SubscriptionManagement } from '@/components/features/subscription/SubscriptionManagement';

export default function SubscriptionPage() {
  const [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => {
    // Get provider ID from auth state or user profile
    // For now, you'll need to implement this based on your auth system
    const getProviderId = async () => {
      try {
        // Example: Get from localStorage or API call
        const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        const userId = authState?.state?.user?.id;
        
        if (userId) {
          // Fetch provider profile to get provider ID
          // This is a placeholder - implement based on your user service
          setProviderId(userId);
        }
      } catch (error) {
        console.error('Failed to get provider ID:', error);
      }
    };

    getProviderId();
  }, []);

  if (!providerId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>
      
      <SubscriptionManagement providerId={providerId} />
    </div>
  );
}
