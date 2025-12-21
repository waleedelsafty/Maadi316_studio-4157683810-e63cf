
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import React, { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { BuildingFormSheet } from '@/components/building-form-sheet';
import type { Building, Level } from '@/types';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';

function BuildingRow({ building }: { building: Building }) {
    const firestore = useFirestore();

    const levelsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'buildings', building.id, 'levels'));
    }, [firestore, building.id]);

    const { data: levels, error } = useCollection(levelsQuery);

    const levelInfo = useMemo(() => {
        if (!levels) return { hasGround: false, hasPenthouse: false, hasRooftop: false, typicalFloorCount: 0 };
        
        const hasGround = levels.some(l => l.type === 'Ground');
        const hasPenthouse = levels.some(l => l.type === 'Penthouse');
        const hasRooftop = levels.some(l => l.type === 'Rooftop');
        const typicalFloorCount = levels.filter(l => l.type === 'Typical Floor').length;

        return { hasGround, hasPenthouse, hasRooftop, typicalFloorCount };

    }, [levels]);

    if (error) {
        return (
            <TableRow>
                <TableCell colSpan={8} className="text-destructive text-center">
                    Could not load level data for {building.name}.
                </TableCell>
            </TableRow>
        )
    }

    if (!levels) {
         return (
            <TableRow>
                <TableCell className="font-medium">
                    <Skeleton className="h-5 w-32" />
                </TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-9 w-16 ml-auto" /></TableCell>
            </TableRow>
        )
    }

    return (
        <TableRow>
            <TableCell className="font-medium">{building.name}</TableCell>
            <TableCell>{building.address}</TableCell>
            <TableCell className="text-center">
                {building.hasBasement ? building.basementCount : '—'}
            </TableCell>
             <TableCell className="text-center">
                {building.hasMezzanine ? building.mezzanineCount : '—'}
            </TableCell>
            <TableCell className="text-center">
                {levelInfo.hasGround && <CheckIcon className="mx-auto" />}
            </TableCell>
            <TableCell className="text-center">
                {levelInfo.hasPenthouse && <CheckIcon className="mx-auto" />}
            </TableCell>
             <TableCell className="text-center">
                {levelInfo.hasRooftop && <CheckIcon className="mx-auto" />}
            </TableCell>
            <TableCell className="text-right">
                <Button size="sm" asChild>
                    <Link href={`/building/${building.id}`}>Open</Link>
                </Button>
            </TableCell>
        </TableRow>
    );
}


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
      
      <div className="border rounded-lg">
        {buildings && buildings.length > 0 ? (
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-center">Basement</TableHead>
                    <TableHead className="text-center">Mezzanine</TableHead>
                    <TableHead className="text-center">Ground</TableHead>
                    <TableHead className="text-center">Penthouse</TableHead>
                    <TableHead className="text-center">Rooftop</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {buildings.map((building) => (
                    <BuildingRow key={building.id} building={building} />
                ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 px-4">
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
