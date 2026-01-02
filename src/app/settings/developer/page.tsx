
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/developer/display');
  }, [router]);

  return null;
}
