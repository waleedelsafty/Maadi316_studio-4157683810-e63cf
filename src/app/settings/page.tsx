'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page will now just redirect to the default general settings page.
export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/general');
  }, [router]);

  // Return null or a loading spinner while redirecting
  return null;
}