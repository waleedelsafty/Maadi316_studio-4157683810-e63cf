'use client';

import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import React, { useMemo } from 'react';

import { FirebaseProvider } from '@/firebase/provider';

export function FirebaseClientProvider({
  children,
  firebaseApp,
}: React.PropsWithChildren<{ firebaseApp: FirebaseApp }>) {
  const auth = useMemo(() => getAuth(firebaseApp), [firebaseApp]);
  const firestore = useMemo(() => getFirestore(firebaseApp), [firebaseApp]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
