/**
 * Phone Login Page - DEPRECATED
 * 
 * Phone authentication has been integrated into the main login page.
 * This page now redirects to /login where users can access all authentication methods:
 * - Email + Password
 * - Email + OTP  
 * - Phone + Password
 * - Phone + OTP
 * - Google OAuth
 * - Facebook OAuth
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/constants';

export default function PhoneLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified login page
    router.replace(ROUTES.LOGIN);
  }, [router]);

  return (
 <></>
  );
}