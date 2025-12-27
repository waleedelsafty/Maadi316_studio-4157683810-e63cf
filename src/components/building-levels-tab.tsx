
'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit } from '@/types';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

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

type SortKey = 'name' | 'type' | 'units';
type SortDirection = 'asc' | 'desc';

function LevelRow({ level, buildingId, onDelete, unitCount }: { level: Level; buildingId: string; onDelete: (levelId: string) => void; unitCount: number | null }) {
    return (
        <TableRow>
            <TableCell className="font-semibold">{level.name}</TableCell>
            <TableCell>{level.type}{level.type === 'Typical Floor' && ` - Floor ${level.floorNumber}`}</TableCell>
            <TableCell className="text-center">
                {unitCount !== null ? unitCount : <Skeleton className="h-5 w-5 mx-auto" />}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/building/${buildingId}/level/${level.id}`}>Edit</Link>
                    </Button>
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

interface BuildingLevelsTabProps {
    building: Building | null;
    levels: (Level & { id: string })[] | null;
    units: (Unit & { id: string })[] | null;
}

export function BuildingLevelsTab({ building, levels, units }: BuildingLevelsTabProps) {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();
    const buildingId = building?.id || '';

    // State for Levels form
    const [isAddingLevel, setIsAddingLevel] = useState(false);
    const [levelName, setLevelName] = useState('');
    const [levelType, setLevelType] = useState<Level['type'] | ''>('');
    const [floorNumber, setFloorNumber] = useState<number | ''>('');

    // State for Sorting
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

    const availableLevelTypes = useMemo(() => {
        if (!levels || !building) return levelTypes;
    
        let filteredTypes = [...levelTypes];
        const existingUniqueTypes = new Set(levels.filter(level => uniqueLevelTypes.includes(level.type)).map(level => level.type));
        filteredTypes = filteredTypes.filter(type => !existingUniqueTypes.has(type));
    
        if (building.hasBasement) {
            const basementCount = levels.filter(level => level.type === 'Basement').length;
            if (basementCount >= (building.basementCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Basement');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Basement');
        }
    
        if (building.hasMezzanine) {
            const mezzanineCount = levels.filter(level => level.type === 'Mezzanine').length;
            if (mezzanineCount >= (building.mezzanineCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
        }

        if (!building.hasPenthouse) {
             filteredTypes = filteredTypes.filter(type => type !== 'Penthouse');
        }

        if (!building.hasRooftop) {
             filteredTypes = filteredTypes.filter(type => type !== 'Rooftop');
        }

        return filteredTypes;
    }, [levels, building]);

    const sortedLevels = useMemo(() => {
        if (!levels) return [];
        return [...levels].sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            const aName = a.name || '';
            const bName = b.name || '';

            switch (sortKey) {
                case 'name':
                    return aName.localeCompare(bName) * dir;
                case 'units':
                    const aUnits = unitCountsByLevel.get(a.id) || 0;
                    const bUnits = unitCountsByLevel.get(b.id) || 0;
                    return (aUnits - bUnits) * dir;
                case 'type':
                default:
                    const typeA = levelTypeOrder[a.type];
                    const typeB = levelTypeOrder[b.type];
                    if (typeA !== typeB) return (typeA - typeB) * dir;

                    if (a.type === 'Typical Floor') {
                        return ((a.floorNumber || 0) - (b.floorNumber || 0)) * dir;
                    }
                    if (a.type === 'Basement') {
                        return aName.localeCompare(bName) * (dir * -1); // Higher basement numbers first
                    }
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
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleAddLevel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!levelName.trim() || !levelType || !user || !firestore || !buildingId || !levels) return;
        
        if (levelType === 'Typical Floor') {
            const numFloor = Number(floorNumber);
            if (floorNumber === '' || isNaN(numFloor) || levels.some(level => level.type === 'Typical Floor' && level.floorNumber === numFloor)) {
                toast({ variant: 'destructive', title: 'Invalid Floor Number', description: 'Please provide a unique, valid number for the typical floor.'});
                return;
            }
        }

        const newLevelData: Omit<Level, 'id' | 'createdAt'> & { createdAt: any } = {
            name: levelName, type: levelType, createdAt: serverTimestamp(),
            ...(levelType === 'Typical Floor' && { floorNumber: Number(floorNumber) }),
        };

        const levelsCollectionRef = collection(firestore, 'buildings', buildingId, 'levels');
        
        addDoc(levelsCollectionRef, newLevelData)
            .then(() => {
                setLevelName(''); setLevelType(''); setFloorNumber(''); setIsAddingLevel(false);
                toast({ title: 'Level Added', description: `The level "${levelName}" has been added.` });
            })
            .catch((serverError) => {
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

    return (
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
                            <Select onValueChange={(value) => setLevelType(value as Level['type'])} value={levelType}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>{availableLevelTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        {levelType === 'Typical Floor' && (
                            <Input type="number" placeholder="Floor Number (e.g., 1, 2, 3...)" value={floorNumber} onChange={(e) => setFloorNumber(Number(e.target.value))} required />
                        )}
                        <div className="flex gap-2">
                            <Button type="submit">Save Level</Button>
                            <Button variant="outline" onClick={() => setIsAddingLevel(false)}>Cancel</Button>
                        </div>
                    </form>
                )}
                <div className="space-y-4">
                    {sortedLevels && sortedLevels.length > 0 ? (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleSort('name')} className="px-0">
                                                Level Name {renderSortIcon('name')}
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleSort('type')} className="px-0">
                                                Type {renderSortIcon('type')}
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-center">
                                            <Button variant="ghost" onClick={() => handleSort('units')} className="px-0 mx-auto">
                                                Units {renderSortIcon('units')}
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedLevels.map((level) => (
                                        <LevelRow key={level.id} level={level} buildingId={buildingId} onDelete={handleDeleteLevel} unitCount={unitCountsByLevel.get(level.id) || 0} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : ( <div className="text-center py-12 rounded-lg border border-dashed"><p className="text-muted-foreground">No levels have been added yet.</p></div> )}
                </div>
            </CardContent>
        </Card>
    );
}
