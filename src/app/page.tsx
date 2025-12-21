
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import {
  collection,
  query,
  where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'buildings'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);


  if (!user || !firestore) {
    // AuthProvider handles the redirect, so we can just show a loader or null
    return null;
  }

  return (
    <main className="w-full max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Buildings</h2>
          <div className="space-y-4">
            {buildings && buildings.length > 0 ? (
              buildings.map((building) => (
                <Card key={building.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{building.name}</h3>
                      <p className="text-muted-foreground text-sm">{building.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/building/${building.id}`}>Open</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  You haven't added any buildings yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                    Add a building in the Settings page.
                </p>
              </div>
            )}
          </div>
        </div>
    </main>
  );
}
