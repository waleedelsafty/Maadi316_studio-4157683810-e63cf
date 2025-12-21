
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level } from '@/types';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const levelTypes: Level['type'][] = ['Basement', 'Ground', 'Mezzanine', 'Typical Floor', 'Penthouse', 'Rooftop'];
const uniqueLevelTypes: Level['type'][] = ['Ground', 'Penthouse', 'Rooftop'];

const levelTypeOrder: Record<Level['type'], number> = {
    'Rooftop': 6,
    'Penthouse': 5,
    'Typical Floor': 4,
    'Mezzanine': 3,
    'Ground': 2,
    'Basement': 1,
};


export default function BuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    const [isAddingLevel, setIsAddingLevel] = useState(false);
    const [levelName, setLevelName] = useState('');
    const [levelType, setLevelType] = useState<Level['type'] | ''>('');
    const [floorNumber, setFloorNumber] = useState<number | ''>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');


    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        // We fetch without order, and sort on the client
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);

    const { data: levels } = useCollection(levelsQuery);

    const availableLevelTypes = useMemo(() => {
        if (!levels || !building) return levelTypes;

        // Filter out unique types that already exist
        const existingUniqueTypes = new Set(levels.filter(level => uniqueLevelTypes.includes(level.type)).map(level => level.type));
        let filteredTypes = levelTypes.filter(type => !existingUniqueTypes.has(type));

        // Handle Basement logic
        if (building.hasBasement) {
            const basementCount = levels.filter(level => level.type === 'Basement').length;
            if (basementCount >= (building.basementCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Basement');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Basement');
        }

        // Handle Mezzanine logic
        if (building.hasMezzanine) {
            const mezzanineCount = levels.filter(level => level.type === 'Mezzanine').length;
            if (mezzanineCount >= (building.mezzanineCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
        }

        return filteredTypes;
    }, [levels, building]);
    
    const sortedLevels = useMemo(() => {
        if (!levels) return [];
        return [...levels].sort((a, b) => {
            const typeA = levelTypeOrder[a.type];
            const typeB = levelTypeOrder[b.type];

            if (typeA !== typeB) {
                return sortOrder === 'asc' ? typeA - typeB : typeB - a.name.localeCompare(b.name);
            }

            // If types are the same, apply secondary sorting
            if (a.type === 'Typical Floor') {
                 return sortOrder === 'asc' 
                    ? (a.floorNumber || 0) - (b.floorNumber || 0) 
                    : (b.floorNumber || 0) - (a.floorNumber || 0);
            }
             if (a.type === 'Basement') {
                // For basements, a higher number is "lower" so we reverse the logic
                 return sortOrder === 'asc' 
                    ? a.name.localeCompare(b.name) * -1
                    : b.name.localeCompare(a.name) * -1;
            }
            
            return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        });
    }, [levels, sortOrder]);


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
        if (!levelName.trim() || !levelType || !user || !firestore || !buildingId || !levels) {
            toast({
                variant: 'destructive',
                title: 'Missing fields',
                description: 'Please provide a name and type for the level.',
            });
            return;
        }
        
        if (levelType === 'Typical Floor') {
            const numFloor = Number(floorNumber);
            if (floorNumber === '' || isNaN(numFloor)) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid Floor Number',
                    description: 'Please provide a valid number for the typical floor.',
                });
                return;
            }
            // Check if a typical floor with this number already exists
            if (levels.some(level => level.type === 'Typical Floor' && level.floorNumber === numFloor)) {
                toast({
                    variant: 'destructive',
                    title: 'Duplicate Floor Number',
                    description: `A "Typical Floor" with the number ${numFloor} already exists.`,
                });
                return;
            }
        }


        const newLevelData: Omit<Level, 'id' | 'createdAt'> & { createdAt: any } = {
            name: levelName,
            type: levelType,
            createdAt: serverTimestamp(),
            ...(levelType === 'Typical Floor' && { floorNumber: Number(floorNumber) }),
        };

        const levelsCollectionRef = collection(firestore, 'buildings', buildingId, 'levels');
        
        addDoc(levelsCollectionRef, newLevelData)
            .then(() => {
                setLevelName('');
                setLevelType('');
                setFloorNumber('');
                setIsAddingLevel(false);
                toast({
                    title: 'Level Added',
                    description: `The level "${levelName}" has been added to the building.`,
                });
            })
            .catch((serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: levelsCollectionRef.path,
                    operation: 'create',
                    requestResourceData: newLevelData,
                }));
            });
    };
    
    const handleDeleteLevel = (levelId: string) => {
        if (!firestore || !buildingId) return;

        const levelRef = doc(firestore, 'buildings', buildingId, 'levels', levelId);
        
        deleteDoc(levelRef).then(() => {
            toast({
                title: "Level Deleted",
                description: "The level has been successfully removed.",
            })
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: levelRef.path,
                operation: 'delete',
            }));
        })
    }

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
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Building Levels</CardTitle>
                            <CardDescription>Define the structure of your building by adding and managing its levels.</CardDescription>
                        </div>
                         {!isAddingLevel && (
                             <Button onClick={() => setIsAddingLevel(true)}>Add New Level</Button>
                         )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isAddingLevel && (
                        <form onSubmit={handleAddLevel} className="space-y-4 p-4 border rounded-lg bg-muted/50">
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
                                        {availableLevelTypes.map(type => (
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
                            <div className="flex gap-2">
                                <Button type="submit">Save Level</Button>
                                <Button variant="outline" onClick={() => setIsAddingLevel(false)}>Cancel</Button>
                            </div>
                        </form>
                    )}
                    
                    <div className="space-y-4">
                         <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                {sortOrder === 'asc' ? <ArrowUp className="mr-2 h-4 w-4" /> : <ArrowDown className="mr-2 h-4 w-4" />}
                                Sort: {sortOrder === 'asc' ? 'Bottom-Up' : 'Top-Down'}
                            </Button>
                        </div>
                        
                        {sortedLevels && sortedLevels.length > 0 ? (
                            sortedLevels.map(level => (
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
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm">Delete</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the level
                                                            "{level.name}" from your building.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteLevel(level.id)}>
                                                            Continue
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
