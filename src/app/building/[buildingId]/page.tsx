
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
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

        const newLevel: Omit<Level, 'id'> = {
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
        <main className="w-full max-w-4xl mx-auto">
            <div className="mb-8">
                <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Buildings
                </Link>
                {building ? (
                    <>
                        <h1 className="text-3xl font-bold mt-2">{building.name}</h1>
                        <p className="text-muted-foreground">{building.address}</p>
                    </>
                ) : (
                    <p>Loading building details...</p>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add a New Level</CardTitle>
                            <CardDescription>Define the structure of your building by adding levels.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddLevel} className="space-y-4">
                                <Input
                                    placeholder="Level Name (e.g., 'Lobby', 'Floor 5')"
                                    value={levelName}
                                    onChange={(e) => setLevelName(e.target.value)}
                                    required
                                />
                                <Select onValueChange={(value) => setLevelType(value as Level['type'])} value={levelType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select level type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {levelTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {levelType === 'Typical Floor' && (
                                    <Input
                                        type="number"
                                        placeholder="Floor Number (e.g., 1, 2, 3...)"
                                        value={floorNumber}
                                        onChange={(e) => setFloorNumber(Number(e.target.value))}
                                        required
                                    />
                                )}
                                <Button type="submit" className="w-full">Add Level</Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div>
                     <h2 className="text-2xl font-bold mb-4">Building Levels</h2>
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
                </div>
            </div>
        </main>
    );
}
