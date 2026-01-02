
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, updateDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Payable, Employee, ServiceProvider, GlobalUtilityType, GlobalPayableCategory } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { parseDate, getLocalTimeZone } from '@internationalized/date';
import { I18nProvider } from 'react-aria';
import { Skeleton } from '@/components/ui/skeleton';
import { resizeImage } from '@/lib/image-utils';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const payableFormSchema = z.object({
    categoryTypeId: z.string().min(1, 'Category is required'),
    utilityTypeId: z.string().optional().nullable(),
    employeeId: z.string().optional().nullable(),
    serviceProviderId: z.string().optional().nullable(),
    description: z.string().min(3, "Description is required."),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    expenseDate: z.any({ required_error: 'Expense date is required' }),
    vendor: z.string().optional(),
    receiptUrl: z.string().optional().or(z.literal('')),
    notes: z.string().optional(),
});

interface ExpenseEditDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    payable: Payable | null;
}

export function ExpenseEditDialog({ isOpen, onOpenChange, buildingId, payable }: ExpenseEditDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);

    // --- Data Fetching ---
    const employeesQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'employees'), [firestore, buildingId]);
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const providersQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'serviceProviders'), [firestore, buildingId]);
    const { data: serviceProviders } = useCollection<ServiceProvider>(providersQuery);
    
    const globalUtilityTypesQuery = React.useMemo(() => collection(firestore, 'globalUtilityTypes'), [firestore]);
    const { data: globalUtilityTypes } = useCollection<GlobalUtilityType>(globalUtilityTypesQuery);
    
    const globalPayableCategoriesQuery = React.useMemo(() => collection(firestore, 'globalPayableCategories'), [firestore]);
    const { data: globalPayableCategories } = useCollection<GlobalPayableCategory>(globalPayableCategoriesQuery);

    const categoriesMap = React.useMemo(() => new Map(globalPayableCategories?.map(c => [c.id, c])), [globalPayableCategories]);
    
    // --- Form Setup ---
    const form = useForm<z.infer<typeof payableFormSchema>>({
        resolver: zodResolver(payableFormSchema),
    });
    
    const isLoading = !payable || !globalPayableCategories || !globalUtilityTypes || !employees || !serviceProviders;

    // --- Effect to Populate Form ---
    React.useEffect(() => {
        if (payable && globalPayableCategories && employees && serviceProviders && globalUtilityTypes) {
            setReceiptPreview(payable.receiptUrl || null);
            form.reset({
                ...payable,
                expenseDate: payable.expenseDate ? parseDate(payable.expenseDate.toDate().toISOString().split('T')[0]) : null,
            });
        }
    }, [payable, globalPayableCategories, employees, serviceProviders, globalUtilityTypes, form, isOpen]);


    const selectedCategoryTypeId = form.watch('categoryTypeId');
    const selectedCategory = React.useMemo(() => categoriesMap.get(selectedCategoryTypeId), [categoriesMap, selectedCategoryTypeId]);
    
    const handleFormSubmit = async (data: z.infer<typeof payableFormSchema>) => {
        if (!data.expenseDate || !payable) {
            toast({ variant: 'destructive', title: 'Error', description: 'Form is not ready.' });
            return;
        }

        const payableRef = doc(firestore, 'buildings', buildingId, 'payables', payable.id);
        const category = categoriesMap.get(data.categoryTypeId);
        const expenseDateAsDate = data.expenseDate.toDate(getLocalTimeZone());
        
        const submissionData: Partial<Payable> = {
            ...data,
            expenseDate: Timestamp.fromDate(expenseDateAsDate),
            employeeId: category?.linksTo === 'employee' ? data.employeeId : null,
            serviceProviderId: category?.linksTo === 'serviceProvider' ? data.serviceProviderId : null,
            utilityTypeId: category?.linksTo === 'utility' ? data.utilityTypeId : null,
        };
        
        updateDoc(payableRef, submissionData).then(() => {
            toast({ title: 'Expense Updated', description: 'The expense record has been updated.' });
            onOpenChange(false);
        }).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: payableRef.path, operation: 'update', requestResourceData: submissionData }));
        });
    };
    
    const showEmployeeSelect = selectedCategory?.linksTo === 'employee';
    const showProviderSelect = selectedCategory?.linksTo === 'serviceProvider';
    const showUtilitySelect = selectedCategory?.linksTo === 'utility';

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const resizedDataUrl = await resizeImage(file, 800);
            form.setValue('receiptUrl', resizedDataUrl);
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
                    <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Edit Expense</DialogTitle>
                            <DialogDescription>Make changes to this expense record. Click "Save Changes" when you're done.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-6 max-h-[70vh] overflow-y-auto px-1">
                            {isLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Category</Label>
                                            <Controller name="categoryTypeId" control={form.control} render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger><SelectValue placeholder="Select a category..." /></SelectTrigger>
                                                    <SelectContent>{globalPayableCategories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )} />
                                            {form.formState.errors.categoryTypeId && <p className="text-red-500 text-xs mt-1">{form.formState.errors.categoryTypeId.message}</p>}
                                        </div>
                                        
                                        {showUtilitySelect && (
                                            <div>
                                                <Label>Utility Type</Label>
                                                <Controller name="utilityTypeId" control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select utility type..." /></SelectTrigger>
                                                        <SelectContent>{globalUtilityTypes?.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )} />
                                            </div>
                                        )}
                                        
                                        {showEmployeeSelect && (
                                            <div>
                                                <Label>Employee</Label>
                                                <Controller name="employeeId" control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select an employee..."/></SelectTrigger>
                                                        <SelectContent>{employees?.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )} />
                                            </div>
                                        )}
                                        
                                        {showProviderSelect && (
                                            <div>
                                                <Label>Service Provider</Label>
                                                <Controller name="serviceProviderId" control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <SelectTrigger><SelectValue placeholder="Select a provider..."/></SelectTrigger>
                                                        <SelectContent>{serviceProviders?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Expense Date</Label>
                                            <Controller name="expenseDate" control={form.control} render={({ field }) => (<DatePicker value={field.value} onChange={field.onChange} />)} />
                                            {form.formState.errors.expenseDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.expenseDate.message as string}</p>}
                                        </div>
                                        <div>
                                            <Label>Amount Paid</Label>
                                            <Input type="number" step="0.01" {...form.register('amount')} />
                                            {form.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{form.formState.errors.amount.message}</p>}
                                        </div>
                                    </div>
                                    
                                    <div><Label>Description</Label><Input {...form.register('description')} />{form.formState.errors.description && <p className="text-red-500 text-xs mt-1">{form.formState.errors.description.message}</p>}</div>
                                    
                                    {!showEmployeeSelect && !showProviderSelect && !showUtilitySelect && (
                                        <div><Label>Vendor / Payee</Label><Input {...form.register('vendor')} /></div>
                                    )}

                                    <div><Label>Notes</Label><Textarea {...form.register('notes')} /></div>

                                    <div>
                                        <Label>Receipt</Label>
                                        <div className="flex gap-4 items-start">
                                            <Input type="file" accept="image/*" onChange={handleReceiptUpload} className="h-auto p-0 file:p-2 file:mr-3 file:border-0 file:bg-muted flex-grow" />
                                            {receiptPreview && (
                                                <div className="relative w-24 h-24 border rounded-md flex-shrink-0">
                                                    <Image src={receiptPreview} alt="Receipt preview" layout="fill" objectFit="cover" />
                                                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setReceiptPreview(null); form.setValue('receiptUrl', ''); }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>{form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </I18nProvider>
        </Dialog>
    );
}
