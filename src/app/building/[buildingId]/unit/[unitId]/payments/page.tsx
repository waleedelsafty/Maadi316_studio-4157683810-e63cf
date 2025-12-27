
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, where, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Unit } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CalendarIcon, Edit, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const paymentTypes: Payment['paymentType'][] = ['Cash', 'Bank Transfer', 'Instapay Transfer'];

const generateQuarterOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear + 1; year >= currentYear - 5; year--) {
        for (let q = 4; q >= 1; q--) {
            options.push(`Q${q} ${year}`);
        }
    }
    return options;
};
const quarterOptions = generateQuarterOptions();

const formSchema = z.object({
  quarter: z.string().min(1, 'Quarter is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.date({ required_error: 'Payment date is required' }),
  paymentType: z.enum(paymentTypes),
  receiptUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export default function UnitPaymentsPage() {
  const { buildingId, unitId } = useParams() as { buildingId: string; unitId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [editingPaymentId, setEditingPaymentId] = React.useState<string | null>(null);
  
  const unitRef = React.useMemo(() => {
    if (!firestore || !buildingId || !unitId) return null;
    return doc(firestore, 'buildings', buildingId, 'units', unitId);
  }, [firestore, buildingId, unitId]);

  const { data: unit } = useDoc(unitRef);

  const paymentsQuery = React.useMemo(() => {
    if (!firestore || !buildingId || !unitId) return null;
    return query(collection(firestore, 'buildings', buildingId, 'payments'), where('unitId', '==', unitId));
  }, [firestore, buildingId, unitId]);

  const { data: payments } = useCollection(paymentsQuery);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    setValue,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        quarter: quarterOptions[0],
        paymentType: 'Cash',
        notes: '',
        receiptUrl: '',
    }
  });

  React.useEffect(() => {
    if (unit && !editingPaymentId) {
        setValue('amount', unit.quarterlyMaintenanceFees);
    }
  }, [unit, editingPaymentId, setValue]);
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!firestore || !buildingId || !unitId) return;

    const paymentCollectionRef = collection(firestore, 'buildings', buildingId, 'payments');
    
    if (editingPaymentId) {
        // Update existing payment
        const paymentDocRef = doc(firestore, 'buildings', buildingId, 'payments', editingPaymentId);
        const updatedPaymentData = {
            ...data,
            paymentDate: Timestamp.fromDate(data.paymentDate),
        };
        updateDoc(paymentDocRef, updatedPaymentData).then(() => {
            toast({ title: 'Payment Updated', description: 'The payment record has been updated.' });
            setEditingPaymentId(null);
            reset({
                quarter: quarterOptions[0],
                amount: unit?.quarterlyMaintenanceFees,
                paymentType: 'Cash',
                notes: '',
                receiptUrl: '',
            });
        }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: paymentDocRef.path,
                operation: 'update',
                requestResourceData: updatedPaymentData,
            }));
        });
    } else {
        // Add new payment
        const newPaymentData = {
            ...data,
            unitId,
            paymentDate: Timestamp.fromDate(data.paymentDate),
            createdAt: serverTimestamp(),
        };

        addDoc(paymentCollectionRef, newPaymentData)
          .then(() => {
            toast({
              title: 'Payment Recorded',
              description: `Payment for ${data.quarter} has been successfully recorded.`,
            });
             reset({
                quarter: quarterOptions[0],
                amount: unit?.quarterlyMaintenanceFees,
                paymentType: 'Cash',
                notes: '',
                receiptUrl: '',
            });
          })
          .catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: paymentCollectionRef.path,
                operation: 'create',
                requestResourceData: newPaymentData,
            }));
          });
    }
  };

  const handleEditClick = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    reset({
        quarter: payment.quarter,
        amount: payment.amount,
        paymentDate: payment.paymentDate.toDate(),
        paymentType: payment.paymentType,
        receiptUrl: payment.receiptUrl,
        notes: payment.notes,
    });
  }

  const handleCancelEdit = () => {
    setEditingPaymentId(null);
    reset({
        quarter: quarterOptions[0],
        amount: unit?.quarterlyMaintenanceFees,
        paymentType: 'Cash',
        notes: '',
        receiptUrl: '',
    });
  }
  
  const handleDeletePayment = (paymentId: string) => {
      if (!firestore || !buildingId) return;
      const paymentRef = doc(firestore, 'buildings', buildingId, 'payments', paymentId);
      deleteDoc(paymentRef)
        .then(() => {
            toast({ title: "Payment Deleted", description: "The payment record has been removed." });
        })
        .catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: paymentRef.path, operation: 'delete' }));
        });
  };

  return (
    <main className="w-full max-w-4xl space-y-6">
        <div className="mb-2">
             <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                <ArrowLeft className="h-4 w-4" /> Back to Level View
            </Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>{editingPaymentId ? "Edit Payment" : "Record a New Payment"}</CardTitle>
                <CardDescription>
                    {editingPaymentId ? `Editing payment record for Unit ${unit?.unitNumber || '...'}` : `Record a new maintenance fee payment for Unit ${unit?.unitNumber || '...'}.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="quarter">Quarter</Label>
                             <Controller
                                name="quarter"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.quarter && <p className="text-red-500 text-xs mt-1">{errors.quarter.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="amount">Amount Paid</Label>
                            <Input id="amount" type="number" step="0.01" {...register('amount')} />
                            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="paymentDate">Payment Date</Label>
                             <Controller
                                name="paymentDate"
                                control={control}
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
                            {errors.paymentDate && <p className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="paymentType">Payment Type</Label>
                             <Controller
                                name="paymentType"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.paymentType && <p className="text-red-500 text-xs mt-1">{errors.paymentType.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="receiptUrl">Receipt URL</Label>
                        <Input id="receiptUrl" placeholder="https://example.com/receipt.jpg" {...register('receiptUrl')} />
                        {errors.receiptUrl && <p className="text-red-500 text-xs mt-1">{errors.receiptUrl.message}</p>}
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" placeholder="e.g., Paid in two installments." {...register('notes')} />
                        {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
                    </div>

                     <div className="flex justify-end gap-2">
                        {editingPaymentId && <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>}
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (editingPaymentId ? 'Update Payment' : 'Record Payment')}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>A complete history of all payments recorded for this unit.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quarter</TableHead>
                                <TableHead>Date Paid</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments && payments.length > 0 ? payments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => (
                                <TableRow key={payment.id} className={cn(editingPaymentId === payment.id && "bg-muted/50")}>
                                    <TableCell className="font-semibold">{payment.quarter}</TableCell>
                                    <TableCell>{format(payment.paymentDate.toDate(), 'PPP')}</TableCell>
                                    <TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                    <TableCell>{payment.paymentType}</TableCell>
                                    <TableCell className="max-w-xs truncate">{payment.notes || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(payment)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete this payment record.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeletePayment(payment.id)}>Continue</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                 <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No payments have been recorded for this unit yet.
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
