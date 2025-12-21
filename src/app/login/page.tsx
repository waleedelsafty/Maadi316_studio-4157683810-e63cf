'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  // This effect will run when the user state changes.
  // The redirect is now primarily handled by the AuthProvider,
  // but this is a good secondary check.
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);


  // If the user object is loading, we can show a blank screen to prevent flicker
  if (user === undefined) {
    return null;
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-8 border rounded-lg shadow-md max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <p className="mb-6 text-muted-foreground">
          Sign in to create and manage your notes.
        </p>
        <Button onClick={signInWithGoogle} className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
