
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, updateDoc } from 'firebase/firestore';
import type { UserProfile, Unit, Owner, Level, Building, AppSettings } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  sqm: z.coerce.number().min(1, 'Size must be at least 1 sqm'),
  quarterlyMaintenanceFees: z.coerce.number().min(0, 'Fees cannot be negative'),
  unitType: z.string().min(1, 'Unit type is required'),
  levelId: z.string().min(1, 'Level is required'),
  ownerId: z.string().min(1, 'Owner is required'),
});

const UNITS_PER_PAGE = 5;

export default function UnitInspectorPage() {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // State for selection and pagination
    const [selectedUnitId, setSelectedUnitId] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);

    const [isOwnerComboboxOpen, setIsOwnerComboboxOpen] = React.useState(false);
    const [ownerComboboxSearch, setOwnerComboboxSearch] = React.useState("");
    const [isLevelComboboxOpen, setIsLevelComboboxOpen] = React.useState(false);
    const [levelComboboxSearch, setLevelComboboxSearch] = React.useState("");

    // --- Data Fetching ---
    const userProfileRef = React.useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const defaultBuildingId = userProfile?.defaultBuildingId;
    
    const buildingRef = React.useMemo(() => defaultBuildingId ? doc(firestore, 'buildings', defaultBuildingId) : null, [firestore, defaultBuildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const allUnitsQuery = React.useMemo(() => {
        if (!firestore || !defaultBuildingId) return null;
        return query(collection(firestore, 'buildings', defaultBuildingId, 'units'));
    }, [firestore, defaultBuildingId]);
    const { data: allUnits } = useCollection<Unit>(allUnitsQuery);

    const unitRef = React.useMemo(() => {
        if (!firestore || !defaultBuildingId || !selectedUnitId) return null;
        return doc(firestore, 'buildings', defaultBuildingId, 'units', selectedUnitId);
    }, [firestore, defaultBuildingId, selectedUnitId]);
    const { data: selectedUnit } = useDoc<Unit>(unitRef);

    const ownersQuery = React.useMemo(() => defaultBuildingId ? collection(firestore, 'buildings', defaultBuildingId, 'owners') : null, [firestore, defaultBuildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);
    const ownersMap = React.useMemo(() => new Map((owners || []).map(o => [o.id, o.name])), [owners]);

    const levelsQuery = React.useMemo(() => defaultBuildingId ? collection(firestore, 'buildings', defaultBuildingId, 'levels') : null, [firestore, defaultBuildingId]);
    const { data: levels } = useCollection<Level>(levelsQuery);
    const levelsMap = React.useMemo(() => new Map((levels || []).map(l => [l.id, l.name])), [levels]);
    
    // Form setup
    const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    React.useEffect(() => {
        if (selectedUnit) {
            reset({
                unitNumber: selectedUnit.unitNumber,
                sqm: selectedUnit.sqm,
                quarterlyMaintenanceFees: selectedUnit.quarterlyMaintenanceFees,
                unitType: selectedUnit.unitType || selectedUnit.type,
                levelId: selectedUnit.levelId,
                ownerId: selectedUnit.ownerId,
            });
        } else {
            reset({ unitNumber: '', sqm: 0, quarterlyMaintenanceFees: 0, unitType: undefined, levelId: '', ownerId: '' });
        }
    }, [selectedUnit, reset]);
    
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!unitRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'No unit selected to update.' });
            return;
        }
        const submissionData: any = { ...data };
        delete submissionData.type;

        updateDoc(unitRef, submissionData)
            .then(() => toast({ title: 'Unit Updated', description: `The details for Unit ${data.unitNumber} have been saved.` }))
            .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: unitRef.path, operation: 'update', requestResourceData: submissionData })));
    };

    // --- Pagination Logic ---
    const totalPages = allUnits ? Math.ceil(allUnits.length / UNITS_PER_PAGE) : 0;
    const paginatedUnits = React.useMemo(() => {
        if (!allUnits) return [];
        const startIndex = (currentPage - 1) * UNITS_PER_PAGE;
        return allUnits.slice(startIndex, startIndex + UNITS_PER_PAGE);
    }, [allUnits, currentPage]);

    const ownerSearch = React.useMemo(() => owners ? owners.filter(o => o.name.toLowerCase().includes(ownerComboboxSearch.toLowerCase())) : [], [owners, ownerComboboxSearch]);
    const levelSearch = React.useMemo(() => levels ? levels.filter(l => l.name.toLowerCase().includes(levelComboboxSearch.toLowerCase())) : [], [levels, levelComboboxSearch]);
    
    const availableUnitTypes = building?.enabledUnitTypeIds || [];
    const isLoading = userProfile === undefined || (defaultBuildingId && (allUnits === null || owners === null || levels === null || building === undefined));

    if (isLoading) {
        return (
            <main className="w-full max-w-4xl mx-auto space-y-6">
                <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
            </main>
        );
    }
    
    if (!defaultBuildingId) {
        return <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Default Building Set</AlertTitle><AlertDescription>Please select a default building in the "My Buildings" page to use this inspector.</AlertDescription></Alert>;
    }

    return (
        <main className="w-full max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Select a Unit</CardTitle>
                    <CardDescription>Click on a unit from the table below to load its data into the inspector form.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Unit Number</TableHead>
                                    <TableHead>Unit Type</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Level</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedUnits.length > 0 ? paginatedUnits.map(unit => (
                                    <TableRow key={unit.id} onClick={() => setSelectedUnitId(unit.id)} className={cn("cursor-pointer", selectedUnitId === unit.id && "bg-muted hover:bg-muted")}>
                                        <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                        <TableCell>{unit.unitType || unit.type}</TableCell>
                                        <TableCell>{ownersMap.get(unit.ownerId) || 'N/A'}</TableCell>
                                        <TableCell>{levelsMap.get(unit.levelId) || 'N/A'}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No units found in this building.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-2 pt-4">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Unit Data Inspector</CardTitle>
                    <CardDescription>
                       {selectedUnit ? `Editing all data for "Unit ${selectedUnit.unitNumber}" from your default building.` : 'Select a unit from the table above to begin editing.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!selectedUnit && !isLoading ? (
                         <div className="text-center py-12 text-muted-foreground">Please select a unit.</div>
                    ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2 text-sm">
                             <div className="flex justify-between border-b py-2">
                                <dt className="font-medium text-muted-foreground">Document ID</dt>
                                <dd className="font-mono text-foreground">{selectedUnit?.id || <Skeleton className="h-5 w-48" />}</dd>
                            </div>
                            <div className="flex justify-between border-b py-2">
                                <dt className="font-medium text-muted-foreground">Created At</dt>
                                <dd className="font-mono text-foreground">{selectedUnit ? format(selectedUnit.createdAt.toDate(), 'PPP p') : <Skeleton className="h-5 w-40" />}</dd>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="unitNumber">Unit Number</Label><Input id="unitNumber" {...register('unitNumber')} />{errors.unitNumber && <p className="text-destructive text-xs mt-1">{errors.unitNumber.message}</p>}</div>
                            <div><Label htmlFor="unitType">Unit Type</Label><Controller name="unitType" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableUnitTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>)} />{errors.unitType && <p className="text-destructive text-xs mt-1">{errors.unitType.message}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="sqm">Size (sqm)</Label><Input id="sqm" type="number" {...register('sqm')} />{errors.sqm && <p className="text-destructive text-xs mt-1">{errors.sqm.message}</p>}</div>
                            <div><Label htmlFor="quarterlyMaintenanceFees">Quarterly Maint. Fees</Label><Input id="quarterlyMaintenanceFees" type="number" {...register('quarterlyMaintenanceFees')} />{errors.quarterlyMaintenanceFees && <p className="text-destructive text-xs mt-1">{errors.quarterlyMaintenanceFees.message}</p>}</div>
                        </div>
                         <div>
                            <Label>Owner</Label>
                            <Controller name="ownerId" control={control} render={({ field }) => (
                                <Popover open={isOwnerComboboxOpen} onOpenChange={setIsOwnerComboboxOpen}>
                                    <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{field.value ? ownersMap.get(field.value) : "Select owner..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Input placeholder="Search owner..." value={ownerComboboxSearch} onChange={(e) => setOwnerComboboxSearch(e.target.value)} className="m-2 w-[calc(100%-1rem)]" />
                                        <div className="max-h-[300px] overflow-y-auto">{ownerSearch.map(o => (<div key={o.id} onClick={() => { field.onChange(o.id); setIsOwnerComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"><span>{o.name}</span>{field.value === o.id && <Check className="h-4 w-4" />}</div>))}</div>
                                    </PopoverContent>
                                </Popover>
                            )} />{errors.ownerId && <p className="text-destructive text-xs mt-1">{errors.ownerId.message}</p>}
                        </div>
                        <div>
                            <Label>Level</Label>
                            <Controller name="levelId" control={control} render={({ field }) => (
                                <Popover open={isLevelComboboxOpen} onOpenChange={setIsLevelComboboxOpen}>
                                    <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">{field.value ? levelsMap.get(field.value) : "Select level..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Input placeholder="Search level..." value={levelComboboxSearch} onChange={(e) => setLevelComboboxSearch(e.target.value)} className="m-2 w-[calc(100%-1rem)]" />
                                        <div className="max-h-[300px] overflow-y-auto">{levelSearch.map(l => (<div key={l.id} onClick={() => { field.onChange(l.id); setIsLevelComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"><span>{l.name}</span>{field.value === l.id && <Check className="h-4 w-4" />}</div>))}</div>
                                    </PopoverContent>
                                </Popover>
                            )} />{errors.levelId && <p className="text-destructive text-xs mt-1">{errors.levelId.message}</p>}
                        </div>
                        <div className="flex justify-end pt-4"><Button type="submit" disabled={isSubmitting || !selectedUnit}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button></div>
                    </form>
                    )}
                </CardContent>
             </Card>
        </main>
    );
}
