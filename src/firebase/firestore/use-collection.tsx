
'use client';

import {
  onSnapshot,
  Query,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useCollection<T>(q: Query<T, DocumentData> | null) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!q) {
      setData(null);
      setError(null);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(docs);
        setError(null);
      },
      (err) => {
        setError(err);
        setData(null);
        
        // This is a generic "insufficient permissions" error from Firestore.
        // We will enrich it with the query details for better debugging.
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          // @ts-ignore internal property
          path: q._query.path.segments.join('/'),
          operation: 'list',
        }));
      }
    );

    return unsubscribe;
  }, [q]);

  return { data, error };
}
