
'use client';

import { useMemo, useState, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { doc, collection, query, deleteDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit, Owner, GlobalUnitType } from '@/types';
import { ArrowLeft, Edit, ChevronsUpDown, ArrowUp, ArrowDown, Search, Trash2, Link as LinkIcon, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import useLocalStorage from '@/hooks/use-local-storage';
import { defaultColumnVisibility, type UnitColumnVisibility } from '@/app/settings/display/page';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';


type UnitSortKey = 'unitNumber' | 'unitTypeId' | 'levelId' | 'ownerName' | 'totalSqm' | 'quarterlyMaintenanceFees';

export default function AllUnitsPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // --- State ---
    const [sortKey, setSortKey] = useState<UnitSortKey>('unitNumber');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [columnVisibility] = useLocalStorage<UnitColumnVisibility>('unit-column-visibility', defaultColumnVisibility);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    
    // --- Firestore Hooks ---
    const buildingRef = useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const levelsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'levels'), [firestore, buildingId]);
    const { data: levels } = useCollection<Level>(levelsQuery);

    const unitsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'units'), [firestore, buildingId]);
    const { data: allUnits } = useCollection<Unit>(unitsQuery);
    
    const ownersQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'owners'), [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    const globalUnitTypesQuery = useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
    const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);


    // --- Memoized Data Maps ---
    const allUnitsMap = useMemo(() => new Map((allUnits || []).map(u => [u.id, u])), [allUnits]);
    const levelsMap = useMemo(() => new Map((levels || []).map(l => [l.id, l.name])), [levels]);
    const ownersMap = useMemo(() => new Map((owners || []).map(o => [o.id, o.name])), [owners]);
    const unitTypesMap = useMemo(() => new Map((globalUnitTypes || []).map(t => [t.id, t.name])), [globalUnitTypes]);

    // --- Actions ---
    const handleDeleteUnit = async (unitToDelete: Unit) => {
        if (!firestore || !buildingId || !allUnits) return;
        
        try {
            const batch = writeBatch(firestore);
            const unitRef = doc(firestore, 'buildings', buildingId, 'units', unitToDelete.id);
            batch.delete(unitRef);

            if (unitToDelete.parentUnitId) {
                const parentRef = doc(firestore, 'buildings', buildingId, 'units', unitToDelete.parentUnitId);
                const parentUnit = allUnits.find(u => u.id === unitToDelete.parentUnitId);
                if (parentUnit) {
                    const updatedChildren = (parentUnit.childUnitIds || []).filter(id => id !== unitToDelete.id);
                    batch.update(parentRef, { childUnitIds: updatedChildren });
                }
            }
            
            if (unitToDelete.childUnitIds && unitToDelete.childUnitIds.length > 0) {
                 unitToDelete.childUnitIds.forEach(childId => {
                     const childRef = doc(firestore, 'buildings', buildingId, 'units', childId);
                     batch.delete(childRef);
                 });
            }

            await batch.commit();
            toast({ title: "Unit Deleted", description: `Unit "${unitToDelete.unitNumber}" and any linked parts have been removed.` });

        } catch (error) {
            console.error(error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `/buildings/${buildingId}/units/${unitToDelete.id}`, operation: 'delete' }));
        }
    }


    // --- Sorting and Filtering ---
    const sortedAndFilteredUnits = useMemo(() => {
        if (!allUnits) return null;
        
        const mainUnits = allUnits.filter(unit => !unit.parentUnitId);

        const filtered = mainUnits.filter(unit => {
            if (!searchQuery) return true;
            const queryLower = searchQuery.toLowerCase();
            const ownerName = ownersMap.get(unit.ownerId)?.toLowerCase() || '';

            return String(unit.unitNumber).toLowerCase().includes(queryLower) || 
                   ownerName.includes(queryLower);
        });

        return filtered.sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            switch (sortKey) {
                case 'unitNumber': {
                    const numA = parseInt(String(a.unitNumber).match(/\d+/)?.[0] || '0', 10);
                    const numB = parseInt(String(b.unitNumber).match(/\d+/)?.[0] || '0', 10);
                    if (numA !== numB) {
                        return (numA - numB) * dir;
                    }
                    // Fallback to full string sort if numbers are the same (e.g. '10A' vs '10B')
                    return String(a.unitNumber).localeCompare(String(b.unitNumber), undefined, { numeric: true }) * dir;
                }
                case 'unitTypeId': return (unitTypesMap.get(a.unitTypeId) || '').localeCompare(unitTypesMap.get(b.unitTypeId) || '') * dir;
                case 'ownerName': return (ownersMap.get(a.ownerId) || '').localeCompare(ownersMap.get(b.ownerId) || '') * dir;
                case 'totalSqm': {
                    const aChildren = (a.childUnitIds || []).map(id => allUnitsMap.get(id)).filter(Boolean) as Unit[];
                    const bChildren = (b.childUnitIds || []).map(id => allUnitsMap.get(id)).filter(Boolean) as Unit[];
                    const aTotal = a.sqm + aChildren.reduce((sum, c) => sum + c.sqm, 0);
                    const bTotal = b.sqm + bChildren.reduce((sum, c) => sum + c.sqm, 0);
                    return (aTotal - bTotal) * dir;
                }
                 case 'quarterlyMaintenanceFees': return (a.quarterlyMaintenanceFees - b.quarterlyMaintenanceFees) * dir;
                case 'levelId':
                default:
                    return (levelsMap.get(a.levelId) || '').localeCompare(levelsMap.get(b.levelId) || '') * dir;
            }
        });
    }, [allUnits, sortKey, sortDirection, levelsMap, ownersMap, unitTypesMap, searchQuery, allUnitsMap]);

    const handleSort = (key: UnitSortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: UnitSortKey) => {
        if (sortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };
    
    const toggleRow = (unitId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(unitId)) {
                newSet.delete(unitId);
            } else {
                newSet.add(unitId);
            }
            return newSet;
        });
    };
        
    // --- Render Guards ---
    if (building && user && building.ownerId !== user.uid) {
        return <div className="text-center py-10"><p className="text-2xl font-bold">Access Denied</p><p>You do not have permission to view this section.</p><Button asChild className="mt-4"><Link href="/">Go to Homepage</Link></Button></div>;
    }
    if (building?.isDeleted) {
        return <div className="text-center py-10"><p className="text-2xl font-bold">Building Deleted</p><p>This building is in the recycle bin.</p><Button asChild className="mt-4"><Link href="/settings/recycle-bin">Go to Recycle Bin</Link></Button></div>;
    }

    const buildingName = building?.name;
    const isLoading = !sortedAndFilteredUnits || !levels || !owners || !globalUnitTypes;
    const tableColSpan = 5 + (columnVisibility.owner ? 1 : 0);

    return (
        <main className="w-full space-y-2">
            <div className="mb-1">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0 h-8">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                         <div>
                            <CardTitle>All Units</CardTitle>
                            <CardDescription>A complete list of every unit in "{buildingName || '...'}".</CardDescription>
                        </div>
                         <div className="flex gap-2">
                             <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by unit # or owner..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('unitNumber')} className="px-0">Unit # {renderSortIcon('unitNumber')}</Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('unitTypeId')} className="px-0">Type {renderSortIcon('unitTypeId')}</Button></TableHead>
                                    {columnVisibility.owner && <TableHead><Button variant="ghost" onClick={() => handleSort('ownerName')} className="px-0">Owner {renderSortIcon('ownerName')}</Button></TableHead>}
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('totalSqm')} className="px-0">Total Size (sqm) {renderSortIcon('totalSqm')}</Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('quarterlyMaintenanceFees')} className="px-0">Maint. Fee {renderSortIcon('quarterlyMaintenanceFees')}</Button></TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={tableColSpan}><Skeleton className="h-5 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : sortedAndFilteredUnits && sortedAndFilteredUnits.length > 0 ? (
                                    sortedAndFilteredUnits.map(unit => {
                                        const isExpanded = expandedRows.has(unit.id);
                                        const childUnits = (unit.childUnitIds || []).map(id => allUnitsMap.get(id)).filter(Boolean) as Unit[];
                                        const isMultiLevel = childUnits.length > 0;
                                        const totalSqm = unit.sqm + childUnits.reduce((sum, child) => sum + child.sqm, 0);
                                        const combinedUnitNumber = isMultiLevel 
                                            ? [unit, ...childUnits].map(u => u.unitNumber).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(' - ')
                                            : unit.unitNumber;

                                        return (
                                            <Fragment key={unit.id}>
                                                <TableRow>
                                                    <TableCell>
                                                        {isMultiLevel && (
                                                            <Button variant="ghost" size="icon" onClick={() => toggleRow(unit.id)} className="h-8 w-8">
                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-semibold">{combinedUnitNumber}</TableCell>
                                                    <TableCell>{unitTypesMap.get(unit.unitTypeId) || 'N/A'}</TableCell>
                                                    {columnVisibility.owner && <TableCell>{ownersMap.get(unit.ownerId) || 'N/A'}</TableCell>}
                                                    <TableCell>{totalSqm.toFixed(2)}</TableCell>
                                                    <TableCell>{unit.quarterlyMaintenanceFees.toLocaleString(undefined, { style: 'currency', currency: 'USD'})}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="ghost" size="icon" asChild>
                                                                <Link href={`/building/${buildingId}/unit/${unit.id}/edit?from=/building/${buildingId}/units`}>
                                                                    <Edit className="h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will permanently delete unit "{unit.unitNumber}".
                                                                            {childUnits.length > 0 && <span className='font-bold text-destructive'> This is a parent unit, and its {childUnits.length} linked child unit(s) will also be deleted.</span>}
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteUnit(unit)}>Continue</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && [unit, ...childUnits].map((part, index) => (
                                                    <TableRow key={part.id} className="bg-muted/50 hover:bg-muted">
                                                         <TableCell></TableCell>
                                                        <TableCell colSpan={columnVisibility.owner ? 2 : 1} className="pl-8 py-2">
                                                            <div className="flex items-center gap-2 font-medium">
                                                                <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                                                                {index === 0 ? 'Parent Part:' : 'Child Part:'}
                                                                <span className="font-normal">{part.unitNumber}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">{levelsMap.get(part.levelId) || 'N/A'}</TableCell>
                                                        <TableCell className="py-2">{part.sqm.toFixed(2)}</TableCell>
                                                        <TableCell colSpan={2} className="py-2"></TableCell>
                                                    </TableRow>
                                                ))}
                                            </Fragment>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={tableColSpan + 1} className="text-center h-24">
                                            {searchQuery ? `No units match "${searchQuery}".` : "No units have been created for this building."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
