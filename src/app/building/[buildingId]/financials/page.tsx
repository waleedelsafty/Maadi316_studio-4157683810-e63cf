
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit, Payment } from '@/types';
import { ArrowLeft, ChevronsUpDown, DollarSign, Edit, Search, CalendarIcon, Check, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { addQuarters, getYear, getQuarter, isBefore, startOfQuarter, format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import useLocalStorage from '@/hooks/use-local-storage';
import { defaultColumnVisibility, type UnitColumnVisibility } from '@/app/settings/display/page';
import { getQuartersForRange, formatQuarter as formatQuarterUtil, getCurrentQuarter } from '@/lib/calculations';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


// --- Logic from BuildingPaymentsTab ---
const paymentTypes: Payment['paymentType'][] = ['Cash', 'Bank Transfer', 'Instapay Transfer'];

const paymentFormSchema = z.object({
  unitId: z.string().min(1, "Please select a unit."),
  quarter: z.string().min(1, 'Quarter is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.date({ required_error: 'Payment date is required' }),
  paymentType: z.enum(paymentTypes),
  receiptUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});


// --- Logic from BuildingUnitsTab ---
type UnitSortKey = 'unitNumber' | 'type' | 'levelId' | 'ownerName' | 'balance';
type SortDirection = 'asc' | 'desc';
type QuarterRangeOption = 'current_quarter' | 'year_to_date' | 'all_since_start';


export default function BuildingFinancialsPage() {
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

    const { data: building } = useDoc(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);

    const { data: levels } = useCollection(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection(unitsQuery);

    const paymentsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'payments'));
    }, [firestore, buildingId]);
    const { data: payments } = useCollection(paymentsQuery);

    // --- State and Logic from BuildingPaymentsTab ---
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState({ query: '', quarter: '' });
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState("");
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    const unitsMap = useMemo(() => {
        if (!units) return new Map();
        return new Map(units.map(u => [u.id, u]));
    }, [units]);

     const quarterOptions = useMemo(() => {
        if (!building?.financialStartDate) return [];
        const options: string[] = [];
        const startDate = building.financialStartDate.toDate();
        const futureDate = addQuarters(new Date(), 2);
        
        let current = startOfQuarter(startDate);

        while (isBefore(current, futureDate)) {
            options.push(`Q${getQuarter(current)} ${getYear(current)}`);
            current = addQuarters(current, 1);
        }
        return options.reverse();
     }, [building]);

    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        return payments.filter(p => {
            const unit = unitsMap.get(p.unitId);
            const queryLower = paymentFilter.query.toLowerCase();
            const quarterMatch = !paymentFilter.quarter || p.quarter === paymentFilter.quarter;
            const textMatch = !queryLower || 
                p.notes?.toLowerCase().includes(queryLower) ||
                String(unit?.unitNumber).toLowerCase().includes(queryLower) ||
                String(unit?.ownerName).toLowerCase().includes(queryLower);
            return quarterMatch && textMatch;
        });
    }, [payments, unitsMap, paymentFilter]);

    const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: { unitId: '', quarter: quarterOptions[0], paymentType: 'Cash', notes: '', receiptUrl: '' }
    });

    useEffect(() => {
        if (quarterOptions.length > 0 && !paymentForm.getValues('quarter')) {
            paymentForm.setValue('quarter', quarterOptions[0]);
        }
    }, [quarterOptions, paymentForm]);

    const comboboxFilteredUnits = useMemo(() => {
        if (!units) return [];
        if (!comboboxSearch) return units;
        const lowerQuery = comboboxSearch.toLowerCase();
        return units.filter(u => 
            String(u.unitNumber).toLowerCase().includes(lowerQuery) || 
            String(u.ownerName || '').toLowerCase().includes(lowerQuery)
        );
    }, [units, comboboxSearch]);

    useEffect(() => {
        if (selectedUnit) {
            paymentForm.setValue('unitId', selectedUnit.id);
            paymentForm.setValue('amount', selectedUnit.quarterlyMaintenanceFees);
        } else {
             paymentForm.resetField('unitId');
             paymentForm.resetField('amount');
        }
    }, [selectedUnit, paymentForm]);

    const handleAddPayment = async (data: z.infer<typeof paymentFormSchema>) => {
        if (!firestore || !buildingId) return;

        const paymentCollectionRef = collection(firestore, 'buildings', buildingId, 'payments');
        const newPaymentData = { ...data, paymentDate: Timestamp.fromDate(data.paymentDate), createdAt: serverTimestamp() };

        addDoc(paymentCollectionRef, newPaymentData).then(() => {
            toast({ title: 'Payment Recorded', description: `Payment for ${data.quarter} has been successfully recorded.` });
            paymentForm.reset({ quarter: quarterOptions[0], paymentType: 'Cash', notes: '', receiptUrl: '' });
            setIsAddingPayment(false);
            setSelectedUnit(null);
            setComboboxSearch("");
          }).catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: paymentCollectionRef.path, operation: 'create', requestResourceData: newPaymentData,
            }));
          });
    };

    // --- State and Logic from BuildingUnitsTab ---
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
            const totalPaid = (payments || []).filter(p => p.unitId === unit.id && quarterStringsInRange.includes(p.quarter)).reduce((sum, p) => sum + p.amount, 0);
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
                case 'unitNumber': return String(a.unitNumber || '').localeCompare(String(b.unitNumber || ''), undefined, { numeric: true }) * dir;
                case 'type': return (a.type || '').localeCompare(b.type || '') * dir;
                case 'ownerName': return (a.ownerName || '').localeCompare(b.ownerName || '') * dir;
                case 'levelId':
                    const levelNameA = levelsMap.get(a.levelId) || '';
                    const levelNameB = levelsMap.get(b.levelId) || '';
                    return levelNameA.localeCompare(levelNameB) * dir;
                case 'balance':
                    const balanceA = financialDataByUnit.get(a.id)?.balance || 0;
                    const balanceB = financialDataByUnit.get(b.id)?.balance || 0;
                    return (balanceA - balanceB) * dir;
                default: return 0;
            }
        });
    }, [units, unitSortKey, unitSortDirection, levelsMap, unitSearchQuery, financialDataByUnit]);

    const unitTableColSpan = useMemo(() => (
        5 + (columnVisibility.type ? 1 : 0) + (columnVisibility.level ? 1 : 0) + (columnVisibility.owner ? 1 : 0)
    ), [columnVisibility]);

    const handleUnitSort = (key: UnitSortKey) => {
        if (unitSortKey === key) {
            setUnitSortDirection(unitSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setUnitSortKey(key);
            setUnitSortDirection('asc');
        }
    };

    const renderSortIcon = (key: UnitSortKey) => {
        if (unitSortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
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
    const buildingName = (building as any)?.Building_name || (building as any)?.name || '...';

    // --- Main Component Render ---
    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this section.</p>
                <Button asChild className="mt-4"><Link href="/">Go to Homepage</Link></Button>
            </div>
        );
    }

    if (building?.isDeleted) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Building Deleted</p>
                <p>This building is in the recycle bin. You can restore it from the settings page.</p>
                <Button asChild className="mt-4"><Link href="/settings/recycle-bin">Go to Recycle Bin</Link></Button>
            </div>
        );
    }

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            {/* Payments Section */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Payments</CardTitle>
                            <CardDescription>Record and view all payments for this building.</CardDescription>
                        </div>
                        {!isAddingPayment && <Button onClick={() => setIsAddingPayment(true)}>Record New Payment</Button>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                     {isAddingPayment && (
                        <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-6 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Record a New Payment</h3>
                            <div>
                                <Label>Unit</Label>
                                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full justify-between">
                                            {selectedUnit ? `Unit ${selectedUnit.unitNumber} (${selectedUnit.ownerName})` : "Select unit..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <div className="p-2">
                                             <Input placeholder="Search by unit or owner..." value={comboboxSearch} onChange={(e) => setComboboxSearch(e.target.value)} />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {comboboxFilteredUnits.length > 0 ? comboboxFilteredUnits.map(unit => (
                                                <div key={unit.id} onClick={() => { setSelectedUnit(unit); setIsComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                    <span>Unit {unit.unitNumber} ({unit.ownerName})</span>
                                                    {selectedUnit?.id === unit.id && <Check className="h-4 w-4" />}
                                                </div>
                                            )) : <p className="p-2 text-center text-sm text-muted-foreground">No units found.</p>}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {paymentForm.formState.errors.unitId && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.unitId.message}</p>}
                                {selectedUnit && (
                                    <div className="mt-2 text-xs text-muted-foreground border rounded-lg p-2 bg-background">
                                        <p><b>Owner:</b> {selectedUnit.ownerName}</p>
                                        <p><b>Size:</b> {selectedUnit.sqm} sqm</p>
                                        <p><b>Quarterly Fee:</b> {selectedUnit.quarterlyMaintenanceFees.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                <div>
                                    <Label>Quarter</Label>
                                    <Controller name="quarter" control={paymentForm.control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                    {paymentForm.formState.errors.quarter && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.quarter.message}</p>}
                                </div>
                                <div>
                                    <Label>Amount Paid</Label>
                                    <Input type="number" step="0.01" {...paymentForm.register('amount')} />
                                    {paymentForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>}
                                </div>
                                <div>
                                    <Label>Payment Date</Label>
                                    <Controller name="paymentDate" control={paymentForm.control} render={({ field }) => (
                                       <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    )} />
                                    {paymentForm.formState.errors.paymentDate && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentDate.message}</p>}
                                </div>
                                <div>
                                    <Label>Payment Type</Label>
                                    <Controller name="paymentType" control={paymentForm.control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                    {paymentForm.formState.errors.paymentType && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentType.message}</p>}
                                </div>
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Textarea placeholder="e.g., Paid in two installments." {...paymentForm.register('notes')} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => { setIsAddingPayment(false); setSelectedUnit(null); setComboboxSearch(""); paymentForm.reset(); }}>Cancel</Button>
                                <Button type="submit" disabled={paymentForm.formState.isSubmitting}>{paymentForm.formState.isSubmitting ? 'Recording...' : 'Record Payment'}</Button>
                            </div>
                        </form>
                    )}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium">Payment History</h3>
                            <div className="flex gap-2">
                                <Input placeholder="Filter by unit #, owner, notes..." className="w-64" value={paymentFilter.query} onChange={(e) => setPaymentFilter(prev => ({ ...prev, query: e.target.value }))} />
                                <Select value={paymentFilter.quarter} onValueChange={(value) => setPaymentFilter(prev => ({ ...prev, quarter: value === 'all' ? '' : value }))}>
                                    <SelectTrigger className="w-48"><SelectValue placeholder="Filter by quarter..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Quarters</SelectItem>
                                        {quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Unit</TableHead><TableHead>Owner</TableHead><TableHead>Quarter</TableHead><TableHead>Date Paid</TableHead>
                                        <TableHead>Amount</TableHead><TableHead>Type</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPayments.length > 0 ? filteredPayments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => {
                                        const unit = unitsMap.get(payment.unitId);
                                        return (
                                            <TableRow key={payment.id}>
                                                <TableCell className="font-semibold">{unit?.unitNumber || 'N/A'}</TableCell><TableCell>{unit?.ownerName || 'N/A'}</TableCell>
                                                <TableCell>{payment.quarter}</TableCell><TableCell>{format(payment.paymentDate.toDate(), 'PPP')}</TableCell>
                                                <TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                                <TableCell>{payment.paymentType}</TableCell><TableCell className="max-w-xs truncate">{payment.notes || '—'}</TableCell>
                                                <TableCell className="text-right"><Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4" /></Button></TableCell>
                                            </TableRow>
                                        )
                                    }) : (
                                        <TableRow><TableCell colSpan={8} className="h-24 text-center">{paymentFilter.query || paymentFilter.quarter ? "No payments match your filter." : "No payments recorded yet."}</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Units Financial Summary Section */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>All Units Financial Status</CardTitle>
                            <CardDescription>A complete financial overview of every unit in "{buildingName}".</CardDescription>
                        </div>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by unit # or owner name..." className="pl-8" value={unitSearchQuery} onChange={(e) => setUnitSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-4">
                        <span className="text-sm font-medium">Current Quarter: <span className="font-semibold">{formatQuarterUtil(currentQuarter)}</span></span>
                        <Select onValueChange={(value) => setQuarterRange(value as QuarterRangeOption)} value={quarterRange}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Range" /></SelectTrigger>
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
                                    <TableHead><Button variant="ghost" onClick={() => handleUnitSort('unitNumber')} className="px-0">Unit # {renderSortIcon('unitNumber')}</Button></TableHead>
                                    {columnVisibility.type && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('type')} className="px-0">Type {renderSortIcon('type')}</Button></TableHead>}
                                    {columnVisibility.level && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('levelId')} className="px-0">Level {renderSortIcon('levelId')}</Button></TableHead>}
                                    {columnVisibility.owner && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('ownerName')} className="px-0">Owner {renderSortIcon('ownerName')}</Button></TableHead>}
                                    <TableHead>Total Due</TableHead><TableHead>Total Paid</TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleUnitSort('balance')} className="px-0">Balance {renderSortIcon('balance')}</Button></TableHead>
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
                                             <TableCell>{financials.totalDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                            <TableCell>{financials.totalPaid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                            <TableCell className={financials.balance < 0 ? 'text-destructive' : ''}>{financials.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="outline" size="sm" asChild><Link href={`/building/${buildingId}/unit/${unit.id}/payments`}><DollarSign className="mr-2 h-4 w-4" /> Payments</Link></Button>
                                                    <Button variant="outline" size="sm" asChild><Link href={`/building/${buildingId}/unit/${unit.id}/edit`}>Edit</Link></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete unit "{unit.unitNumber}".</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteUnit(unit.id)}>Continue</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow><TableCell colSpan={unitTableColSpan} className="text-center h-24">{unitSearchQuery ? `No units found for "${unitSearchQuery}".` : (building?.financialStartDate ? "No units found in this building." : "Set a Financial Start Date for the building to see unit balances.")}</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
