
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/global/unit-types');
  }, [router]);

  return null;
}
