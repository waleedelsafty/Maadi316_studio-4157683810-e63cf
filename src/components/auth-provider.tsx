'use client';

import { getAuth, onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { app } from '@/lib/firebase/config';
import { usePathname, useRouter } from 'next/navigation';

export const AuthContext = createContext<{ 
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}>({
  user: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && pathname === '/login') {
        router.push('/');
      } else if (!user && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [auth, pathname, router]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the redirect
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will handle the redirect
    } catch (error) {
      console.error('Error signing out', error);
    }
  }

  const value = useMemo(() => ({ 
    user,
    signInWithGoogle,
    signOut: handleSignOut
  }), [user, auth]);

  // Render children only when auth state is determined to avoid flash of content
  if (user === null && pathname !== '/login') {
    return null; // or a loading spinner
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
