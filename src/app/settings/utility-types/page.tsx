
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { GlobalUtilityType } from '@/types';
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
  name: z.string().min(1, 'Type name is required.').refine(name => {
    const otherTypes = allTypes.filter(t => t.id !== existingTypeId);
    return !otherTypes.some(t => t.name.toLowerCase() === name.toLowerCase());
  }, {
      message: 'This utility type name already exists.',
  }),
  description: z.string().optional(),
});


function UtilityTypeFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  existingType,
  allTypes,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<GlobalUtilityType, 'id'>, isEditing: boolean) => void;
  existingType: GlobalUtilityType | null;
  allTypes: {id: string, name: string}[];
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(createFormSchema(allTypes, existingType?.id || null)),
    defaultValues: { name: '', description: '' }
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(existingType || { name: '', description: '' });
    }
  }, [isOpen, existingType, reset]);

  const onSubmit = (data: z.infer<ReturnType<typeof createFormSchema>>) => {
    onSave(data, !!existingType);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{existingType ? 'Edit Utility Type' : 'Add New Utility Type'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div>
              <Label htmlFor="name">Type Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
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


export default function GlobalUtilityTypesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingType, setEditingType] = React.useState<GlobalUtilityType | null>(null);

    const utilityTypesCollectionRef = React.useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'globalUtilityTypes');
    }, [firestore]);

    const { data: globalUtilityTypes } = useCollection<GlobalUtilityType>(utilityTypesCollectionRef);
    const allTypesForValidation = React.useMemo(() => (globalUtilityTypes || []).map(t => ({ id: t.id, name: t.name })), [globalUtilityTypes]);


    const handleSaveType = async (data: Omit<GlobalUtilityType, 'id'>, isEditing: boolean) => {
        if (!utilityTypesCollectionRef) return;
        
        try {
            if (isEditing && editingType) {
                const docRef = doc(firestore, 'globalUtilityTypes', editingType.id);
                await updateDoc(docRef, data);
                toast({ title: `Utility Type Updated`, description: `"${data.name}" has been saved.`});
            } else {
                await addDoc(utilityTypesCollectionRef, data);
                toast({ title: `Utility Type Added`, description: `"${data.name}" has been created.`});
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save utility type.' });
            console.error(e);
        }
        
        setEditingType(null);
    };

    const handleRemoveType = async (type: GlobalUtilityType) => {
        if (!firestore) return;
        // TODO: Check if this type is in use by any payables before deleting
        const docRef = doc(firestore, 'globalUtilityTypes', type.id);
        await deleteDoc(docRef);
        toast({ title: 'Utility Type Removed', description: `"${type.name}" has been removed.`});
    };
    
    const isLoading = globalUtilityTypes === null;

    return (
        <>
        <Card className="max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Global Utility Types</CardTitle>
                        <CardDescription>
                            Manage the master list of utility expense types (e.g., Electricity, Water, Internet).
                        </CardDescription>
                    </div>
                    <Button onClick={() => { setEditingType(null); setIsFormOpen(true); }}>Add New Type</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : globalUtilityTypes && globalUtilityTypes.length > 0 ? (
                                globalUtilityTypes.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-semibold">{type.name}</TableCell>
                                        <TableCell className="max-w-xs truncate">{type.description || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingType(type); setIsFormOpen(true); }}>
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
                                                                This will permanently remove "{type.name}" from the global list. This could affect existing expense records.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleRemoveType(type)}>Continue</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow key="empty-row">
                                    <TableCell colSpan={3} className="text-center h-24">No global utility types created yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <UtilityTypeFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveType}
            existingType={editingType}
            allTypes={allTypesForValidation}
        />
        </>
    );
}
