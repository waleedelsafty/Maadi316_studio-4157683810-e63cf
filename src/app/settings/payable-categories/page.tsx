
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { GlobalPayableCategory } from '@/types';
import { Trash2, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const createFormSchema = (allTypes: {id: string, name: string}[], existingTypeId: string | null) => z.object({
  name: z.string().min(1, 'Category name is required.').refine(name => {
    const otherTypes = allTypes.filter(t => t.id !== existingTypeId);
    return !otherTypes.some(t => t.name.toLowerCase() === name.toLowerCase());
  }, {
      message: 'This category name already exists.',
  }),
  description: z.string().optional(),
  linksTo: z.enum(['employee', 'serviceProvider', 'utility', 'none']).optional(),
});


function PayableCategoryFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  existingType,
  allTypes,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<GlobalPayableCategory, 'id'>, isEditing: boolean) => void;
  existingType: GlobalPayableCategory | null;
  allTypes: {id: string, name: string}[];
}) {
  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(createFormSchema(allTypes, existingType?.id || null)),
    defaultValues: { name: '', description: '', linksTo: 'none' }
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
          name: existingType?.name || '',
          description: existingType?.description || '',
          linksTo: existingType?.linksTo || 'none',
      });
    }
  }, [isOpen, existingType, reset]);

  const onSubmit = (data: z.infer<ReturnType<typeof createFormSchema>>) => {
    const submissionData = {
        ...data,
        linksTo: data.linksTo === 'none' ? null : data.linksTo,
    };
    onSave(submissionData as Omit<GlobalPayableCategory, 'id'>, !!existingType);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{existingType ? 'Edit Payable Category' : 'Add New Payable Category'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div>
              <Label htmlFor="name">Category Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" {...register('description')} />
            </div>
             <div>
              <Label htmlFor="linksTo">Special Behavior (Optional)</Label>
               <Controller
                name="linksTo"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || 'none'}>
                    <SelectTrigger>
                      <SelectValue placeholder="No special behavior" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No special behavior</SelectItem>
                      <SelectItem value="employee">Links to an Employee (for salaries)</SelectItem>
                      <SelectItem value="serviceProvider">Links to a Service Provider (for contracts)</SelectItem>
                      <SelectItem value="utility">Links to a Utility Type (for utilities)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
               <p className="text-xs text-muted-foreground mt-1">
                Choose this to automatically show a relevant dropdown when this category is selected in an expense form.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Category</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export default function GlobalPayableCategoriesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingType, setEditingType] = React.useState<GlobalPayableCategory | null>(null);

    const categoriesCollectionRef = React.useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'globalPayableCategories');
    }, [firestore]);

    const { data: globalPayableCategories } = useCollection<GlobalPayableCategory>(categoriesCollectionRef);
    const allTypesForValidation = React.useMemo(() => (globalPayableCategories || []).map(t => ({ id: t.id, name: t.name })), [globalPayableCategories]);


    const handleSaveType = async (data: Omit<GlobalPayableCategory, 'id'>, isEditing: boolean) => {
        if (!categoriesCollectionRef) return;
        
        try {
            if (isEditing && editingType) {
                const docRef = doc(firestore, 'globalPayableCategories', editingType.id);
                await updateDoc(docRef, data);
                toast({ title: `Category Updated`, description: `"${data.name}" has been saved.`});
            } else {
                await addDoc(categoriesCollectionRef, data);
                toast({ title: `Category Added`, description: `"${data.name}" has been created.`});
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save category.' });
            console.error(e);
        }
        
        setEditingType(null);
    };

    const handleRemoveType = async (type: GlobalPayableCategory) => {
        if (!firestore) return;
        // TODO: Check if this type is in use by any payables before deleting
        const docRef = doc(firestore, 'globalPayableCategories', type.id);
        await deleteDoc(docRef);
        toast({ title: 'Category Removed', description: `"${type.name}" has been removed.`});
    };
    
    const isLoading = globalPayableCategories === null;

    return (
        <>
        <Card className="max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Global Payable Categories</CardTitle>
                        <CardDescription>
                            Manage the master list of expense categories used across all buildings.
                        </CardDescription>
                    </div>
                    <Button onClick={() => { setEditingType(null); setIsFormOpen(true); }}>Add New Category</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Special Behavior</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : globalPayableCategories && globalPayableCategories.length > 0 ? (
                                globalPayableCategories.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-semibold">{type.name}</TableCell>
                                        <TableCell className="max-w-xs truncate">{type.description || '—'}</TableCell>
                                        <TableCell>{type.linksTo || 'None'}</TableCell>
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
                                                                This will permanently remove "{type.name}" from the global list.
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
                                    <TableCell colSpan={4} className="text-center h-24">No payable categories created yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <PayableCategoryFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveType}
            existingType={editingType}
            allTypes={allTypesForValidation}
        />
        </>
    );
}
