
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, where, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit, Owner } from '@/types';
import { ArrowLeft, Edit, DollarSign, ChevronsUpDown, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LevelFormSheet } from '@/components/level-form-sheet';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function LevelPage() {
    const { buildingId, levelId } = useParams() as { buildingId: string; levelId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    // State for Units
    const [isAddingUnit, setIsAddingUnit] = useState(false);
    const [unitNumber, setUnitNumber] = useState('');
    const [unitSqm, setUnitSqm] = useState<number | ''>('');
    const [unitMaintenance, setUnitMaintenance] = useState<number | ''>('');
    const [unitOwnerId, setUnitOwnerId] = useState('');
    const [unitType, setUnitType] = useState<string>('');
    
    // State for level editing
    const [isLevelSheetOpen, setIsLevelSheetOpen] = useState(false);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState("");

    // Firestore Hooks
    const buildingRef = useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const levelRef = useMemo(() => {
        if (!firestore || !buildingId || !levelId) return null;
        return doc(firestore, 'buildings', buildingId, 'levels', levelId);
    }, [firestore, buildingId, levelId]);
    const { data: level } = useDoc<Level>(levelRef);
    
    const allLevelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);
    const { data: allLevels } = useCollection(allLevelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId || !levelId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'), where('levelId', '==', levelId));
    }, [firestore, buildingId, levelId]);
    const { data: units } = useCollection(unitsQuery);

    const ownersQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return collection(firestore, 'buildings', buildingId, 'owners');
    }, [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    const ownersMap = useMemo(() => new Map((owners || []).map(o => [o.id, o])), [owners]);

    const comboboxFilteredOwners = useMemo(() => {
        if (!owners) return [];
        if (!comboboxSearch) return owners;
        const lowerQuery = comboboxSearch.toLowerCase();
        return owners.filter(o => o.name.toLowerCase().includes(lowerQuery));
    }, [owners, comboboxSearch]);

    const handleAddUnit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!unitNumber.trim() || unitSqm === '' || unitMaintenance === '' || !unitOwnerId || !unitType || !firestore || !buildingId) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill out all unit details.' });
            return;
        }

        const newUnitData: Omit<Unit, 'id' | 'createdAt'> & { createdAt: any } = {
            unitNumber, levelId, ownerId: unitOwnerId, sqm: Number(unitSqm), 
            quarterlyMaintenanceFees: Number(unitMaintenance),
            unitType: unitType, createdAt: serverTimestamp(),
        };

        const unitsCollectionRef = collection(firestore, 'buildings', buildingId, 'units');
        addDoc(unitsCollectionRef, newUnitData)
            .then(() => {
                setUnitNumber(''); setUnitSqm(''); setUnitMaintenance(''); setUnitOwnerId(''); setUnitType('');
                setIsAddingUnit(false);
                toast({ title: 'Unit Added', description: `Unit "${unitNumber}" has been added.` });
            })
            .catch((serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: unitsCollectionRef.path, operation: 'create', requestResourceData: newUnitData,
                }));
            });
    };

    const handleDeleteUnit = (unitId: string) => {
        if (!firestore || !buildingId) return;
        const unitRef = doc(firestore, 'buildings', buildingId, 'units', unitId);
        deleteDoc(unitRef)
            .then(() => {
                toast({ title: "Unit Deleted", description: "The unit has been successfully removed." });
            })
            .catch((serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: unitRef.path, operation: 'delete' }));
            });
    };
    
    const availableUnitTypes = building?.enabledUnitTypes || [];

    return (
        <main className="w-full max-w-5xl space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}/structure`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Structure
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Level: {level?.name || '...'}</CardTitle>
                            <CardDescription>View level details and manage its units.</CardDescription>
                        </div>
                        {level && <Button variant="outline" size="sm" onClick={() => setIsLevelSheetOpen(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Level Details
                        </Button>}
                    </div>
                </CardHeader>
            </Card>

            <Card>
                 <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Units on this Level</CardTitle>
                            <CardDescription>Add and manage the individual units for "{level?.name}".</CardDescription>
                        </div>
                         {!isAddingUnit && ( <Button onClick={() => setIsAddingUnit(true)} disabled={!level}>Add New Unit</Button> )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isAddingUnit && (
                        <form onSubmit={handleAddUnit} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Add a New Unit</h3>
                             <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="Unit Number (e.g., '101', 'G-02')" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} required />
                                 <Select onValueChange={setUnitType} value={unitType}>
                                    <SelectTrigger><SelectValue placeholder="Select Unit Type" /></SelectTrigger>
                                    <SelectContent>
                                        {availableUnitTypes.length > 0 ? (
                                            availableUnitTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))
                                        ) : (
                                            <div className="p-4 text-sm text-muted-foreground">No unit types enabled for this building.</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                               <Input type="number" placeholder="Size (sqm)" value={unitSqm} onChange={e => setUnitSqm(Number(e.target.value))} required/>
                               <Input type="number" placeholder="Quarterly Maintenance" value={unitMaintenance} onChange={e => setUnitMaintenance(Number(e.target.value))} required/>
                            </div>
                            <div>
                                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full justify-between">
                                            {unitOwnerId ? ownersMap.get(unitOwnerId)?.name : "Select owner..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <div className="p-2"><Input placeholder="Search owner..." value={comboboxSearch} onChange={(e) => setComboboxSearch(e.target.value)} /></div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {comboboxFilteredOwners?.length > 0 ? comboboxFilteredOwners.map(owner => (
                                                <div key={owner.id} onClick={() => { setUnitOwnerId(owner.id); setIsComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                    <span>{owner.name}</span>
                                                    {unitOwnerId === owner.id && <Check className="h-4 w-4" />}
                                                </div>
                                            )) : <p className="p-2 text-center text-sm text-muted-foreground">No owners found.</p>}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">Save Unit</Button>
                                <Button variant="outline" onClick={() => setIsAddingUnit(false)}>Cancel</Button>
                            </div>
                        </form>
                    )}

                    <div className="space-y-4">
                        {units && units.length > 0 ? (
                             <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Unit #</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Size (sqm)</TableHead>
                                            <TableHead>Owner</TableHead>
                                            <TableHead>Maint. Fee</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {units.map((unit) => (
                                            <TableRow key={unit.id}>
                                                <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                                <TableCell>{unit.unitType}</TableCell>
                                                <TableCell>{unit.sqm}</TableCell>
                                                <TableCell>{ownersMap.get(unit.ownerId)?.name || 'N/A'}</TableCell>
                                                <TableCell>{unit.quarterlyMaintenanceFees.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                                <TableCell className="text-right">
                                                     <div className="flex gap-2 justify-end">
                                                        <Button variant="outline" size="sm" asChild>
                                                            <Link href={`/building/${buildingId}/unit/${unit.id}/payments`}>
                                                                <DollarSign className="mr-2 h-4 w-4" /> Payments
                                                            </Link>
                                                        </Button>
                                                        <Button variant="outline" size="sm" asChild>
                                                            <Link href={`/building/${buildingId}/unit/${unit.id}/edit`}>Edit</Link>
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>This will permanently delete unit "{unit.unitNumber}".</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteUnit(unit.id)}>Continue</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12 rounded-lg border border-dashed">
                                <p className="text-muted-foreground">
                                    No units have been added to this level yet.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {level && (
                <LevelFormSheet 
                    level={level} 
                    buildingId={buildingId} 
                    isOpen={isLevelSheetOpen} 
                    onOpenChange={setIsLevelSheetOpen} 
                    existingLevels={allLevels || []} 
                />
            )}
        </main>
    );
}
