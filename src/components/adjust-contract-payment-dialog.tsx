
'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { ServiceProvider } from '@/types';
import { today, getLocalTimeZone, type CalendarDate } from '@internationalized/date';
import { I18nProvider } from 'react-aria';

type AdjustContractPaymentDialogProps = {
    provider: ServiceProvider;
    buildingId: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export function AdjustContractPaymentDialog({ provider, buildingId, isOpen, onOpenChange }: AdjustContractPaymentDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newAmount, setNewAmount] = useState<number | ''>('');
    const [effectiveDate, setEffectiveDate] = useState<CalendarDate | null>(today(getLocalTimeZone()));
    const [changeReason, setChangeReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newAmount === '' || !effectiveDate || !firestore) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please provide a new payment amount and an effective date.' });
            return;
        }

        setIsSaving(true);
        const paymentHistoryRef = collection(firestore, 'buildings', buildingId, 'serviceProviders', provider.id, 'paymentHistory');
        const effectiveDateAsDate = effectiveDate.toDate(getLocalTimeZone());
        
        const newPaymentRecord = {
            amount: Number(newAmount),
            effectiveDate: Timestamp.fromDate(effectiveDateAsDate),
            changeReason,
        };

        addDoc(paymentHistoryRef, newPaymentRecord)
            .then(() => {
                toast({ title: 'Payment Adjusted', description: `Payment for ${provider.name} has been updated.` });
                setNewAmount('');
                setEffectiveDate(today(getLocalTimeZone()));
                setChangeReason('');
                onOpenChange(false);
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: paymentHistoryRef.path, operation: 'create', requestResourceData: newPaymentRecord
                }));
            })
            .finally(() => setIsSaving(false));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
             <I18nProvider locale="en-US">
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Adjust Payment for {provider.name}</DialogTitle>
                        <DialogDescription>
                            Log a new payment amount and the date it becomes effective. This will create a historical record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-amount" className="text-right">New Amount</Label>
                            <Input id="new-amount" type="number" value={newAmount} onChange={(e) => setNewAmount(Number(e.target.value))} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="effective-date" className="text-right">Effective Date</Label>
                            <div className="col-span-3">
                                <DatePicker 
                                    value={effectiveDate}
                                    onChange={setEffectiveDate}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="change-reason" className="text-right">Reason</Label>
                            <Input id="change-reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className="col-span-3" placeholder="e.g., Annual contract renewal" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Adjustment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            </I18nProvider>
        </Dialog>
    );
}
