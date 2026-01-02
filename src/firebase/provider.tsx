
'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  user: User | null | undefined;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(
  undefined
);

export function FirebaseProvider(props: React.PropsWithChildren<Omit<FirebaseContextValue, 'user'>>) {
  const { firebaseApp, auth, firestore, children } = props;
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (userState) => {
      setUser(userState);
    });
    return () => unsubscribe();
  }, [auth]);

  const value = useMemo(
    () => ({
      firebaseApp,
      auth,
      firestore,
      user,
    }),
    [firebaseApp, auth, firestore, user]
  );

  return (
    <FirebaseContext.Provider value={value}>
        <AuthRedirect>
          <FirebaseErrorListener />
          {children}
        </AuthRedirect>
    </FirebaseContext.Provider>
  );
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
    const { user } = useFirebase();
    const router = useRouter();
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || user === undefined) return;

        const isAuthPage = pathname === '/login';
        
        if (user === null) { // Not logged in
            if (!isAuthPage) {
                router.push('/login');
            }
        } else { // Logged in
            if (isAuthPage) {
                router.push('/');
            }
        }
    }, [user, pathname, router, isMounted]);

    if (user === undefined && pathname !== '/login') {
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
