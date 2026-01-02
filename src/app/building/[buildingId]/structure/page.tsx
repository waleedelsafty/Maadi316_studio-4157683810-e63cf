
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit, Owner } from '@/types';
import { ArrowLeft, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

// --- Logic from BuildingLevelsTab ---

const levelTypes: Level['levelType'][] = ['Basement', 'Ground', 'Mezzanine', 'Typical Floor', 'Penthouse', 'Rooftop'];
const uniqueLevelTypes: Level['levelType'][] = ['Ground', 'Penthouse', 'Rooftop'];

const levelTypeOrder: Record<Level['levelType'], number> = {
    'Rooftop': 6, 'Penthouse': 5, 'Typical Floor': 4, 'Mezzanine': 3, 'Ground': 2, 'Basement': 1,
};

type SortKey = 'name' | 'type' | 'units';
type SortDirection = 'asc' | 'desc';

function LevelRow({ level, buildingId, onDelete, unitCount }: { level: Level; buildingId: string; onDelete: (levelId: string) => void; unitCount: number | null }) {
    return (
        <TableRow>
            <TableCell className="font-semibold">{level.name}</TableCell>
            <TableCell>{level.levelType}{level.levelType === 'Typical Floor' && ` - Floor ${level.floorNumber}`}</TableCell>
            <TableCell className="text-center">{unitCount !== null ? unitCount : <Skeleton className="h-5 w-5 mx-auto" />}</TableCell>
            <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" asChild><Link href={`/building/${buildingId}/level/${level.id}`}>Manage Units</Link></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete the level "{level.name}". All units on this level will also be deleted.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(level.id)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function BuildingStructurePage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();
    
    // Firestore Hooks
    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc<Building>(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);
    const { data: levels } = useCollection<Level>(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection<Unit>(unitsQuery);

    const ownersQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'owners'));
    }, [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    // --- State and Logic from BuildingLevelsTab ---
    const [isAddingLevel, setIsAddingLevel] = useState(false);
    const [levelName, setLevelName] = useState('');
    const [levelType, setLevelType] = useState<Level['levelType'] | ''>('');
    const [floorNumber, setFloorNumber] = useState<number | ''>('');
    const [sortKey, setSortKey] = useState<SortKey>('type');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const unitCountsByLevel = useMemo(() => {
        if (!units) return new Map<string, number>();
        const counts = new Map<string, number>();
        for (const unit of units) {
            counts.set(unit.levelId, (counts.get(unit.levelId) || 0) + 1);
        }
        return counts;
    }, [units]);

    const ownersMap = useMemo(() => new Map((owners || []).map(o => [o.id, o.name])), [owners]);

    const availableLevelTypes = useMemo(() => {
        if (!levels || !building) return levelTypes;
    
        let filteredTypes = [...levelTypes];
        const existingUniqueTypes = new Set(levels.filter(level => uniqueLevelTypes.includes(level.levelType)).map(level => level.levelType));
        filteredTypes = filteredTypes.filter(type => !existingUniqueTypes.has(type));
    
        if (building.hasBasement) {
            if (levels.filter(l => l.levelType === 'Basement').length >= (building.basementCount || 0)) {
                filteredTypes = filteredTypes.filter(t => t !== 'Basement');
            }
        } else {
            filteredTypes = filteredTypes.filter(t => t !== 'Basement');
        }
    
        if (building.hasMezzanine) {
            if (levels.filter(l => l.levelType === 'Mezzanine').length >= (building.mezzanineCount || 0)) {
                filteredTypes = filteredTypes.filter(t => t !== 'Mezzanine');
            }
        } else {
            filteredTypes = filteredTypes.filter(t => t !== 'Mezzanine');
        }

        if (!building.hasPenthouse) filteredTypes = filteredTypes.filter(t => t !== 'Penthouse');
        if (!building.hasRooftop) filteredTypes = filteredTypes.filter(t => t !== 'Rooftop');

        return filteredTypes;
    }, [levels, building]);

    const sortedLevels = useMemo(() => {
        if (!levels) return [];
        return [...levels].sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            const aName = a.name || ''; const bName = b.name || '';
            switch (sortKey) {
                case 'name': return aName.localeCompare(bName) * dir;
                case 'units':
                    const aUnits = unitCountsByLevel.get(a.id) || 0;
                    const bUnits = unitCountsByLevel.get(b.id) || 0;
                    return (aUnits - bUnits) * dir;
                case 'type':
                default:
                    const typeA = levelTypeOrder[a.levelType]; const typeB = levelTypeOrder[b.levelType];
                    if (typeA !== typeB) return (typeA - typeB) * dir;
                    if (a.levelType === 'Typical Floor') return ((a.floorNumber || 0) - (b.floorNumber || 0)) * dir;
                    if (a.levelType === 'Basement') return aName.localeCompare(bName) * (dir * -1);
                    return aName.localeCompare(bName) * dir;
            }
        });
    }, [levels, sortKey, sortDirection, unitCountsByLevel]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleAddLevel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!levelName.trim() || !levelType || !user || !firestore || !buildingId || !levels) return;
        
        if (levelType === 'Typical Floor') {
            const numFloor = Number(floorNumber);
            if (floorNumber === '' || isNaN(numFloor) || levels.some(level => level.levelType === 'Typical Floor' && level.floorNumber === numFloor)) {
                toast({ variant: 'destructive', title: 'Invalid Floor Number', description: 'Please provide a unique, valid number for the typical floor.'});
                return;
            }
        }

        const newLevelData: Omit<Level, 'id' | 'createdAt'> & { createdAt: any } = {
            name: levelName, levelType: levelType, createdAt: serverTimestamp(),
            ...(levelType === 'Typical Floor' && { floorNumber: Number(floorNumber) }),
        };

        const levelsCollectionRef = collection(firestore, 'buildings', buildingId, 'levels');
        addDoc(levelsCollectionRef, newLevelData).then(() => {
            setLevelName(''); setLevelType(''); setFloorNumber(''); setIsAddingLevel(false);
            toast({ title: 'Level Added', description: `The level "${levelName}" has been added.` });
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: levelsCollectionRef.path, operation: 'create', requestResourceData: newLevelData,
            }));
        });
    };

    const handleDeleteLevel = (levelId: string) => {
        if (!firestore || !buildingId) return;
        const itemRef = doc(firestore, 'buildings', buildingId, 'levels', levelId);
        deleteDoc(itemRef).then(() => {
            toast({ title: `Level Deleted`, description: `The level has been successfully removed.` })
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: itemRef.path, operation: 'delete' }));
        })
    }

    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this section.</p>
                <Button asChild className="mt-4"><Link href="/">Go to Homepage</Link></Button>
            </div>
        )
    }

    if (building?.isDeleted) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Building Deleted</p>
                <p>This building is in the recycle bin. You can restore it from the settings page.</p>
                 <Button asChild className="mt-4"><Link href="/settings/recycle-bin">Go to Recycle Bin</Link></Button>
            </div>
        )
    }

    const buildingName = building?.name;

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Building Levels</CardTitle>
                            <CardDescription>Define the structure of your building by adding and managing its levels.</CardDescription>
                        </div>
                        {!isAddingLevel && <Button onClick={() => setIsAddingLevel(true)}>Add New Level</Button>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isAddingLevel && (
                        <form onSubmit={handleAddLevel} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Add a New Level</h3>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <Input placeholder="Level Name (e.g., 'Lobby')" value={levelName} onChange={(e) => setLevelName(e.target.value)} required className="sm:col-span-2"/>
                                <Select onValueChange={(value) => setLevelType(value as Level['levelType'])} value={levelType}>
                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                    <SelectContent>{availableLevelTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            {levelType === 'Typical Floor' && (
                                <Input type="number" placeholder="Floor Number (e.g., 1, 2, 3...)" value={floorNumber} onChange={(e) => setFloorNumber(Number(e.target.value))} required />
                            )}
                            <div className="flex gap-2"><Button type="submit">Save Level</Button><Button variant="outline" onClick={() => setIsAddingLevel(false)}>Cancel</Button></div>
                        </form>
                    )}
                    <div className="space-y-4">
                        {sortedLevels && sortedLevels.length > 0 ? (
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="px-0">Level Name {renderSortIcon('name')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" onClick={() => handleSort('type')} className="px-0">Type {renderSortIcon('type')}</Button></TableHead>
                                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('units')} className="px-0 mx-auto">Units {renderSortIcon('units')}</Button></TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedLevels.map((level) => (<LevelRow key={level.id} level={level} buildingId={buildingId} onDelete={handleDeleteLevel} unitCount={unitCountsByLevel.get(level.id) || 0} />))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : ( <div className="text-center py-12 rounded-lg border border-dashed"><p className="text-muted-foreground">No levels have been added yet.</p></div> )}
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>All Units</CardTitle>
                    <CardDescription>A complete list of every unit in "{buildingName}". Units are managed on their respective level pages.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Unit #</TableHead><TableHead>Level</TableHead><TableHead>Type</TableHead><TableHead>Owner</TableHead><TableHead>Size (sqm)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {units && levels && owners && units.length > 0 ? (
                                    units.map(unit => {
                                        const level = levels.find(l => l.id === unit.levelId);
                                        const owner = owners.find(o => o.id === unit.ownerId);
                                        return (
                                            <TableRow key={unit.id}>
                                                <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                                <TableCell>{level?.name || 'N/A'}</TableCell>
                                                <TableCell>{unit.unitType}</TableCell>
                                                <TableCell>{owner?.name || 'N/A'}</TableCell>
                                                <TableCell>{unit.sqm}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="text-center h-24">No units have been created for this building.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
