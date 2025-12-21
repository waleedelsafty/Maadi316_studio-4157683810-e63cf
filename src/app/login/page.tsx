'use client';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  User,
} from 'firebase/auth';
import { app } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useEffect } from 'react';

export default function LoginPage() {
  const auth = getAuth(app);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Use signInWithRedirect instead of signInWithPopup
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

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
