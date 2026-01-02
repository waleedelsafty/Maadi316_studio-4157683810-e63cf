
'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Employee, SalaryHistory } from '@/types';
import { today, getLocalTimeZone, type CalendarDate, parseDate } from '@internationalized/date';
import { I18nProvider } from 'react-aria';

type AdjustSalaryDialogProps = {
    employee: Employee;
    buildingId: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    existingRecord?: SalaryHistory | null;
};

export function AdjustSalaryDialog({ employee, buildingId, isOpen, onOpenChange, existingRecord }: AdjustSalaryDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [amount, setAmount] = useState<number | ''>('');
    const [effectiveDate, setEffectiveDate] = useState<CalendarDate | null>(today(getLocalTimeZone()));
    const [changeReason, setChangeReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isEditing = !!existingRecord;

    useEffect(() => {
        if (isOpen && existingRecord) {
            setAmount(existingRecord.amount);
            setEffectiveDate(parseDate(existingRecord.effectiveDate.toDate().toISOString().split('T')[0]));
            setChangeReason(existingRecord.changeReason || '');
        } else if (isOpen && !existingRecord) {
            // Reset for new entry
            setAmount('');
            setEffectiveDate(today(getLocalTimeZone()));
            setChangeReason('');
        }
    }, [isOpen, existingRecord]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount === '' || !effectiveDate || !firestore) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please provide a new salary and an effective date.' });
            return;
        }

        setIsSaving(true);
        const effectiveDateAsDate = effectiveDate.toDate(getLocalTimeZone());
        
        const salaryRecordData = {
            amount: Number(amount),
            effectiveDate: Timestamp.fromDate(effectiveDateAsDate),
            changeReason,
        };

        try {
            if (isEditing) {
                const recordRef = doc(firestore, 'buildings', buildingId, 'employees', employee.id, 'salaryHistory', existingRecord.id);
                await updateDoc(recordRef, salaryRecordData);
                toast({ title: 'Salary Record Updated', description: `The salary adjustment for ${employee.name} has been saved.` });
            } else {
                const salaryHistoryRef = collection(firestore, 'buildings', buildingId, 'employees', employee.id, 'salaryHistory');
                await addDoc(salaryHistoryRef, salaryRecordData);
                toast({ title: 'Salary Adjusted', description: `Salary for ${employee.name} has been updated.` });
            }
            onOpenChange(false);
        } catch (error) {
             const path = isEditing
                ? `/buildings/${buildingId}/employees/${employee.id}/salaryHistory/${existingRecord.id}`
                : `/buildings/${buildingId}/employees/${employee.id}/salaryHistory`;
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path, operation: isEditing ? 'update' : 'create', requestResourceData: salaryRecordData
            }));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
             <I18nProvider locale="en-US">
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Salary Record' : `Adjust Salary for ${employee.name}`}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? 'Update the details for this historical salary record.' : 'Log a new salary amount and the date it becomes effective.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-salary" className="text-right">Salary Amount</Label>
                            <Input id="new-salary" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="col-span-3" required />
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
                            <Input id="change-reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className="col-span-3" placeholder="e.g., Annual review" />
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
