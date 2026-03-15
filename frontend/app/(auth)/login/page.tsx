'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import toast from 'react-hot-toast';

// Unified login schema - accepts email OR phone
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(6, 'Password or OTP must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Helper to detect if input is email or phone
const detectInputType = (input: string): 'email' | 'phone' | 'unknown' => {
  // Email pattern: contains @ symbol
  if (input.includes('@')) {
    return 'email';
  }
  // Phone pattern: starts with + or contains only digits
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (phoneRegex.test(input)) {
    return 'phone';
  }
  return 'unknown';
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    login, 
    loginWithPhone,
    loginWithEmailOTP,
    loginWithOTP,
    requestEmailOTP,
    requestOTP,
    loginWithGoogle, 
    loginWithFacebook, 
    isAuthenticated 
  } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password'); // Password or OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [detectedType, setDetectedType] = useState<'email' | 'phone' | 'unknown'>('unknown');

  // Unified form - one field for email OR phone
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, isDirty },
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const identifier = watch('identifier');

  // Auto-detect input type as user types
  useEffect(() => {
    if (identifier && identifier.length > 0) {
      const type = detectInputType(identifier);
      setDetectedType(type);
    } else {
      setDetectedType('unknown');
    }
  }, [identifier]);

  // Auto-focus identifier field on mount
  useEffect(() => {
    setFocus('identifier');
  }, [setFocus]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, router]);

  // Show message if redirected from signup
  useEffect(() => {
    const message = searchParams.get('message');
    const error = searchParams.get('error');
    
    if (message === 'signup_success') {
      toast.success('Account created successfully! Please log in.');
    }
    
    // Show error messages from URL (e.g., from NextAuth or error page)
    if (error) {
      const errorMessages: Record<string, string> = {
        'CredentialsSignin': 'Invalid email or password.',
        'SessionRequired': 'Please sign in to continue.',
        'TokenExpired': 'Your session has expired. Please sign in again.',
        'EmailNotVerified': 'Please verify your email before signing in.',
        'Default': 'An authentication error occurred. Please try again.',
      };
      toast.error(errorMessages[error] || errorMessages['Default']);
    }
  }, [searchParams]);

  // OTP timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // Unified submit handler - routes to correct backend based on detected type
  const onSubmit = async (data: LoginFormData) => {
    const type = detectInputType(data.identifier);
    
    // Validate input type is detected
    if (type === 'unknown') {
      toast.error('Please enter a valid email address or phone number');
      setFocus('identifier');
      return;
    }

    setIsLoading(true);

    try {
      if (loginMethod === 'password') {
        // Password authentication
        if (type === 'email') {
          await login(data.identifier, data.password);
        } else {
          await loginWithPhone(data.identifier, data.password);
        }
      } else {
        // OTP authentication
        if (!otpSent) {
          toast.error('Please request OTP first');
          return;
        }
        
        if (type === 'email') {
          await loginWithEmailOTP(data.identifier, data.password);
        } else {
          await loginWithOTP(data.identifier, data.password);
        }
      }
      
      toast.success('Welcome back!');
      router.push(ROUTES.DASHBOARD);
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please try again.');
      setFocus('password');
    } finally {
      setIsLoading(false);
    }
  };

  // Unified OTP request - detects email or phone and calls correct backend
  const handleRequestOTP = async () => {
    if (!identifier) {
      toast.error('Please enter your email or phone number');
      return;
    }

    const type = detectInputType(identifier);
    
    if (type === 'unknown') {
      toast.error('Please enter a valid email address or phone number');
      return;
    }

    setIsLoading(true);

    try {
      if (type === 'email') {
        await requestEmailOTP(identifier);
        toast.success('OTP sent to your email!');
      } else {
        await requestOTP(identifier);
        toast.success('OTP sent to your phone!');
      }
      
      setOtpSent(true);
      setOtpTimer(60);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if submit button should be disabled
  const isSubmitDisabled = isLoading || !isValid || !isDirty || (loginMethod === 'otp' && !otpSent);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    try {
      // Use backend OAuth endpoints
      if (provider === 'google') {
        loginWithGoogle();
      } else {
        loginWithFacebook();
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`Failed to sign in with ${provider}. Please try again.`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link
              href="/signup"
              className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 focus:outline-none focus:underline"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Input Type Indicator (Auto-detected) */}
        {detectedType !== 'unknown' && identifier && (
          <div className="text-center">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {detectedType === 'email' ? '📧 Email detected' : '📱 Phone detected'}
            </span>
          </div>
        )}

        {/* Login Method Toggle (Password/OTP) */}
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setLoginMethod('password');
              setOtpSent(false);
            }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              loginMethod === 'password'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            🔐 Password
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('otp')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              loginMethod === 'otp'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            📲 OTP
          </button>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            {/* Unified Email/Phone Field */}
            <div>
              <Input
                label="Email or Phone Number"
                type="text"
                {...register('identifier')}
                placeholder="email@example.com or +1234567890"
                autoComplete="username"
                autoFocus
                aria-invalid={errors.identifier ? 'true' : 'false'}
                disabled={isLoading}
                className={errors.identifier ? 'border-red-500 focus:ring-red-500' : ''}
              />
              {errors.identifier && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password/OTP Field */}
            {loginMethod === 'password' ? (
              <div>
                <PasswordInput
                  label="Password"
                  {...register('password')}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PasswordInput
                      label="6-Digit OTP"
                      {...register('password')}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="pt-6">
                    <Button
                      type="button"
                      onClick={handleRequestOTP}
                      variant="outline"
                      disabled={isLoading || otpTimer > 0 || detectedType === 'unknown'}
                      className="whitespace-nowrap"
                    >
                      {otpTimer > 0 ? `${otpTimer}s` : otpSent ? 'Resend' : 'Send OTP'}
                    </Button>
                  </div>
                </div>
                {otpSent && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    OTP sent! Check your {detectedType === 'email' ? 'email' : 'phone'}.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Forgot Password Link */}
          {loginMethod === 'password' && (detectedType === 'email' || detectedType === 'unknown') && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 focus:outline-none focus:underline"
                  tabIndex={isLoading ? -1 : 0}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            disabled={isSubmitDisabled}
            aria-label={isLoading ? 'Signing in...' : 'Sign in'}
          >
            {isLoading ? 'Signing in...' : loginMethod === 'otp' ? 'Verify & Sign in' : 'Sign in'}
          </Button>
        </form>

        {/* Social Login Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
            className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Sign in with Google"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => handleSocialLogin('facebook')}
            disabled={isLoading}
            className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Sign in with Facebook"
          >
            <svg className="w-5 h-5 mr-2" fill="#1877F2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
        </div>
      </div>
    </div>
  );
}
