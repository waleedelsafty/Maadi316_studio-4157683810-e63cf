
'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider } from './auth/provider';
import { FirestoreProvider } from './firestore/provider';
import { useUser } from './auth/use-user';

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

        if (user === null && !isAuthPage) {
            router.push('/login');
        } else if (user && isAuthPage) {
            router.push('/');
        }
    }, [user, pathname, router, isMounted]);

    // Prevent flash of unauthenticated content, but allow login page to render
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
