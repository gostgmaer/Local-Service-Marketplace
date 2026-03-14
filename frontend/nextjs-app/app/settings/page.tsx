'use client';

import { Tabs } from '@/components/ui';
import { NotificationPreferences } from '@/components/features/notifications/NotificationPreferences';
import { PaymentMethods } from '@/components/features/payment/PaymentMethods';
import { SubscriptionManagement } from '@/components/features/subscription/SubscriptionManagement';
import { Bell, CreditCard, Crown } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => {
    // Get provider ID from auth state
    const getProviderId = async () => {
      try {
        const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        const userId = authState?.state?.user?.id;
        if (userId) {
          setProviderId(userId);
        }
      } catch (error) {
        console.error('Failed to get provider ID:', error);
      }
    };

    getProviderId();
  }, []);

  const tabs = [
    {
      id: 'notifications',
      label: 'Notifications',
      content: (
        <div className="max-w-4xl">
          <NotificationPreferences />
        </div>
      )
    },
    {
      id: 'payments',
      label: 'Payment Methods',
      content: (
        <div className="max-w-4xl">
          <PaymentMethods />
        </div>
      )
    },
    {
      id: 'subscription',
      label: 'Subscription',
      content: (
        <div className="max-w-4xl">
          {providerId ? (
            <SubscriptionManagement providerId={providerId} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading...</p>
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <Tabs tabs={tabs} defaultTab="notifications" />
    </div>
  );
}
