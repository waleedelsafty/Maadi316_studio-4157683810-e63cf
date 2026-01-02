

'use client';

import { useMemo, useState, useEffect, ChangeEvent, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit, Payment, Owner, GlobalUnitType } from '@/types';
import { ArrowLeft, ChevronsUpDown, DollarSign, Edit, Search, Check, ArrowUp, ArrowDown, Trash2, Eye, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { addQuarters, getYear, getQuarter, isBefore, startOfQuarter, format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import useLocalStorage from '@/hooks/use-local-storage';
import { defaultColumnVisibility, type UnitColumnVisibility } from '@/app/settings/display/page';
import { getQuartersForRange } from '@/lib/calculations';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { I18nProvider } from 'react-aria';
import { resizeImage } from '@/lib/image-utils';
import Image from 'next/image';
import { OwnerCombobox } from '@/components/owner-combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/components/app-provider';


// --- Schemas & Types ---
const paymentTypes: Payment['paymentType'][] = ['Cash', 'Bank Transfer', 'Instapay Transfer'];

const paymentFormSchema = z.object({
  unitId: z.string().min(1, "Please select a unit."),
  quarter: z.string().min(1, 'Quarter is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.any({ required_error: 'Payment date is required' }),
  paymentType: z.enum(paymentTypes),
  receiptUrl: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type UnitSortKey = 'unitNumber' | 'unitTypeId' | 'levelId' | 'ownerName' | 'balance';
type OwnerSortKey = 'name' | 'unitCount' | 'totalDue' | 'totalPaid' | 'balance';
type SortDirection = 'asc' | 'desc';

const PAYMENTS_PER_PAGE = 10;
const UNITS_PER_PAGE = 10;


// --- Main Page Component ---

export default function ReceivablesPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();
    const { quarterRange } = useApp();
    
    // Firestore Hooks
    const buildingRef = useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const levelsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'levels'), [firestore, buildingId]);
    const { data: levels } = useCollection<Level>(levelsQuery);

    const unitsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'units'), [firestore, buildingId]);
    const { data: allUnits } = useCollection<Unit>(unitsQuery);

    const paymentsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'payments'), [firestore, buildingId]);
    const { data: payments } = useCollection<Payment>(paymentsQuery);
    
    const ownersQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'owners'), [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    const globalUnitTypesQuery = useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
    const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);
    
    const unitsMap = useMemo(() => new Map((allUnits || []).map(u => [u.id, u])), [allUnits]);
    const ownersMap = useMemo(() => new Map((owners || []).map(o => [o.id, o.name])), [owners]);
    const unitTypesMap = useMemo(() => new Map((globalUnitTypes || []).map(t => [t.id, t.name])), [globalUnitTypes]);


    // --- State for Receivables ---
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState({ query: '' });
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [paymentsCurrentPage, setPaymentsCurrentPage] = useState(1);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    // --- State for Units Financial Summary ---
    const [unitSortKey, setUnitSortKey] = useState<UnitSortKey>('balance');
    const [unitSortDirection, setUnitSortDirection] = useState<SortDirection>('asc');
    const [unitSearchQuery, setUnitSearchQuery] = useState('');
    const [columnVisibility] = useLocalStorage<UnitColumnVisibility>('unit-column-visibility', defaultColumnVisibility);
    const [unitsCurrentPage, setUnitsCurrentPage] = useState(1);

    // --- State for Owner Financial Summary ---
    const [ownerSortKey, setOwnerSortKey] = useState<OwnerSortKey>('balance');
    const [ownerSortDirection, setOwnerSortDirection] = useState<SortDirection>('asc');
    const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());


    // --- Memoized calculations and derived state ---
    const quarterOptions = useMemo(() => {
        if (!building?.financialStartDate) return [];
        const options: string[] = [];
        const startDate = building.financialStartDate.toDate();
        const futureDate = addQuarters(new Date(), 3); // Show 3 future quarters
        let current = startOfQuarter(startDate);
        while (isBefore(current, futureDate)) {
            options.push(`Q${getQuarter(current)} ${getYear(current)}`);
            current = addQuarters(current, 1);
        }
        return options.reverse();
    }, [building]);

    const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: { unitId: '', quarter: quarterOptions[0], paymentType: 'Cash', notes: '', receiptUrl: '' }
    });

    useEffect(() => {
        if (quarterOptions.length > 0 && !paymentForm.getValues('quarter')) {
            paymentForm.setValue('quarter', quarterOptions[0]);
        }
    }, [quarterOptions, paymentForm]);
    
    useEffect(() => {
        const selectedUnit = unitsMap.get(selectedUnitId || '');
        if (selectedUnit) {
            paymentForm.setValue('unitId', selectedUnit.id);
            paymentForm.setValue('amount', selectedUnit.quarterlyMaintenanceFees);
        } else {
             paymentForm.resetField('unitId');
             paymentForm.resetField('amount');
        }
    }, [selectedUnitId, paymentForm, unitsMap]);
    
     const levelsMap = useMemo(() => new Map((levels || []).map(l => [l.id, l.name])), [levels]);

    const quarterStringsInRange = useMemo(() => {
        if (!building?.financialStartDate) return [];
        return getQuartersForRange(building.financialStartDate.toDate(), quarterRange);
    }, [building, quarterRange]);
    
    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        return payments.filter(p => {
            const unit = unitsMap.get(p.unitId);
            const owner = unit ? ownersMap.get(unit.ownerId) : undefined;
            const queryLower = paymentFilter.query.toLowerCase();
            
            // Apply both the text search and the global quarter range filter
            const quarterMatch = quarterStringsInRange.includes(p.quarter);
            const textMatch = !queryLower || p.notes?.toLowerCase().includes(queryLower) || String(unit?.unitNumber).toLowerCase().includes(queryLower) || String(owner).toLowerCase().includes(queryLower);
            
            return quarterMatch && textMatch;
        });
    }, [payments, unitsMap, ownersMap, paymentFilter, quarterStringsInRange]);


    const paginatedPayments = useMemo(() => {
        const startIndex = (paymentsCurrentPage - 1) * PAYMENTS_PER_PAGE;
        return filteredPayments
            .sort((a, b) => b.paymentDate.toMillis() - a.paymentDate.toMillis())
            .slice(startIndex, startIndex + PAYMENTS_PER_PAGE);
    }, [filteredPayments, paymentsCurrentPage]);

    const totalPaymentPages = Math.ceil(filteredPayments.length / PAYMENTS_PER_PAGE);

    const financialDataByUnit = useMemo(() => {
        const results = new Map<string, { totalDue: number; totalPaid: number; balance: number }>();
        if (!allUnits || !building?.financialStartDate) return results;

        allUnits.forEach(unit => {
            if (unit.parentUnitId) return; // Child units have no financials
            
            const totalDue = (unit.quarterlyMaintenanceFees || 0) * quarterStringsInRange.length;
            const totalPaid = (payments || []).filter(p => p.unitId === unit.id && quarterStringsInRange.includes(p.quarter)).reduce((sum, p) => sum + p.amount, 0);
            const balance = totalPaid - totalDue;
            results.set(unit.id, { totalDue, totalPaid, balance });
        });
        return results;
    }, [allUnits, payments, building, quarterStringsInRange]);

    const financialDataByOwner = useMemo(() => {
        const results = new Map<string, { totalDue: number; totalPaid: number; balance: number; unitCount: number }>();
        if (!owners || !allUnits) return results;

        owners.forEach(owner => {
            const ownedUnits = allUnits.filter(u => u.ownerId === owner.id);
            let ownerTotalDue = 0;
            let ownerTotalPaid = 0;

            ownedUnits.forEach(unit => {
                const unitFinancials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0 };
                ownerTotalDue += unitFinancials.totalDue;
                ownerTotalPaid += unitFinancials.totalPaid;
            });
            
            results.set(owner.id, {
                totalDue: ownerTotalDue,
                totalPaid: ownerTotalPaid,
                balance: ownerTotalPaid - ownerTotalDue,
                unitCount: ownedUnits.filter(u => !u.parentUnitId).length, // Only count parent units
            });
        });
        return results;
    }, [owners, allUnits, financialDataByUnit]);
    
    const sortedOwners = useMemo(() => {
        if (!owners) return [];
        return [...owners].sort((a, b) => {
            const dir = ownerSortDirection === 'asc' ? 1 : -1;
            const dataA = financialDataByOwner.get(a.id) || { totalDue: 0, totalPaid: 0, balance: 0, unitCount: 0 };
            const dataB = financialDataByOwner.get(b.id) || { totalDue: 0, totalPaid: 0, balance: 0, unitCount: 0 };

            switch (ownerSortKey) {
                case 'name': return a.name.localeCompare(b.name) * dir;
                case 'unitCount': return (dataA.unitCount - dataB.unitCount) * dir;
                case 'totalDue': return (dataA.totalDue - dataB.totalDue) * dir;
                case 'totalPaid': return (dataA.totalPaid - dataB.totalPaid) * dir;
                case 'balance': return (dataA.balance - dataB.balance) * dir;
                default: return 0;
            }
        });
    }, [owners, financialDataByOwner, ownerSortKey, ownerSortDirection]);

    const sortedAndFilteredUnits = useMemo(() => {
        if (!allUnits) return [];
        const filteredUnits = allUnits.filter(unit => {
            if (!unitSearchQuery) return true;
            const query = unitSearchQuery.toLowerCase();
            const ownerName = ownersMap.get(unit.ownerId)?.name || '';
            return String(unit.unitNumber || '').toLowerCase().includes(query) || ownerName.toLowerCase().includes(query);
        });

        return [...filteredUnits].sort((a, b) => {
            const dir = unitSortDirection === 'asc' ? 1 : -1;
            switch (unitSortKey) {
                case 'unitNumber': return String(a.unitNumber || '').localeCompare(String(b.unitNumber || ''), undefined, { numeric: true }) * dir;
                case 'unitTypeId': return (unitTypesMap.get(a.unitTypeId) || '').localeCompare(unitTypesMap.get(b.unitTypeId) || '') * dir;
                case 'ownerName': return (ownersMap.get(a.ownerId)?.name || '').localeCompare(ownersMap.get(b.ownerId)?.name || '') * dir;
                case 'levelId': return (levelsMap.get(a.levelId) || '').localeCompare(levelsMap.get(b.levelId) || '') * dir;
                case 'balance': return (financialDataByUnit.get(a.id)?.balance || 0) - (financialDataByUnit.get(b.id)?.balance || 0) * dir;
                default: return 0;
            }
        });
    }, [allUnits, unitSortKey, unitSortDirection, levelsMap, ownersMap, unitTypesMap, unitSearchQuery, financialDataByUnit]);
    
     const paginatedUnits = useMemo(() => {
        if (!sortedAndFilteredUnits) return [];
        const startIndex = (unitsCurrentPage - 1) * UNITS_PER_PAGE;
        return sortedAndFilteredUnits.slice(startIndex, startIndex + UNITS_PER_PAGE);
    }, [sortedAndFilteredUnits, unitsCurrentPage]);

    const totalUnitPages = sortedAndFilteredUnits ? Math.ceil(sortedAndFilteredUnits.length / UNITS_PER_PAGE) : 0;
    
    const calculationStartDate = useMemo(() => {
        if (!building?.financialStartDate) return null;
        if (quarterRange === 'current_quarter') return startOfQuarter(new Date());
        if (quarterRange === 'year_to_date') return new Date(new Date().getFullYear(), 0, 1);
        if (quarterRange.startsWith('year_')) {
            const year = parseInt(quarterRange.split('_')[1], 10);
            return new Date(year, 0, 1);
        }
        return building.financialStartDate.toDate();
    }, [building, quarterRange]);

    const unitTableColSpan = useMemo(() => (5 + (columnVisibility.type ? 1 : 0) + (columnVisibility.level ? 1 : 0) + (columnVisibility.owner ? 1 : 0)), [columnVisibility]);

    // --- Actions ---
    const handleAddPayment = async (data: z.infer<typeof paymentFormSchema>) => {
        const paymentCollectionRef = collection(firestore, 'buildings', buildingId, 'payments');
        const paymentDateAsDate = data.paymentDate.toDate(data.paymentDate.timeZone);
        const newPaymentData = { ...data, paymentDate: Timestamp.fromDate(paymentDateAsDate), createdAt: serverTimestamp() };

        addDoc(paymentCollectionRef, newPaymentData).then(() => {
            toast({ title: 'Payment Recorded', description: `Payment for ${data.quarter} has been successfully recorded.` });
            paymentForm.reset({ quarter: quarterOptions[0], paymentType: 'Cash', notes: '', receiptUrl: '' });
            setIsAddingPayment(false);
            setSelectedUnitId(null);
          }).catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: paymentCollectionRef.path, operation: 'create', requestResourceData: newPaymentData }));
          });
    };
    
    const handleUnitSort = (key: UnitSortKey) => {
        if (unitSortKey === key) setUnitSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setUnitSortKey(key); setUnitSortDirection('asc'); }
    };

    const handleOwnerSort = (key: OwnerSortKey) => {
        if (ownerSortKey === key) {
            setOwnerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setOwnerSortKey(key);
            setOwnerSortDirection('asc');
        }
    };
    
    const toggleOwnerExpansion = (ownerId: string) => {
        setExpandedOwners(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ownerId)) {
                newSet.delete(ownerId);
            } else {
                newSet.add(ownerId);
            }
            return newSet;
        });
    };

    const renderUnitSortIcon = (key: UnitSortKey) => {
        if (unitSortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return unitSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const renderOwnerSortIcon = (key: OwnerSortKey) => {
        if (ownerSortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return ownerSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const resizedDataUrl = await resizeImage(file, 800);
            paymentForm.setValue('receiptUrl', resizedDataUrl);
            setReceiptPreview(resizedDataUrl);
        } catch (error) {
            console.error("Image resize error:", error);
            toast({ variant: 'destructive', title: 'Image Error', description: 'Could not process the selected image file.' });
        }
    };
    
    // --- Render ---
    if (building && user && building.ownerId !== user.uid) {
        return <div className="text-center py-10"><p className="text-2xl font-bold">Access Denied</p><p>You do not have permission to view this section.</p><Button asChild className="mt-4"><Link href="/">Go to Homepage</Link></Button></div>;
    }

    return (
        <I18nProvider locale="en-US">
        <main className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}/financials`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Financial Dashboard
                </Button>
                 {!isAddingPayment && <Button onClick={() => setIsAddingPayment(true)}>Record New Payment</Button>}
            </div>

            <Card>
                <CardHeader className="py-2 pb-0">
                    <CardTitle>Manage Receivables (Income)</CardTitle>
                    <CardDescription>Record maintenance fee payments and view unit financial status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2">
                     {isAddingPayment && (
                        <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-4 pt-4 mt-4 border-t">
                            <h3 className="font-medium">Record a New Payment</h3>
                            <div>
                                <Label>Unit</Label>
                                <OwnerCombobox 
                                    buildingId={buildingId}
                                    owners={allUnits || []}
                                    value={selectedUnitId}
                                    onChange={setSelectedUnitId}
                                />
                                {paymentForm.formState.errors.unitId && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.unitId.message}</p>}
                                {selectedUnitId && (
                                    <div className="mt-2 text-xs text-muted-foreground border rounded-lg p-2 bg-background">
                                        <p><b>Owner:</b> {ownersMap.get(unitsMap.get(selectedUnitId)?.ownerId || '')}</p>
                                        <p><b>Quarterly Fee:</b> {(unitsMap.get(selectedUnitId)?.quarterlyMaintenanceFees || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                <div><Label>Quarter</Label><Controller name="quarter" control={paymentForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent></Select>)} />{paymentForm.formState.errors.quarter && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.quarter.message}</p>}</div>
                                <div><Label>Amount Paid</Label><Controller name="amount" control={paymentForm.control} render={({ field }) => <Input type="number" step="0.01" {...field} />} />{paymentForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>}</div>
                                <div><Label>Payment Date</Label><Controller name="paymentDate" control={paymentForm.control} render={({ field }) => (<DatePicker value={field.value} onChange={field.onChange} />)} />{paymentForm.formState.errors.paymentDate && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentDate.message as string}</p>}</div>
                                <div><Label>Payment Type</Label><Controller name="paymentType" control={paymentForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>)} />{paymentForm.formState.errors.paymentType && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentType.message}</p>}</div>
                            </div>
                            
                            <div><Label>Notes</Label><Textarea placeholder="e.g., Paid in two installments." {...paymentForm.register('notes')} /></div>
                             <div>
                                <Label>Receipt (Optional)</Label>
                                <Input type="file" accept="image/*" onChange={handleReceiptUpload} className="h-auto p-0 file:p-2 file:mr-3 file:border-0 file:bg-muted" />
                                {receiptPreview && (
                                    <div className="mt-2 relative w-32 h-32 border rounded-md">
                                        <Image src={receiptPreview} alt="Receipt preview" layout="fill" objectFit="cover" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                            onClick={() => {
                                                setReceiptPreview(null);
                                                paymentForm.setValue('receiptUrl', '');
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setIsAddingPayment(false); setSelectedUnitId(null); paymentForm.reset(); }}>Cancel</Button><Button type="submit" disabled={paymentForm.formState.isSubmitting}>{paymentForm.formState.isSubmitting ? 'Recording...' : 'Record Payment'}</Button></div>
                        </form>
                    )}
                    
                    <div className="space-y-4 pt-4">
                        
                        <Tabs defaultValue="status" className="pt-2">
                            <TabsList>
                                <TabsTrigger value="status">Unit Financial Status</TabsTrigger>
                                <TabsTrigger value="owners">Owner Financial Status</TabsTrigger>
                                <TabsTrigger value="history">Payment History</TabsTrigger>
                            </TabsList>
                            <TabsContent value="status" className="pt-4">
                                <Card>
                                    <CardHeader>
                                        <div className="flex justify-between items-center"><h2 className="text-xl font-semibold">Unit Financial Status</h2><div className="relative w-full max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by unit # or owner name..." className="pl-8" value={unitSearchQuery} onChange={(e) => setUnitSearchQuery(e.target.value)} /></div></div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader><TableRow><TableHead><Button variant="ghost" onClick={() => handleUnitSort('unitNumber')} className="px-0">Unit # {renderUnitSortIcon('unitNumber')}</Button></TableHead>{columnVisibility.type && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('unitTypeId')} className="px-0">Type {renderUnitSortIcon('unitTypeId')}</Button></TableHead>}{columnVisibility.level && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('levelId')} className="px-0">Level {renderUnitSortIcon('levelId')}</Button></TableHead>}{columnVisibility.owner && <TableHead><Button variant="ghost" onClick={() => handleUnitSort('ownerName')} className="px-0">Owner {renderUnitSortIcon('ownerName')}</Button></TableHead>}<TableHead>Total Due</TableHead><TableHead>Total Paid</TableHead><TableHead><Button variant="ghost" onClick={() => handleUnitSort('balance')} className="px-0">Balance {renderUnitSortIcon('balance')}</Button></TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {paginatedUnits && paginatedUnits.length > 0 ? paginatedUnits.map((unit) => {
                                                        const financials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0, balance: 0 };
                                                        return (
                                                            <TableRow key={unit.id}><TableCell className="font-semibold">{unit.unitNumber}</TableCell>{columnVisibility.type && <TableCell>{unitTypesMap.get(unit.unitTypeId) || unit.unitTypeId}</TableCell>}{columnVisibility.level && <TableCell>{levelsMap.get(unit.levelId) || 'N/A'}</TableCell>}{columnVisibility.owner && <TableCell>{ownersMap.get(unit.ownerId)}</TableCell>}<TableCell>{financials.totalDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell><TableCell>{financials.totalPaid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell><TableCell className={cn(financials.balance < 0 && 'text-destructive')}>{financials.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex gap-1 justify-end">
                                                                        <Button variant="ghost" size="icon" asChild>
                                                                            <Link href={`/building/${buildingId}/unit/${unit.id}/payments`} title="View Payments">
                                                                                <DollarSign className="h-4 w-4" />
                                                                            </Link>
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }) : (<TableRow><TableCell colSpan={unitTableColSpan} className="text-center h-24">{unitSearchQuery ? `No units found for "${unitSearchQuery}".` : (building?.financialStartDate ? "No units found in this building." : "Set a Financial Start Date for the building to see unit balances.")}</TableCell></TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {totalUnitPages > 1 && (
                                            <div className="flex items-center justify-end gap-2 pt-2">
                                                <Button variant="outline" size="sm" onClick={() => setUnitsCurrentPage(p => Math.max(1, p - 1))} disabled={unitsCurrentPage === 1}>Previous</Button>
                                                <span className="text-sm text-muted-foreground">Page {unitsCurrentPage} of {totalUnitPages}</span>
                                                <Button variant="outline" size="sm" onClick={() => setUnitsCurrentPage(p => Math.min(totalUnitPages, p + 1))} disabled={unitsCurrentPage === totalUnitPages}>Next</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="owners" className="pt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Owner Financial Status</CardTitle>
                                        <CardDescription>Aggregated financial status for each owner based on the selected date range.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-12"></TableHead>
                                                        <TableHead><Button variant="ghost" className="px-0" onClick={() => handleOwnerSort('name')}>Owner {renderOwnerSortIcon('name')}</Button></TableHead>
                                                        <TableHead><Button variant="ghost" className="px-0" onClick={() => handleOwnerSort('unitCount')}>Units {renderOwnerSortIcon('unitCount')}</Button></TableHead>
                                                        <TableHead><Button variant="ghost" className="px-0" onClick={() => handleOwnerSort('totalDue')}>Total Due {renderOwnerSortIcon('totalDue')}</Button></TableHead>
                                                        <TableHead><Button variant="ghost" className="px-0" onClick={() => handleOwnerSort('totalPaid')}>Total Paid {renderOwnerSortIcon('totalPaid')}</Button></TableHead>
                                                        <TableHead><Button variant="ghost" className="px-0" onClick={() => handleOwnerSort('balance')}>Total Balance {renderOwnerSortIcon('balance')}</Button></TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {sortedOwners.length > 0 ? sortedOwners.map(owner => {
                                                        const financials = financialDataByOwner.get(owner.id);
                                                        const ownedParentUnits = (allUnits || []).filter(u => u.ownerId === owner.id && !u.parentUnitId);
                                                        if (!financials || financials.unitCount === 0) return null;
                                                        
                                                        const isExpanded = expandedOwners.has(owner.id);

                                                        return (
                                                            <Fragment key={owner.id}>
                                                                <TableRow>
                                                                    <TableCell>
                                                                        {financials.unitCount > 0 && (
                                                                            <Button variant="ghost" size="icon" onClick={() => toggleOwnerExpansion(owner.id)} className="h-8 w-8">
                                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="font-semibold">{owner.name}</TableCell>
                                                                    <TableCell>{financials.unitCount}</TableCell>
                                                                    <TableCell>{financials.totalDue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                                                    <TableCell>{financials.totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                                                    <TableCell className={cn(financials.balance < 0 && "text-destructive")}>
                                                                        {financials.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="outline" size="sm" asChild>
                                                                            <Link href={`/building/${buildingId}/owners/${owner.id}?from=/building/${buildingId}/financials/receivables`}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View
                                                                            </Link>
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isExpanded && ownedParentUnits.map(unit => {
                                                                    const unitFinancials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0, balance: 0 };
                                                                    const childUnits = (unit.childUnitIds || []).map(id => unitsMap.get(id)).filter(Boolean) as Unit[];
                                                                    const isMultiLevel = childUnits.length > 0;

                                                                    return (
                                                                        <TableRow key={`sub-${unit.id}`} className="bg-muted/50 hover:bg-muted/40">
                                                                            <TableCell></TableCell>
                                                                            <TableCell colSpan={2} className="pl-8 py-2">
                                                                                <div className="flex items-center gap-2 font-medium">
                                                                                    <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                                                                                    {unitTypesMap.get(unit.unitTypeId) || 'Unit'} {unit.unitNumber}
                                                                                </div>
                                                                                {isMultiLevel && (
                                                                                    <div className="pl-6 text-xs text-muted-foreground">
                                                                                        Linked parts: {childUnits.map(c => c.unitNumber).join(', ')}
                                                                                    </div>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="py-2">{unitFinancials.totalDue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                                                            <TableCell className="py-2">{unitFinancials.totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                                                            <TableCell className={cn("py-2", unitFinancials.balance < 0 && "text-destructive")}>
                                                                                {unitFinancials.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                                                            </TableCell>
                                                                            <TableCell className="py-2"></TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </Fragment>
                                                        );
                                                    }) : (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center h-24">No owners found for this building.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="history" className="pt-4">
                                <Card>
                                    <CardHeader>
                                        <div className="flex justify-between items-center"><h3 className="font-medium">Payment History</h3>
                                            <div className="flex gap-2">
                                                <Input placeholder="Filter by unit #, owner, notes..." className="w-64" value={paymentFilter.query} onChange={(e) => setPaymentFilter(prev => ({ ...prev, query: e.target.value }))} />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Owner</TableHead><TableHead>Quarter</TableHead><TableHead>Date Paid</TableHead><TableHead>Amount</TableHead><TableHead>Type</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {paginatedPayments.length > 0 ? paginatedPayments.map((payment) => {
                                                        const unit = unitsMap.get(payment.unitId);
                                                        const ownerName = unit ? ownersMap.get(unit.ownerId) : undefined;
                                                        return (
                                                            <TableRow key={payment.id}><TableCell className="font-semibold">{unit?.unitNumber || 'N/A'}</TableCell><TableCell>{ownerName || 'N/A'}</TableCell><TableCell>{payment.quarter}</TableCell><TableCell>{payment.paymentDate.toDate().toLocaleDateString()}</TableCell><TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell><TableCell>{payment.paymentType}</TableCell><TableCell className="max-w-xs truncate">{payment.notes || '—'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" asChild>
                                                                        <Link href={`/building/${buildingId}/unit/${payment.unitId}/payments`} title="View All Payments for this Unit">
                                                                            <Edit className="h-4 w-4" />
                                                                        </Link>
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    }) : (<TableRow><TableCell colSpan={8} className="h-24 text-center">{paymentFilter.query ? "No payments match your filter." : "No payments match the selected date range."}</TableCell></TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {totalPaymentPages > 1 && (
                                            <div className="flex items-center justify-end gap-2 pt-2">
                                                <Button variant="outline" size="sm" onClick={() => setPaymentsCurrentPage(p => Math.max(1, p - 1))} disabled={paymentsCurrentPage === 1}>Previous</Button>
                                                <span className="text-sm text-muted-foreground">Page {paymentsCurrentPage} of {totalPaymentPages}</span>
                                                <Button variant="outline" size="sm" onClick={() => setPaymentsCurrentPage(p => Math.min(totalPaymentPages, p + 1))} disabled={paymentsCurrentPage === totalPaymentPages}>Next</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>
        </main>
        </I18nProvider>
    );
}
