
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EditBuildingSheet } from '@/components/edit-building-sheet';
import type { Building } from '@/types';


function GeneralSettingsTab() {
  const user = useUser();
  // Placeholder for profile editing logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>Update your profile details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <label>Display Name</label>
            <Input defaultValue={user?.displayName || ''} />
        </div>
        <div className="space-y-2">
            <label>Email</label>
            <Input defaultValue={user?.email || ''} disabled />
        </div>
        <div className="space-y-2">
            <label>Phone Number</label>
            <Input placeholder="Your phone number" />
        </div>
        <Button>Save Changes</Button>
      </CardContent>
    </Card>
  );
}

function BuildingsSettingsTab() {
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
                    <Button size="sm">Open</Button>
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

export default function SettingsPage() {
  const user = useUser();
  
  if (!user) {
    return null; // Or a loading spinner
  }

  return (
    <main className="w-full max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="buildings">Buildings</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
            <GeneralSettingsTab />
        </TabsContent>
        <TabsContent value="buildings" className="mt-6">
            <BuildingsSettingsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
