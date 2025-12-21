'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase/hooks';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const auth = useAuth();
  
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // The redirect is handled by the AuthRedirect component in the provider
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
        <Button onClick={handleSignIn} className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
