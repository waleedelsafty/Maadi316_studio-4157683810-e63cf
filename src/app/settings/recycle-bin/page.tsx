
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import React, { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

function PermanentDeleteDialog({ onConfirm, buildingName }: { onConfirm: () => void, buildingName: string }) {
    const [inputValue, setInputValue] = useState("");
    const expectedText = "yes delete";
    const isMatch = inputValue === expectedText;

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely, positively sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is **final and cannot be undone**. This will permanently delete the building "{buildingName}" and all of its associated levels and units.
                    <br/><br/>
                    To confirm, please type **{expectedText}** in the box below.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={expectedText}
            />
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} disabled={!isMatch}>
                    Permanently Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}


function DeletedBuildingRow({ building }: { building: Building }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const buildingName = (building as any)?.Building_name || (building as any)?.name;
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleRestore = async () => {
        if (!firestore) return;
        const buildingRef = doc(firestore, 'buildings', building.id);
        try {
            await updateDoc(buildingRef, { isDeleted: false });
            toast({ title: "Building Restored", description: `"${buildingName}" has been restored.` });
        } catch (error) {
            console.error("Error restoring building:", error);
            toast({ variant: 'destructive', title: "Restore Failed", description: "Could not restore the building." });
        }
    };

    const handlePermanentDelete = async () => {
        if (!firestore) return;

        try {
            const batch = writeBatch(firestore);
            
            // 1. Get and delete all units
            const unitsRef = collection(firestore, 'buildings', building.id, 'units');
            const unitsSnapshot = await getDocs(unitsRef);
            unitsSnapshot.forEach(unitDoc => batch.delete(unitDoc.ref));

            // 2. Get and delete all levels
            const levelsRef = collection(firestore, 'buildings', building.id, 'levels');
            const levelsSnapshot = await getDocs(levelsRef);
            levelsSnapshot.forEach(levelDoc => batch.delete(levelDoc.ref));

            // 3. Delete the building itself
            const buildingRef = doc(firestore, 'buildings', building.id);
            batch.delete(buildingRef);

            // 4. Commit the batch
            await batch.commit();

            toast({ title: "Building Permanently Deleted", description: `"${buildingName}" has been erased forever.` });
        } catch (error) {
             console.error("Error permanently deleting building:", error);
             toast({ variant: 'destructive', title: "Delete Failed", description: "Could not permanently delete the building." });
        }
        setIsDeleteDialogOpen(false);
    };

    return (
        <TableRow>
            <TableCell className="font-medium">{buildingName}</TableCell>
            <TableCell>{building.address}</TableCell>
            <TableCell className="text-right">
                 <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={handleRestore}>Restore</Button>
                     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">Delete Permanently</Button>
                        </AlertDialogTrigger>
                        <PermanentDeleteDialog onConfirm={handlePermanentDelete} buildingName={buildingName} />
                     </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    );
}


export default function RecycleBinPage() {
  const user = useUser();
  const firestore = useFirestore();

  const deletedBuildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'buildings'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: allBuildings } = useCollection(deletedBuildingsQuery);

  const buildings = useMemo(() => {
    return allBuildings?.filter(b => b.isDeleted);
  }, [allBuildings]);

  if (!user) {
    return null; // Or a loading spinner
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Recycle Bin</h2>
          <p className="text-muted-foreground">Restore or permanently delete your buildings.</p>
        </div>
      </div>
      
      <div className="border rounded-lg">
        {buildings === null && (
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                         <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
             </Table>
        )}
        {buildings && buildings.length > 0 ? (
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {buildings.map((building) => (
                    <DeletedBuildingRow key={building.id} building={building} />
                ))}
            </TableBody>
          </Table>
        ) : buildings && buildings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground">
              The recycle bin is empty.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
