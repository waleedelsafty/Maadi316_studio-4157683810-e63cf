
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { GlobalUnitType } from '@/types';
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
import { Switch } from '@/components/ui/switch';

const createFormSchema = (allTypes: {id: string, name: string}[], existingTypeId: string | null) => z.object({
  name: z.string().min(1, 'Type name is required.').refine(name => {
    // Check if any *other* type has the same name (case-insensitive)
    const otherTypes = allTypes.filter(t => t.id !== existingTypeId);
    return !otherTypes.some(t => t.name.toLowerCase() === name.toLowerCase());
  }, {
      message: 'This unit type name already exists.',
  }),
  shortName: z.string().optional(),
  description: z.string().optional(),
  isMultiLevel: z.boolean().default(false),
});


function UnitTypeFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  existingType,
  allTypes,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<GlobalUnitType, 'id'>, isEditing: boolean) => void;
  existingType: GlobalUnitType | null;
  allTypes: {id: string, name: string}[];
}) {
  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(createFormSchema(allTypes, existingType?.id || null)),
    defaultValues: {
        name: '',
        shortName: '',
        description: '',
        isMultiLevel: false,
    }
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(existingType || { name: '', shortName: '', description: '', isMultiLevel: false });
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
            <DialogTitle>{existingType ? 'Edit Unit Type' : 'Add New Unit Type'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div>
              <Label htmlFor="name">Type Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="shortName">Short Name (Optional)</Label>
              <Input id="shortName" {...register('shortName')} />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" {...register('description')} />
            </div>
            <div className="flex items-center space-x-2">
                 <Controller
                    name="isMultiLevel"
                    control={control}
                    render={({ field }) => (
                        <Switch
                            id="isMultiLevel"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
                <Label htmlFor="isMultiLevel">This unit type spans multiple levels (e.g., Duplex, Townhouse)</Label>
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


export default function GlobalUnitTypesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingType, setEditingType] = React.useState<GlobalUnitType | null>(null);

    const unitTypesCollectionRef = React.useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'globalUnitTypes');
    }, [firestore]);

    const { data: globalUnitTypes, error } = useCollection<GlobalUnitType>(unitTypesCollectionRef);
    const allTypesForValidation = React.useMemo(() => (globalUnitTypes || []).map(t => ({ id: t.id, name: t.name })), [globalUnitTypes]);


    const handleSaveType = async (data: Omit<GlobalUnitType, 'id'>, isEditing: boolean) => {
        if (!unitTypesCollectionRef) return;
        
        try {
            if (isEditing && editingType) {
                const docRef = doc(firestore, 'globalUnitTypes', editingType.id);
                await updateDoc(docRef, data);
                toast({ title: `Unit Type Updated`, description: `"${data.name}" has been saved.`});
            } else {
                await addDoc(unitTypesCollectionRef, data);
                toast({ title: `Unit Type Added`, description: `"${data.name}" has been created.`});
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save unit type.' });
            console.error(e);
        }
        
        setEditingType(null);
    };

    const handleRemoveType = async (type: GlobalUnitType) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'globalUnitTypes', type.id);
        await deleteDoc(docRef);
        toast({ title: 'Unit Type Removed', description: `"${type.name}" has been removed from the global list.`});
    };
    
    const isLoading = globalUnitTypes === null;

    return (
        <>
        <Card className="max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Global Unit Types</CardTitle>
                        <CardDescription>
                            Manage the master list of all possible unit types available across the entire application.
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
                                <TableHead>Multi-Level</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : globalUnitTypes && globalUnitTypes.length > 0 ? (
                                globalUnitTypes.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-semibold">{type.name}</TableCell>
                                        <TableCell>{type.isMultiLevel ? 'Yes' : 'No'}</TableCell>
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
                                                                This will permanently remove "{type.name}" from the global list. This could affect buildings that currently use this type.
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
                                    <TableCell colSpan={4} className="text-center h-24">No global unit types created yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <UnitTypeFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveType}
            existingType={editingType}
            allTypes={allTypesForValidation}
        />
        </>
    );
}
