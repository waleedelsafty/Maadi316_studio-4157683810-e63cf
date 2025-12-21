
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Building } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  address: z.string().min(1, 'Building address is required'),
});

type EditBuildingSheetProps = {
  building: Building;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function EditBuildingSheet({ building, isOpen, onOpenChange }: EditBuildingSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: building.name,
      address: building.address,
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!firestore || !building) return;

    const buildingRef = doc(firestore, 'buildings', building.id);
    
    updateDoc(buildingRef, data)
      .then(() => {
        toast({
          title: 'Building Updated',
          description: 'The building details have been saved.',
        });
        onOpenChange(false);
      })
      .catch((serverError) => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: buildingRef.path,
            operation: 'update',
            requestResourceData: data,
        }));
      });
  };

  // Reset form when building changes
  React.useEffect(() => {
    if (building) {
      reset({
        name: building.name,
        address: building.address,
      });
    }
  }, [building, reset]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>Edit Building</SheetTitle>
            <SheetDescription>
              Make changes to your building information here. Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <div className="col-span-3">
                <Input id="name" {...register('name')} className="w-full" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <div className="col-span-3">
                <Input id="address" {...register('address')} className="w-full" />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
              </div>
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
