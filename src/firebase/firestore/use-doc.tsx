
'use client';

import {
  onSnapshot,
  doc,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';

import { useEffect, useState } from 'react';

export function useDoc<T>(ref: DocumentReference<T, DocumentData> | null) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);

  useEffect(() => {
    if (!ref) return;

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setData({
          ...(snapshot.data() as T),
          id: snapshot.id,
        });
      } else {
        setData(null);
      }
    });

    return unsubscribe;
  }, [ref]);

  return { data };
}
