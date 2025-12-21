
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level } from '@/types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';

const levelTypes: Level['type'][] = ['Basement', 'Ground', 'Mezzanine', 'Typical Floor', 'Penthouse', 'Rooftop'];

export default function BuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    const [levelName, setLevelName] = useState('');
    const [levelType, setLevelType] = useState<Level['type'] | ''>('');
    const [floorNumber, setFloorNumber] = useState<number | ''>('');

    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(
            collection(firestore, 'buildings', buildingId, 'levels'),
            orderBy('createdAt', 'asc')
        );
    }, [firestore, buildingId]);

    const { data: levels } = useCollection(levelsQuery);

    const handleUpdateBuilding = async (field: keyof Building, value: string) => {
        if (!buildingRef) return;
        try {
            await updateDoc(buildingRef, { [field]: value });
            toast({
                title: 'Building Updated',
                description: `The building's ${field} has been updated.`,
            });
        } catch (serverError) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: buildingRef.path,
                operation: 'update',
                requestResourceData: { [field]: value },
            }));
        }
    };
    
    const handleAddLevel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!levelName.trim() || !levelType || !user || !firestore || !buildingId) {
            toast({
                variant: 'destructive',
                title: 'Missing fields',
                description: 'Please provide a name and type for the level.',
            });
            return;
        }
        
        if (levelType === 'Typical Floor' && (floorNumber === '' || isNaN(Number(floorNumber)))) {
            toast({
                variant: 'destructive',
                title: 'Invalid Floor Number',
                description: 'Please provide a valid number for the typical floor.',
            });
            return;
        }

        const newLevel: Omit<Level, 'id' | 'createdAt'> & { createdAt: any } = {
            name: levelName,
            type: levelType,
            createdAt: serverTimestamp(),
            ...(levelType === 'Typical Floor' && { floorNumber: Number(floorNumber) }),
        };

        const levelsCollectionRef = collection(firestore, 'buildings', buildingId, 'levels');
        
        addDoc(levelsCollectionRef, newLevel)
            .then(() => {
                setLevelName('');
                setLevelType('');
                setFloorNumber('');
                toast({
                    title: 'Level Added',
                    description: `The level "${levelName}" has been added to the building.`,
                });
            })
            .catch((serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: levelsCollectionRef.path,
                    operation: 'create',
                    requestResourceData: newLevel,
                }));
            });
    };
    
    // Security check
    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this building.</p>
                <Button asChild className="mt-4">
                    <Link href="/">Go to Homepage</Link>
                </Button>
            </div>
        )
    }

    return (
        <main className="w-full max-w-4xl mx-auto space-y-8">
            <div className="mb-4">
                <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Buildings
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Building Information</CardTitle>
                    <CardDescription>View and edit the general details of your building.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {building ? (
                        <>
                            <InlineEditField
                                label="Building Name"
                                value={building.name}
                                onSave={(value) => handleUpdateBuilding('name', value)}
                            />
                             <InlineEditField
                                label="Address"
                                value={building.address}
                                onSave={(value) => handleUpdateBuilding('address', value)}
                            />
                        </>
                    ) : (
                        <>
                            <div className="h-8 w-1/2 bg-muted rounded animate-pulse" />
                            <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Building Levels</CardTitle>
                    <CardDescription>Define the structure of your building by adding and managing its levels.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleAddLevel} className="space-y-4 p-4 border rounded-lg">
                         <h3 className="font-medium">Add a New Level</h3>
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Input
                                placeholder="Level Name (e.g., 'Lobby')"
                                value={levelName}
                                onChange={(e) => setLevelName(e.target.value)}
                                required
                                className="sm:col-span-2"
                            />
                             <Select onValueChange={(value) => setLevelType(value as Level['type'])} value={levelType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {levelTypes.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {levelType === 'Typical Floor' && (
                            <Input
                                type="number"
                                placeholder="Floor Number (e.g., 1, 2, 3...)"
                                value={floorNumber}
                                onChange={(e) => setFloorNumber(Number(e.target.value))}
                                required
                            />
                        )}
                        <Button type="submit">Add Level</Button>
                    </form>
                    
                    <div className="space-y-4">
                        {levels && levels.length > 0 ? (
                            levels.map(level => (
                                <Card key={level.id}>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg">{level.name}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Type: {level.type}
                                                {level.type === 'Typical Floor' && ` - Floor ${level.floorNumber}`}
                                            </p>
                                        </div>
                                         <div className="flex gap-2">
                                            <Button variant="outline" size="sm">Edit</Button>
                                            <Button variant="destructive" size="sm">Delete</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                             <div className="text-center py-12 rounded-lg border border-dashed">
                                <p className="text-muted-foreground">
                                No levels have been added to this building yet.
                                </p>
                            </div>
                        )}
                     </div>
                </CardContent>
            </Card>
        </main>
    );
}
