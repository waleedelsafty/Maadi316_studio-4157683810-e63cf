'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useState, useMemo } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EditBuildingSheet } from '@/components/edit-building-sheet';
import type { Building } from '@/types';
import Link from 'next/link';

export default function BuildingsSettingsPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'buildings'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingName.trim() || !buildingAddress.trim() || !user || !firestore)
      return;

    const newBuilding = {
      name: buildingName,
      address: buildingAddress,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      floors: 0,
      units: 0,
    };

    addDoc(collection(firestore, 'buildings'), newBuilding)
      .then(() => {
        setBuildingName('');
        setBuildingAddress('');
        toast({
          title: 'Building added!',
          description: 'Your new building has been saved.',
        });
      })
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: '/buildings',
          operation: 'create',
          requestResourceData: newBuilding
        }));
      });
  };
  
  if (!user) {
    return null; // Or a loading spinner
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Building</CardTitle>
          <CardDescription>
            Add a new building to your management portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBuilding} className="space-y-4">
            <Input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="Building Name (e.g., 'Main Street Plaza')"
              className="w-full"
              required
            />
            <Input
              type="text"
              value={buildingAddress}
              onChange={(e) => setBuildingAddress(e.target.value)}
              placeholder="Address (e.g., '123 Main St, Anytown, USA')"
              className="w-full"
              required
            />
            <Button type="submit" className="w-full sm:w-auto">
              Add Building
            </Button>
          </form>
        </CardContent>
      </Card>

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
                    <Button variant="outline" size="sm" onClick={() => setEditingBuilding(building as Building)}>Edit</Button>
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
            </div>
          )}
        </div>
      </div>
       {editingBuilding && (
            <EditBuildingSheet
                building={editingBuilding}
                isOpen={!!editingBuilding}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setEditingBuilding(null);
                    }
                }}
            />
        )}
    </div>
  );
}