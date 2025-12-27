
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Unit, Payment } from '@/types';
import { Edit, Search, CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addQuarters, getYear, getQuarter, isBefore, startOfQuarter, format } from 'date-fns';
import { Label } from './ui/label';

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

interface BuildingPaymentsTabProps {
    building: Building | null;
    units: (Unit & { id: string })[] | null;
    payments: (Payment & { id: string })[] | null;
}

export function BuildingPaymentsTab({ building, units, payments }: BuildingPaymentsTabProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const buildingId = building?.id || '';

    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState({ query: '', quarter: '' });

    // State for payment combobox
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState("");
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    const unitsMap = useMemo(() => {
        if (!units) return new Map();
        return new Map(units.map(u => [u.id, u]));
    }, [units]);

     const quarterOptions = useMemo(() => {
        if (!building?.financialStartDate) {
            return [];
        }
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
        defaultValues: {
            unitId: '',
            quarter: quarterOptions[0],
            paymentType: 'Cash',
            notes: '',
            receiptUrl: '',
        }
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
        const newPaymentData = {
            ...data,
            paymentDate: Timestamp.fromDate(data.paymentDate),
            createdAt: serverTimestamp(),
        };

        addDoc(paymentCollectionRef, newPaymentData)
          .then(() => {
            toast({
              title: 'Payment Recorded',
              description: `Payment for ${data.quarter} has been successfully recorded.`,
            });
            paymentForm.reset({
                quarter: quarterOptions[0],
                paymentType: 'Cash',
                notes: '',
                receiptUrl: '',
            });
            setIsAddingPayment(false);
            setSelectedUnit(null);
            setComboboxSearch("");
          })
          .catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: paymentCollectionRef.path,
                operation: 'create',
                requestResourceData: newPaymentData,
            }));
          });
    };

    return (
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
                                         <Input
                                            placeholder="Search by unit or owner..."
                                            value={comboboxSearch}
                                            onChange={(e) => setComboboxSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {comboboxFilteredUnits.length > 0 ? comboboxFilteredUnits.map(unit => (
                                            <div key={unit.id} onClick={() => {
                                                setSelectedUnit(unit);
                                                setIsComboboxOpen(false);
                                            }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                <span>Unit {unit.unitNumber} ({unit.ownerName})</span>
                                                {selectedUnit?.id === unit.id && <Check className="h-4 w-4" />}
                                            </div>
                                        )) : (
                                            <p className="p-2 text-center text-sm text-muted-foreground">No units found.</p>
                                        )}
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
                                <Controller
                                    name="quarter"
                                    control={paymentForm.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {paymentForm.formState.errors.quarter && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.quarter.message}</p>}
                            </div>
                            <div>
                                <Label>Amount Paid</Label>
                                <Input type="number" step="0.01" {...paymentForm.register('amount')} />
                                {paymentForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>}
                            </div>
                             <div>
                                <Label>Payment Date</Label>
                                 <Controller
                                    name="paymentDate"
                                    control={paymentForm.control}
                                    render={({ field }) => (
                                       <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                />
                                {paymentForm.formState.errors.paymentDate && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentDate.message}</p>}
                            </div>
                             <div>
                                <Label>Payment Type</Label>
                                 <Controller
                                    name="paymentType"
                                    control={paymentForm.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {paymentForm.formState.errors.paymentType && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentType.message}</p>}
                            </div>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Textarea placeholder="e.g., Paid in two installments." {...paymentForm.register('notes')} />
                        </div>

                         <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => {
                                setIsAddingPayment(false);
                                setSelectedUnit(null);
                                setComboboxSearch("");
                                paymentForm.reset();
                            }}>Cancel</Button>
                            <Button type="submit" disabled={paymentForm.formState.isSubmitting}>
                                {paymentForm.formState.isSubmitting ? 'Recording...' : 'Record Payment'}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium">Payment History</h3>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Filter by unit #, owner, notes..."
                                className="w-64"
                                value={paymentFilter.query}
                                onChange={(e) => setPaymentFilter(prev => ({ ...prev, query: e.target.value }))}
                            />
                            <Select
                                value={paymentFilter.quarter}
                                onValueChange={(value) => setPaymentFilter(prev => ({ ...prev, quarter: value === 'all' ? '' : value }))}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Filter by quarter..." />
                                </SelectTrigger>
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
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Quarter</TableHead>
                                    <TableHead>Date Paid</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.length > 0 ? filteredPayments
                                    .sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis())
                                    .map((payment) => {
                                        const unit = unitsMap.get(payment.unitId);
                                        return (
                                            <TableRow key={payment.id}>
                                                <TableCell className="font-semibold">{unit?.unitNumber || 'N/A'}</TableCell>
                                                <TableCell>{unit?.ownerName || 'N/A'}</TableCell>
                                                <TableCell>{payment.quarter}</TableCell>
                                                <TableCell>{format(payment.paymentDate.toDate(), 'PPP')}</TableCell>
                                                <TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                                <TableCell>{payment.paymentType}</TableCell>
                                                <TableCell className="max-w-xs truncate">{payment.notes || '—'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" disabled>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
                                                {paymentFilter.query || paymentFilter.quarter ? "No payments match your filter." : "No payments recorded yet."}
                                            </TableCell>
                                        </TableRow>
                                    )
                                }
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
