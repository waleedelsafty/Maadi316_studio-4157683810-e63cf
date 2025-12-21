
'use client';

import {
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  Query,
  DocumentData,
} from 'firebase/firestore';

import { useEffect, useState } from 'react';

export function useCollection<T>(q: Query<T, DocumentData> | null) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);

  useEffect(() => {
    if (!q) return;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        ...(doc.data() as T),
        id: doc.id,
      }));
      setData(docs);
    });

    return unsubscribe;
  }, [q]);

  return { data };
}
