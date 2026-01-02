
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, } from 'firebase/firestore';
import type { Payment, Unit, Building, Owner } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Trash2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { I18nProvider } from 'react-aria';
import Image from 'next/image';
import { getQuartersForRange } from '@/lib/calculations';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentFormDialog } from '@/components/payment-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { deleteDoc } from 'firebase/firestore';


export default function UnitPaymentsPage() {
  const { buildingId, unitId } = useParams() as { buildingId: string; unitId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // State
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<Payment | null>(null);
  const [highlightedPaymentId, setHighlightedPaymentId] = React.useState<string | null>(null);
  
  const buildingRef = React.useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
  const { data: building } = useDoc<Building>(buildingRef);

  const unitRef = React.useMemo(() => doc(firestore, 'buildings', buildingId, 'units', unitId), [firestore, buildingId, unitId]);
  const { data: unit } = useDoc<Unit>(unitRef);

  const ownerRef = React.useMemo(() => {
    if (!firestore || !buildingId || !unit?.ownerId) return null;
    return doc(firestore, 'buildings', buildingId, 'owners', unit.ownerId);
  }, [firestore, buildingId, unit]);
  const { data: owner } = useDoc<Owner>(ownerRef);

  const paymentsQuery = React.useMemo(() => {
    if (!firestore || !buildingId || !unitId) return null;
    return query(collection(firestore, 'buildings', buildingId, 'payments'), where('unitId', '==', unitId));
  }, [firestore, buildingId, unitId]);
  const { data: payments } = useCollection<Payment>(paymentsQuery);

  const handleEditClick = (payment: Payment) => {
    setEditingPayment(payment);
    setIsFormOpen(true);
  };
  
  const handleAddNewClick = () => {
      setEditingPayment(null);
      setIsFormOpen(true);
  };

  const handleDeletePayment = (paymentId: string) => {
      if (!firestore || !buildingId) return;
      const paymentRef = doc(firestore, 'buildings', buildingId, 'payments', paymentId);
      deleteDoc(paymentRef)
        .then(() => {
            toast({ title: "Payment Deleted", description: "The payment record has been removed." });
            if (highlightedPaymentId === paymentId) {
                setHighlightedPaymentId(null);
            }
        })
        .catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: paymentRef.path, operation: 'delete' }));
        });
  };

  const quartersInRange = React.useMemo(() => {
    if (!building?.financialStartDate) return [];
    return getQuartersForRange(building.financialStartDate.toDate(), 'all_since_start');
  }, [building]);

  const currentBalance = React.useMemo(() => {
      if (!unit || !payments || quartersInRange.length === 0) return 0;
      const totalDue = (unit.quarterlyMaintenanceFees || 0) * quartersInRange.length;
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      return totalPaid - totalDue;
  }, [unit, payments, quartersInRange]);
  
  const highlightedPayment = React.useMemo(() => {
    if (!highlightedPaymentId || !payments) return null;
    return payments.find(p => p.id === highlightedPaymentId) || null;
  }, [highlightedPaymentId, payments]);

  const isLoading = !unit || !owner || !building || payments === null;

  return (
    <I18nProvider locale="en-US">
    <main className="w-full max-w-6xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0 h-auto py-1">
            <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        
        <Card>
            <CardHeader>
                <CardTitle>Unit Financials</CardTitle>
                 {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                    </div>
                ) : (
                    <CardDescription>
                       Manage payments for Unit {unit.unitNumber}, owned by {owner.name}.
                    </CardDescription>
                )}
            </CardHeader>
             <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border p-4 rounded-lg">
                    <div>
                        <div className="text-muted-foreground">Quarterly Fee</div>
                        <div className="font-semibold">{isLoading ? <Skeleton className="h-5 w-20"/> : (unit.quarterlyMaintenanceFees || 0).toLocaleString(undefined, {style: 'currency', currency: 'USD'})}</div>
                    </div>
                     <div>
                        <div className="text-muted-foreground">Total Paid (All Time)</div>
                        <div className="font-semibold">{isLoading ? <Skeleton className="h-5 w-20"/> : (payments || []).reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, {style: 'currency', currency: 'USD'})}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Current Balance</div>
                         <div className={cn("font-semibold", currentBalance < 0 && "text-destructive")}>
                            {isLoading ? <Skeleton className="h-5 w-20"/> : currentBalance.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Payment History</CardTitle>
                            <Button onClick={handleAddNewClick}>Record New Payment</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Quarter</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments && payments.length > 0 ? payments.sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis()).map((payment) => (
                                        <TableRow 
                                        key={payment.id} 
                                        className={cn("cursor-pointer", highlightedPaymentId === payment.id && "bg-muted hover:bg-muted")}
                                        onClick={() => setHighlightedPaymentId(payment.id)}
                                        >
                                            <TableCell className="font-semibold">{payment.quarter}</TableCell>
                                            <TableCell>{format(payment.paymentDate.toDate(), 'PPP')}</TableCell>
                                            <TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1 justify-end">
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
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No payments have been recorded for this unit yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Receipt Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-square w-full bg-muted rounded-md flex items-center justify-center relative overflow-hidden">
                            {highlightedPayment?.receiptUrl ? (
                                <Image src={highlightedPayment.receiptUrl} alt="Receipt" layout="fill" objectFit="contain" />
                            ) : (
                                <div className="text-center text-muted-foreground p-4">
                                    <ImageIcon className="mx-auto h-12 w-12" />
                                    <p className="mt-2 text-sm">Select a payment record to view its receipt.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        {building && unit && (
            <PaymentFormDialog
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                building={building}
                unit={unit}
                existingPayment={editingPayment}
            />
        )}
    </main>
    </I18nProvider>
  );
}
