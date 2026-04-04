'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/constants';
import { createProviderProfile } from '@/services/user-service';
import { toast } from 'react-hot-toast';
import { CheckCircle, User, Briefcase, ArrowRight, ArrowLeft } from 'lucide-react';

const STEPS = ['welcome', 'profile', 'complete'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Provider profile fields
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');

  const isProvider = user?.role === 'provider';
  const currentIndex = STEPS.indexOf(step);

  const goNext = () => {
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev);
  };

  const handleProfileSubmit = async () => {
    if (isProvider) {
      if (!businessName.trim() || !description.trim()) {
        toast.error('Please fill in all fields');
        return;
      }
      setIsSubmitting(true);
      try {
        await createProviderProfile({
          business_name: businessName.trim(),
          description: description.trim(),
        });
        toast.success('Provider profile created!');
        goNext();
      } catch {
        toast.error('Failed to create profile. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Customers skip profile creation step
      goNext();
    }
  };

  const handleFinish = () => {
    if (isProvider) {
      router.push(ROUTES.DASHBOARD_PROVIDER_SERVICES || '/dashboard/provider/services');
    } else {
      router.push(ROUTES.DASHBOARD);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i <= currentIndex
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {i < currentIndex ? <CheckCircle className="h-5 w-5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 ${
                      i < currentIndex ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <Card>
              <CardHeader>
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                    {isProvider ? (
                      <Briefcase className="h-8 w-8 text-primary-600" />
                    ) : (
                      <User className="h-8 w-8 text-primary-600" />
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome, {user?.name || 'there'}!
                  </h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {isProvider
                      ? "Let's set up your provider profile so customers can find you."
                      : "Let's get you started finding great local services."}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={goNext}>
                  Get Started <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <button
                  onClick={() => router.push(ROUTES.DASHBOARD)}
                  className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-center"
                >
                  Skip for now
                </button>
              </CardContent>
            </Card>
          )}

          {/* Step: Profile Setup */}
          {step === 'profile' && (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isProvider ? 'Set Up Your Business' : 'Complete Your Profile'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isProvider
                    ? 'Tell customers about your business.'
                    : 'A complete profile helps providers serve you better.'}
                </p>
              </CardHeader>
              <CardContent>
                {isProvider ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Joe's Plumbing"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        placeholder="Describe the services you offer..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      You&apos;re all set! You can update your profile anytime from the settings page.
                    </p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={goBack} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handleProfileSubmit}
                    isLoading={isSubmitting}
                    className="flex-1"
                  >
                    {isProvider ? 'Create Profile' : 'Continue'} <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <Card>
              <CardHeader>
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    You&apos;re All Set!
                  </h2>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {isProvider
                      ? 'Your profile is ready. Next, add the services you offer.'
                      : 'Your account is ready. Browse available services or create a request.'}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handleFinish}>
                  {isProvider ? 'Add Services' : 'Go to Dashboard'} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
