
'use client';

import { useMemo, useState } from 'react';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit, Payment } from '@/types';
import { ArrowUp, ArrowDown, ChevronsUpDown, DollarSign, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useLocalStorage from '@/hooks/use-local-storage';
import { defaultColumnVisibility, type UnitColumnVisibility } from '@/app/settings/display/page';
import { getQuartersForRange, formatQuarter, getCurrentQuarter } from '@/lib/calculations';

type UnitSortKey = 'unitNumber' | 'type' | 'levelId' | 'ownerName' | 'balance';
type SortDirection = 'asc' | 'desc';
type QuarterRangeOption = 'current_quarter' | 'year_to_date' | 'all_since_start';


interface BuildingUnitsTabProps {
    building: Building | null;
    levels: (Level & { id: string })[] | null;
    units: (Unit & { id: string })[] | null;
    payments: (Payment & { id: string })[] | null;
}

export function BuildingUnitsTab({ building, levels, units, payments }: BuildingUnitsTabProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const buildingId = building?.id || '';
    const buildingName = (building as any)?.Building_name || (building as any)?.name || '...';
    
    // State for Sorting and Filtering
    const [unitSortKey, setUnitSortKey] = useState<UnitSortKey>('balance');
    const [unitSortDirection, setUnitSortDirection] = useState<SortDirection>('asc');
    const [unitSearchQuery, setUnitSearchQuery] = useState('');
    const [columnVisibility] = useLocalStorage<UnitColumnVisibility>('unit-column-visibility', defaultColumnVisibility);
    const [quarterRange, setQuarterRange] = useState<QuarterRangeOption>('all_since_start');

    const levelsMap = useMemo(() => {
        if (!levels) return new Map();
        return new Map(levels.map(l => [l.id, l.name]));
    }, [levels]);

    const financialDataByUnit = useMemo(() => {
        const results = new Map<string, { totalDue: number; totalPaid: number; balance: number }>();
        if (!units || !building || !building.financialStartDate) return results;

        const financialStartDate = building.financialStartDate?.toDate();
        if (!financialStartDate) return results;

        const quarterStringsInRange = getQuartersForRange(financialStartDate, quarterRange);

        units.forEach(unit => {
            const totalDue = (unit.quarterlyMaintenanceFees || 0) * quarterStringsInRange.length;
            
            const totalPaid = (payments || [])
                .filter(p => p.unitId === unit.id && quarterStringsInRange.includes(p.quarter))
                .reduce((sum, p) => sum + p.amount, 0);

            const balance = totalPaid - totalDue;
            
            results.set(unit.id, { totalDue, totalPaid, balance });
        });

        return results;

    }, [units, payments, building, quarterRange]);


    const sortedAndFilteredUnits = useMemo(() => {
        if (!units) return [];
    
        const filteredUnits = units.filter(unit => {
            if (!unitSearchQuery) return true;
            const query = unitSearchQuery.toLowerCase();
            const unitNumber = String(unit.unitNumber || '').toLowerCase();
            const ownerName = String(unit.ownerName || '').toLowerCase();
            return unitNumber.includes(query) || ownerName.includes(query);
        });

        return [...filteredUnits].sort((a, b) => {
            const dir = unitSortDirection === 'asc' ? 1 : -1;
            
            switch (unitSortKey) {
                case 'unitNumber':
                    return String(a.unitNumber || '').localeCompare(String(b.unitNumber || ''), undefined, { numeric: true }) * dir;
                case 'type':
                    return (a.type || '').localeCompare(b.type || '') * dir;
                case 'ownerName':
                    return (a.ownerName || '').localeCompare(b.ownerName || '') * dir;
                case 'levelId':
                    const levelNameA = levelsMap.get(a.levelId) || '';
                    const levelNameB = levelsMap.get(b.levelId) || '';
                    return levelNameA.localeCompare(levelNameB) * dir;
                case 'balance':
                    const balanceA = financialDataByUnit.get(a.id)?.balance || 0;
                    const balanceB = financialDataByUnit.get(b.id)?.balance || 0;
                    return (balanceA - balanceB) * dir;
                default:
                    return 0;
            }
        });
    }, [units, unitSortKey, unitSortDirection, levelsMap, unitSearchQuery, financialDataByUnit]);

    const unitTableColSpan = useMemo(() => {
        return (
            5 + // Unit #, Due, Paid, Balance, Actions are always visible
            (columnVisibility.type ? 1 : 0) +
            (columnVisibility.level ? 1 : 0) +
            (columnVisibility.owner ? 1 : 0)
        );
    }, [columnVisibility]);

    const handleUnitSort = (key: UnitSortKey) => {
        if (unitSortKey === key) {
            setUnitSortDirection(unitSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setUnitSortKey(key);
            setUnitSortDirection('asc');
        }
    };

    const renderSortIcon = (key: UnitSortKey) => {
        if (unitSortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return unitSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const handleDeleteUnit = (id: string) => {
        if (!firestore || !buildingId) return;
        const itemRef = doc(firestore, 'buildings', buildingId, 'units', id);
        deleteDoc(itemRef).then(() => {
            toast({ title: `Unit Deleted`, description: `The unit has been successfully removed.` })
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: itemRef.path, operation: 'delete' }));
        })
    }

    const currentQuarter = getCurrentQuarter();

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>All Units</CardTitle>
                        <CardDescription>A complete list of every unit in "{buildingName}".</CardDescription>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by unit # or owner name..."
                            className="pl-8"
                            value={unitSearchQuery}
                            onChange={(e) => setUnitSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 pt-4">
                    <span className="text-sm font-medium">Current Quarter: <span className="font-semibold">{formatQuarter(currentQuarter)}</span></span>
                    <Select onValueChange={(value) => setQuarterRange(value as QuarterRangeOption)} value={quarterRange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current_quarter">Current Quarter</SelectItem>
                            <SelectItem value="year_to_date">Year to Date</SelectItem>
                            <SelectItem value="all_since_start">All (Since Start)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleUnitSort('unitNumber')} className="px-0">
                                        Unit # {renderSortIcon('unitNumber')}
                                    </Button>
                                </TableHead>
                                {columnVisibility.type && (
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleUnitSort('type')} className="px-0">
                                            Type {renderSortIcon('type')}
                                        </Button>
                                    </TableHead>
                                )}
                                {columnVisibility.level && (
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleUnitSort('levelId')} className="px-0">
                                            Level {renderSortIcon('levelId')}
                                        </Button>
                                    </TableHead>
                                )}
                                {columnVisibility.owner && (
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleUnitSort('ownerName')} className="px-0">
                                            Owner {renderSortIcon('ownerName')}
                                        </Button>
                                    </TableHead>
                                )}
                                <TableHead>Total Due</TableHead>
                                <TableHead>Total Paid</TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => handleUnitSort('balance')} className="px-0">
                                        Balance {renderSortIcon('balance')}
                                    </Button>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredUnits && sortedAndFilteredUnits.length > 0 ? sortedAndFilteredUnits.map((unit) => {
                                const financials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0, balance: 0 };
                                return (
                                    <TableRow key={unit.id}>
                                        <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                        {columnVisibility.type && <TableCell>{unit.type}</TableCell>}
                                        {columnVisibility.level && <TableCell>{levelsMap.get(unit.levelId) || 'N/A'}</TableCell>}
                                        {columnVisibility.owner && <TableCell>{unit.ownerName}</TableCell>}
                                         <TableCell>
                                            {financials.totalDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                        </TableCell>
                                        <TableCell>
                                            {financials.totalPaid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                        </TableCell>
                                        <TableCell className={financials.balance < 0 ? 'text-destructive' : ''}>
                                            {financials.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                        </TableCell>
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
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
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
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={unitTableColSpan} className="text-center h-24">
                                        {unitSearchQuery ? `No units found for "${unitSearchQuery}".` : (building?.financialStartDate ? "No units found in this building." : "Set a Financial Start Date for the building to see unit balances.")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
