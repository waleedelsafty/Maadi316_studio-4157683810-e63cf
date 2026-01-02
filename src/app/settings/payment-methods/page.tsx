
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { GlobalPaymentMethod } from '@/types';
import { Trash2, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const createFormSchema = (allTypes: {id: string, name: string}[], existingTypeId: string | null) => z.object({
  name: z.string().min(1, 'Method name is required.').refine(name => {
    const otherTypes = allTypes.filter(t => t.id !== existingTypeId);
    return !otherTypes.some(t => t.name.toLowerCase() === name.toLowerCase());
  }, {
      message: 'This payment method name already exists.',
  }),
  description: z.string().optional(),
  icon: z.string().optional(),
});


function PaymentMethodFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  existingMethod,
  allMethods,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<GlobalPaymentMethod, 'id'>, isEditing: boolean) => void;
  existingMethod: GlobalPaymentMethod | null;
  allMethods: {id: string, name: string}[];
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(createFormSchema(allMethods, existingMethod?.id || null)),
    defaultValues: { name: '', description: '', icon: '' }
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(existingMethod || { name: '', description: '', icon: '' });
    }
  }, [isOpen, existingMethod, reset]);

  const onSubmit = (data: z.infer<ReturnType<typeof createFormSchema>>) => {
    onSave(data, !!existingMethod);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{existingMethod ? 'Edit Payment Method' : 'Add New Payment Method'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div>
              <Label htmlFor="name">Method Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="icon">Icon (Optional)</Label>
              <Input id="icon" {...register('icon')} placeholder="e.g. 'CreditCard' or 'Landmark'" />
              <p className="text-xs text-muted-foreground mt-1">Enter a valid `lucide-react` icon name.</p>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" {...register('description')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export default function GlobalPaymentMethodsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingMethod, setEditingMethod] = React.useState<GlobalPaymentMethod | null>(null);

    const methodsCollectionRef = React.useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'globalPaymentMethods');
    }, [firestore]);

    const { data: globalPaymentMethods } = useCollection<GlobalPaymentMethod>(methodsCollectionRef);
    const allMethodsForValidation = React.useMemo(() => (globalPaymentMethods || []).map(m => ({ id: m.id, name: m.name })), [globalPaymentMethods]);

    const handleSaveMethod = async (data: Omit<GlobalPaymentMethod, 'id'>, isEditing: boolean) => {
        if (!methodsCollectionRef) return;
        
        try {
            if (isEditing && editingMethod) {
                const docRef = doc(firestore, 'globalPaymentMethods', editingMethod.id);
                await updateDoc(docRef, data);
                toast({ title: `Payment Method Updated`, description: `"${data.name}" has been saved.`});
            } else {
                await addDoc(methodsCollectionRef, data);
                toast({ title: `Payment Method Added`, description: `"${data.name}" has been created.`});
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save payment method.' });
            console.error(e);
        }
        
        setEditingMethod(null);
    };

    const handleRemoveMethod = async (method: GlobalPaymentMethod) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'globalPaymentMethods', method.id);
        await deleteDoc(docRef);
        toast({ title: 'Payment Method Removed', description: `"${method.name}" has been removed.`});
    };
    
    const isLoading = globalPaymentMethods === null;

    return (
        <>
        <Card className="max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Global Payment Methods</CardTitle>
                        <CardDescription>
                            Manage the master list of payment methods used across all buildings.
                        </CardDescription>
                    </div>
                    <Button onClick={() => { setEditingMethod(null); setIsFormOpen(true); }}>Add New Method</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Icon</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : globalPaymentMethods && globalPaymentMethods.length > 0 ? (
                                globalPaymentMethods.map((method) => (
                                    <TableRow key={method.id}>
                                        <TableCell className="font-semibold">{method.name}</TableCell>
                                        <TableCell>{method.icon || '—'}</TableCell>
                                        <TableCell className="max-w-xs truncate">{method.description || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingMethod(method); setIsFormOpen(true); }}>
                                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently remove "{method.name}" from the global list.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleRemoveMethod(method)}>Continue</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow key="empty-row">
                                    <TableCell colSpan={4} className="text-center h-24">No payment methods created yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <PaymentMethodFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveMethod}
            existingMethod={editingMethod}
            allMethods={allMethodsForValidation}
        />
        </>
    );
}
