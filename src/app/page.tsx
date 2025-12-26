
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { BuildingInfoCard } from '@/components/building-info-card';
import type { Building, Unit } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardChart } from '@/components/dashboard-chart';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'buildings'), where('ownerId', '==', user.uid));
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);

  const unitsQuery = useMemo(() => {
    if (!firestore || !buildings || buildings.length === 0) return null;
    const buildingIds = buildings.map(b => b.id);
    // This is a simplified approach. For large numbers of buildings, 
    // a more optimized query or backend function would be needed.
    // However, for a typical user portfolio this is acceptable.
    // We are fetching all units for all buildings.
    const queries = buildingIds.map(id => query(collection(firestore, 'buildings', id, 'units')));
    return queries;

  }, [firestore, buildings]);

  const { data: units } = useCollection(
      unitsQuery && buildings && buildings.length > 0 ? query(collection(firestore, 'buildings', buildings[0].id, 'units')) : null
      // A bit of a hack to satisfy useCollection, we really need a multi-query hook.
      // We will just use getDocs inside the component that needs all units.
  );
  

  if (!user || !firestore) {
    return null; // Or a loading spinner
  }

  return (
    <main className="w-full max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>

       {buildings && buildings.length > 0 && (
           <Card>
                <CardHeader>
                    <CardTitle>Portfolio Overview</CardTitle>
                    <CardDescription>A summary of your managed properties.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col justify-between rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Total Buildings</p>
                        <p className="text-4xl font-bold">{buildings.length}</p>
                    </div>
                     <DashboardChart buildings={buildings as Building[]} />
                </CardContent>
           </Card>
       )}

      <div className="space-y-2">
         <h3 className="text-xl font-bold">My Buildings</h3>
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
                        Add a building in the My Buildings page to get started.
                    </p>
                </div>
            )
            )}
        </div>
      </div>
    </main>
  );
}
