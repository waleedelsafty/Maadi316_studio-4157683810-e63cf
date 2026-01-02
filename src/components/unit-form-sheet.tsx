
'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Unit, Owner } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitTypeId: z.string().min(1, 'Unit type is required'),
  sqm: z.coerce.number().min(1, 'Size must be greater than 0'),
  quarterlyMaintenanceFees: z.coerce.number().min(0, 'Maintenance fees cannot be negative'),
  ownerId: z.string().min(1, "Owner is required"),
});

type UnitFormSheetProps = {
  unit: Unit;
  buildingId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  owners: Owner[];
  availableUnitTypes: { id: string, name: string }[];
};

export function UnitFormSheet({ unit, buildingId, isOpen, onOpenChange, owners, availableUnitTypes }: UnitFormSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!firestore || !buildingId || !unit) return;

    const unitRef = doc(firestore, 'buildings', buildingId, 'units', unit.id);
    
    updateDoc(unitRef, data)
      .then(() => {
        toast({
          title: 'Unit Updated',
          description: `Unit "${data.unitNumber}" has been saved.`,
        });
        onOpenChange(false);
      })
      .catch(() => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: unitRef.path,
            operation: 'update',
            requestResourceData: data,
        }));
      });
  };

  React.useEffect(() => {
    if (isOpen && unit) {
      reset({
        unitNumber: unit.unitNumber || '',
        unitTypeId: unit.unitTypeId,
        sqm: unit.sqm || 0,
        quarterlyMaintenanceFees: unit.quarterlyMaintenanceFees || 0,
        ownerId: unit.ownerId || '',
      });
    }
  }, [isOpen, unit, reset]);
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>Edit Unit</SheetTitle>
            <SheetDescription>
              Make changes to unit details. Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="unitNumber">Unit Number</Label>
                    <Input id="unitNumber" {...register('unitNumber')} />
                    {errors.unitNumber && <p className="text-red-500 text-xs mt-1">{errors.unitNumber.message as string}</p>}
                </div>
                 <div>
                    <Label htmlFor="unitTypeId">Type</Label>
                    <Controller
                        name="unitTypeId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(availableUnitTypes || []).map(type => (
                                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.unitTypeId && <p className="text-red-500 text-xs mt-1">{errors.unitTypeId.message as string}</p>}
                </div>
              </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="sqm">Size (sqm)</Label>
                    <Input id="sqm" type="number" {...register('sqm')} />
                    {errors.sqm && <p className="text-red-500 text-xs mt-1">{errors.sqm.message as string}</p>}
                </div>
                 <div>
                    <Label htmlFor="quarterlyMaintenanceFees">Quarterly Maintenance</Label>
                    <Input id="quarterlyMaintenanceFees" type="number" {...register('quarterlyMaintenanceFees')} />
                    {errors.quarterlyMaintenanceFees && <p className="text-red-500 text-xs mt-1">{errors.quarterlyMaintenanceFees.message as string}</p>}
                </div>
              </div>
              
              <div>
                <Label>Owner</Label>
                <Controller
                    name="ownerId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an owner" />
                            </SelectTrigger>
                            <SelectContent>
                                {owners.map(owner => (
                                    <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.ownerId && <p className="text-red-500 text-xs mt-1">{errors.ownerId.message as string}</p>}
              </div>

          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              Save Changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

    