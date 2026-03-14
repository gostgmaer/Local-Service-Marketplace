import { NotificationPreferences } from '@/components/features/notifications/NotificationPreferences';

export default function NotificationSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Notification Settings</h1>
      
      <NotificationPreferences />
    </div>
  );
}
