
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { doc, addDoc, serverTimestamp, collection, Timestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Unit, Building } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { format, getYear, getQuarter, isBefore, startOfQuarter, addQuarters } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { parseDate, getLocalTimeZone } from '@internationalized/date';
import { I18nProvider } from 'react-aria';
import { resizeImage } from '@/lib/image-utils';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';


const paymentTypes: Payment['paymentType'][] = ['Cash', 'Bank Transfer', 'Instapay Transfer'];

const formSchema = z.object({
  quarter: z.string().min(1, 'Quarter is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.any({ required_error: 'Payment date is required' }),
  paymentType: z.enum(paymentTypes),
  receiptUrl: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
});

interface PaymentFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    building: Building;
    unit: Unit;
    existingPayment: Payment | null;
}

export function PaymentFormDialog({ isOpen, onOpenChange, building, unit, existingPayment }: PaymentFormDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);
    const isEditing = !!existingPayment;

    const quarterOptions = React.useMemo(() => {
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

    const currentQuarterString = `Q${getQuarter(new Date())} ${getYear(new Date())}`;

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        control,
        setValue,
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            if (existingPayment) {
                 reset({
                    quarter: existingPayment.quarter,
                    amount: existingPayment.amount,
                    paymentDate: existingPayment.paymentDate ? parseDate(existingPayment.paymentDate.toDate().toISOString().split('T')[0]) : null,
                    paymentType: existingPayment.paymentType,
                    receiptUrl: existingPayment.receiptUrl,
                    notes: existingPayment.notes,
                });
                setReceiptPreview(existingPayment.receiptUrl || null);
            } else {
                 reset({
                    quarter: quarterOptions.includes(currentQuarterString) ? currentQuarterString : quarterOptions[0],
                    amount: unit.quarterlyMaintenanceFees,
                    paymentType: 'Cash',
                    notes: '',
                    receiptUrl: '',
                    paymentDate: null,
                });
                setReceiptPreview(null);
            }
        }
    }, [isOpen, existingPayment, unit, quarterOptions, currentQuarterString, reset]);


    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!firestore || !building.id || !unit.id) return;

        const paymentCollectionRef = collection(firestore, 'buildings', building.id, 'payments');
        const paymentDateAsDate = data.paymentDate.toDate(getLocalTimeZone());
        
        if (isEditing) {
            const paymentDocRef = doc(firestore, 'buildings', building.id, 'payments', existingPayment.id);
            const updatedPaymentData = { ...data, paymentDate: Timestamp.fromDate(paymentDateAsDate) };
            
            updateDoc(paymentDocRef, updatedPaymentData).then(() => {
                toast({ title: 'Payment Updated', description: 'The payment record has been updated.' });
                onOpenChange(false);
            }).catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: paymentDocRef.path, operation: 'update', requestResourceData: updatedPaymentData,
                }));
            });
        } else {
            const newPaymentData = { ...data, unitId: unit.id, paymentDate: Timestamp.fromDate(paymentDateAsDate), createdAt: serverTimestamp() };

            addDoc(paymentCollectionRef, newPaymentData).then(() => {
                toast({ title: 'Payment Recorded', description: `Payment for ${data.quarter} has been successfully recorded.` });
                onOpenChange(false);
            }).catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: paymentCollectionRef.path, operation: 'create', requestResourceData: newPaymentData }));
            });
        }
    };
    
    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const resizedDataUrl = await resizeImage(file, 800);
            setValue('receiptUrl', resizedDataUrl);
            setReceiptPreview(resizedDataUrl);
        } catch (error) {
            console.error("Image resize error:", error);
            toast({ variant: 'destructive', title: 'Image Error', description: 'Could not process the selected image file.' });
        }
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <I18nProvider locale="en-US">
            <DialogContent className="sm:max-w-xl">
                 <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Payment Record' : 'Record New Payment'}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? `Editing a payment record for Unit ${unit.unitNumber}.` : `Record a new payment for Unit ${unit.unitNumber}.`}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-6">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="quarter">Quarter</Label>
                                <Controller name="quarter" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                                {errors.quarter && <p className="text-red-500 text-xs mt-1">{errors.quarter.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="amount">Amount Paid</Label>
                                <Input id="amount" type="number" step="0.01" {...register('amount')} />
                                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="paymentDate">Payment Date</Label>
                                <Controller name="paymentDate" control={control} render={({ field }) => ( <DatePicker value={field.value} onChange={field.onChange} /> )} />
                                {errors.paymentDate && <p className="text-red-500 text-xs mt-1">{errors.paymentDate.message as string}</p>}
                            </div>
                            <div>
                                <Label htmlFor="paymentType">Payment Type</Label>
                                <Controller name="paymentType" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                                {errors.paymentType && <p className="text-red-500 text-xs mt-1">{errors.paymentType.message}</p>}
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" placeholder="e.g., Paid in two installments." {...register('notes')} />
                            {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
                        </div>
                        <div className="flex gap-4 items-start">
                             <div className="flex-grow">
                                <Label>Receipt (Optional)</Label>
                                <Input type="file" accept="image/*" onChange={handleReceiptUpload} className="h-auto p-0 file:p-2 file:mr-3 file:border-0 file:bg-muted" />
                            </div>
                             {receiptPreview && (
                                <div className="mt-2 relative w-32 h-32 border rounded-md flex-shrink-0">
                                    <Image src={receiptPreview} alt="Receipt preview" layout="fill" objectFit="cover" />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                        onClick={() => {
                                            setReceiptPreview(null);
                                            setValue('receiptUrl', '');
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (isEditing ? 'Update Payment' : 'Record Payment')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            </I18nProvider>
        </Dialog>
    );
}

