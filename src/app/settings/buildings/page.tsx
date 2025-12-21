
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { BuildingFormSheet } from '@/components/building-form-sheet';
import type { Building } from '@/types';
import Link from 'next/link';

export default function BuildingsSettingsPage() {
  const user = useUser();
  const firestore = useFirestore();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'buildings'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);

  if (!user) {
    return null; // Or a loading spinner
  }

  const handleOpenSheet = () => {
    setIsSheetOpen(true);
  }

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Buildings</h2>
          <p className="text-muted-foreground">Manage your building portfolio.</p>
        </div>
        <Button onClick={handleOpenSheet}>Add Building</Button>
      </div>
      
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
              You haven't added any buildings yet. Click "Add Building" to start.
            </p>
          </div>
        )}
      </div>

      <BuildingFormSheet
          building={null} // Always for adding new building now
          isOpen={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
      />
    </div>
  );
}
