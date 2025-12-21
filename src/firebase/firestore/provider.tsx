
'use client';

import { createContext, useContext } from 'react';
import { Firestore } from 'firebase/firestore';

const FirestoreContext = createContext<Firestore | undefined>(undefined);

export function FirestoreProvider(
  props: React.PropsWithChildren<{ firestore: Firestore }>,
) {
  return (
    <FirestoreContext.Provider value={props.firestore}>
      {props.children}
    </FirestoreContext.Provider>
  );
}

export function useFirestore() {
  return useContext(FirestoreContext);
}
