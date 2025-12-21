'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth, connectAuthEmulator } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth as useFirebaseAuth } from './auth/provider';
import { FirestoreProvider } from './firestore/provider';
import { useUser } from './auth/use-user';
import { Toaster } from '@/components/ui/toaster';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(
  undefined
);

export function FirebaseProvider(props: React.PropsWithChildren<FirebaseContextValue>) {
  const { firebaseApp, auth, firestore, children } = props;

  const value = useMemo(
    () => ({
      firebaseApp,
      auth,
      firestore,
    }),
    [firebaseApp, auth, firestore]
  );

  return (
    <FirebaseContext.Provider value={value}>
        <AuthProvider auth={auth}>
          <FirestoreProvider firestore={firestore}>
            <AuthRedirect>
              {children}
            </AuthRedirect>
            <Toaster />
          </FirestoreProvider>
        </AuthProvider>
    </FirebaseContext.Provider>
  );
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
    const user = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const isAuthPage = pathname === '/login';

        if (user && isAuthPage) {
            router.push('/');
        } else if (!user && !isAuthPage) {
            router.push('/login');
        }
    }, [user, pathname, router, isMounted]);

    // Prevent flash of unauthenticated content
    if (!isMounted || (user === undefined && pathname !== '/login') ) {
        return null; // Or a loading spinner
    }

    return <>{children}</>;
}


export function useFirebase() {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }

  return context;
}
