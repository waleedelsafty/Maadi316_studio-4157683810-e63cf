
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import React, { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { BuildingFormSheet } from '@/components/building-form-sheet';
import type { Building, Level } from '@/types';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportBuildingButton } from '@/components/import-building-button';
import { Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


function SoftDeleteDialog({ onConfirm, buildingName }: { onConfirm: () => void, buildingName: string }) {
    const [inputValue, setInputValue] = useState("");
    const isMatch = inputValue === "delete";

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will move the building "{buildingName}" to the recycle bin. It will not be visible in the main app but can be restored later.
                    <br/><br/>
                    To confirm, please type **delete** in the box below.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder='delete'
            />
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} disabled={!isMatch}>
                    Delete Building
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}

function BuildingRow({ building }: { building: Building }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const buildingName = (building as any)?.Building_name || (building as any)?.name;


    const levelsQuery = useMemo(() => {
        if (!firestore || !building.id) return null; 
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

    const handleSoftDelete = async () => {
        if (!firestore || !building.id) return;
        const buildingRef = doc(firestore, 'buildings', building.id);
        await updateDoc(buildingRef, { isDeleted: true });
        toast({
            title: "Building Deleted",
            description: `"${buildingName}" has been moved to the recycle bin.`
        });
    };

    if (error) {
        return (
            <TableRow>
                <TableCell colSpan={9} className="text-destructive text-center">
                    Could not load level data for {buildingName}.
                </TableCell>
            </TableRow>
        )
    }

    if (!building.id || !levels) {
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
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
            </TableRow>
        )
    }

    return (
        <TableRow>
            <TableCell className="font-medium">{buildingName}</TableCell>
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
                {levelInfo.typicalFloorCount > 0 ? levelInfo.typicalFloorCount : '—'}
            </TableCell>
            <TableCell className="text-center">
                {levelInfo.hasPenthouse && <CheckIcon className="mx-auto" />}
            </TableCell>
             <TableCell className="text-center">
                {levelInfo.hasRooftop && <CheckIcon className="mx-auto" />}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/building/${building.id}`}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit Building</span>
                        </Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Building</span>
                            </Button>
                        </AlertDialogTrigger>
                        <SoftDeleteDialog onConfirm={handleSoftDelete} buildingName={buildingName} />
                    </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    );
}


export default function BuildingsPage() {
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

  const { data: allBuildings } = useCollection(buildingsQuery);

  const buildings = useMemo(() => {
    return allBuildings?.filter(b => !b.isDeleted);
  }, [allBuildings]);

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Buildings</h2>
          <p className="text-muted-foreground">Manage your building portfolio.</p>
        </div>
        <div className="flex gap-2">
            <ImportBuildingButton existingBuildings={buildings || []} />
            <Button onClick={handleOpenSheet}>Add Building</Button>
        </div>
      </div>
      
      <div className="border rounded-lg">
        {buildings === null && (
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="text-center">Basement</TableHead>
                        <TableHead className="text-center">Mezzanine</TableHead>
                        <TableHead className="text-center">Ground</TableHead>
                        <TableHead className="text-center">Typical Floors</TableHead>
                        <TableHead className="text-center">Penthouse</TableHead>
                        <TableHead className="text-center">Rooftop</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => <BuildingRow key={i} building={{} as Building} />)}
                </TableBody>
             </Table>
        )}
        {buildings && buildings.length > 0 ? (
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-center">Basement</TableHead>
                    <TableHead className="text-center">Mezzanine</TableHead>
                    <TableHead className="text-center">Ground</TableHead>
                    <TableHead className="text-center">Typical Floors</TableHead>
                    <TableHead className="text-center">Penthouse</TableHead>
                    <TableHead className="text-right">Rooftop</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {buildings.map((building) => (
                    <BuildingRow key={building.id} building={building} />
                ))}
            </TableBody>
          </Table>
        ) : buildings && buildings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground">
              You haven't added any buildings yet. Click "Add Building" or "Import Building" to start.
            </p>
          </div>
        ) : null}
      </div>

      <BuildingFormSheet
          building={null}
          isOpen={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
      />
    </div>
  );
}
