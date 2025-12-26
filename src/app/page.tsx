
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { BuildingInfoCard } from '@/components/building-info-card';
import type { Building } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'buildings'), where('ownerId', '==', user.uid));
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);

  if (!user || !firestore) {
    return null; // Or a loading spinner
  }

  return (
    <main className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold">Building Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {buildings === null && (
          // Loading state
          <>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
        
        {buildings && buildings.length > 0 ? (
            buildings.map(building => (
                <BuildingInfoCard key={building.id} building={building as Building} />
            ))
        ) : (
          buildings !== null && (
            <div className="text-center py-12 rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                    You haven't added any buildings yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                    Add a building in the Settings page to get started.
                </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
