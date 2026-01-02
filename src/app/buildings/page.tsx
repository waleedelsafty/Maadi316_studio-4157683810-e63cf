
'use client';

import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import React, { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, UserProfile } from '@/types';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportBuildingButton } from '@/components/import-building-button';
import { Edit, Trash2, CheckCircle2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


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

function BuildingRow({ building, isDefault, onSetDefault }: { building: Building, isDefault: boolean, onSetDefault: (id: string) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const buildingName = building.name;


    const levelsQuery = useMemo(() => {
        if (!firestore || !building.id) return null; 
        return query(collection(firestore, 'buildings', building.id, 'levels'));
    }, [firestore, building.id]);

    const { data: levels, error } = useCollection<Level>(levelsQuery);

    const levelInfo = useMemo(() => {
        if (!levels) return { hasGround: false, hasPenthouse: false, hasRooftop: false, typicalFloorCount: 0 };
        
        const hasGround = levels.some(l => l.levelType === 'Ground');
        const hasPenthouse = levels.some(l => l.levelType === 'Penthouse');
        const hasRooftop = levels.some(l => l.levelType === 'Rooftop');
        const typicalFloorCount = levels.filter(l => l.levelType === 'Typical Floor').length;

        return { hasGround, hasPenthouse, hasRooftop, typicalFloorCount };

    }, [levels]);

    const handleSoftDelete = async () => {
        if (!firestore || !building.id) return;
        const buildingRef = doc(firestore, 'buildings', building.id);
        
        setDoc(buildingRef, { isDeleted: true }, { merge: true }).then(() => {
            toast({
                title: "Building Deleted",
                description: `"${buildingName}" has been moved to the recycle bin.`
            });
        }).catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: buildingRef.path, operation: 'update', requestResourceData: { isDeleted: true },
            }));
        })
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

    if (!levels) {
         return (
            <TableRow>
                <TableCell className="font-medium">
                     <p>{buildingName}</p>
                </TableCell>
                <TableCell><p>{building.address}</p></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
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
                {isDefault ? <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" /> : null}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    {!isDefault && <Button variant="outline" size="sm" onClick={() => onSetDefault(building.id)}>Set as Default</Button>}
                     <Button variant="outline" size="sm" asChild>
                        <Link href={`/building/${building.id}`}>
                            View Details
                        </Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
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

function LoadingRow() {
    return (
        <TableRow>
            <TableCell className="font-medium"><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
        </TableRow>
    );
}


export default function BuildingsPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

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
  
  const handleSetDefault = async (buildingId: string) => {
    if (!userProfileRef) return;
    const data = { defaultBuildingId: buildingId };
    
    setDoc(userProfileRef, data, { merge: true }).then(() => {
        toast({
            title: "Default Building Set",
            description: "This is now your active building."
        });
    }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userProfileRef.path, operation: 'update', requestResourceData: data,
        }));
    });
  }


  if (!user || userProfile === undefined) {
    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                 <Skeleton className="h-10 w-64" />
                 <Skeleton className="h-10 w-48" />
             </div>
             <div className="border rounded-lg">
                <Table><TableHeader><TableRow><TableHead>Name</TableHead></TableRow></TableHeader><TableBody><LoadingRow /><LoadingRow /></TableBody></Table>
             </div>
        </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Buildings</h2>
          <p className="text-muted-foreground">
            {userProfile?.defaultBuildingId ? "Manage your building portfolio or set a new default." : "Select a building to set as your default to begin."}
          </p>
        </div>
        <div className="flex gap-2">
            <ImportBuildingButton existingBuildings={buildings || []} />
            <Button asChild>
              <Link href="/buildings/new">Add Building</Link>
            </Button>
        </div>
      </div>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-center">Basement(s)</TableHead>
                  <TableHead className="text-center">Mezzanine(s)</TableHead>
                  <TableHead className="text-center">Ground</TableHead>
                  <TableHead className="text-center">Typical Floors</TableHead>
                  <TableHead className="text-center">Penthouse</TableHead>
                  <TableHead className="text-center">Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {buildings === null && (
                  <>
                      <LoadingRow />
                      <LoadingRow />
                      <LoadingRow />
                  </>
              )}
              {buildings && buildings.length > 0 && (
                  buildings.map((building) => (
                      <BuildingRow 
                        key={building.id} 
                        building={building} 
                        isDefault={userProfile?.defaultBuildingId === building.id}
                        onSetDefault={handleSetDefault}
                      />
                  ))
              )}
               {buildings && buildings.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 px-4">
                             <p className="text-muted-foreground">
                                You haven't added any buildings yet. Click "Add Building" or "Import Building" to start.
                            </p>
                        </TableCell>
                    </TableRow>
               )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
