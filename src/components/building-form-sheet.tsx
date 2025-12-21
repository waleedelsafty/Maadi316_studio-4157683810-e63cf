
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
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Building } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  address: z.string().min(1, 'Building address is required'),
  hasBasement: z.boolean().default(false),
  basementCount: z.number().optional(),
  hasMezzanine: z.boolean().default(false),
  mezzanineCount: z.number().optional(),
  hasPenthouse: z.boolean().default(false),
  hasRooftop: z.boolean().default(false),
});

type BuildingFormSheetProps = {
  building: Building | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function BuildingFormSheet({ building, isOpen, onOpenChange }: BuildingFormSheetProps) {
  const firestore = useFirestore();
  const user = useUser();
  const { toast } = useToast();
  const isEditing = !!building;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    watch
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      hasBasement: false,
      basementCount: 1,
      hasMezzanine: false,
      mezzanineCount: 1,
      hasPenthouse: false,
      hasRooftop: false,
    }
  });

  const hasBasement = watch('hasBasement');
  const hasMezzanine = watch('hasMezzanine');

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;

    const submissionData = {
        ...data,
        basementCount: data.hasBasement ? data.basementCount : 0,
        mezzanineCount: data.hasMezzanine ? data.mezzanineCount : 0,
    };

    if (isEditing) {
      // Update existing building
      const buildingRef = doc(firestore, 'buildings', building.id);
      updateDoc(buildingRef, submissionData)
        .then(() => {
          toast({
            title: 'Building Updated',
            description: 'The building details have been saved.',
          });
          onOpenChange(false);
        })
        .catch(() => {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: buildingRef.path,
              operation: 'update',
              requestResourceData: submissionData,
          }));
        });
    } else {
      // Add new building
      const newBuilding = {
        ...submissionData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        floors: 0,
        units: 0,
      };
      const buildingsCollectionRef = collection(firestore, 'buildings');
      addDoc(buildingsCollectionRef, newBuilding)
        .then(() => {
          toast({
            title: 'Building Added',
            description: 'The new building has been saved.',
          });
          onOpenChange(false);
        })
        .catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: buildingsCollectionRef.path,
            operation: 'create',
            requestResourceData: newBuilding,
          }));
        });
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: building?.name || '',
        address: building?.address || '',
        hasBasement: building?.hasBasement || false,
        basementCount: building?.basementCount || 1,
        hasMezzanine: building?.hasMezzanine || false,
        mezzanineCount: building?.mezzanineCount || 1,
        hasPenthouse: building?.hasPenthouse || false,
        hasRooftop: building?.hasRooftop || false,
      });
    }
  }, [isOpen, building, reset]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>{isEditing ? 'Edit Building' : 'Add New Building'}</SheetTitle>
            <SheetDescription>
              {isEditing ? 'Make changes to your building details.' : 'Fill in the details for your new building.'} Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 py-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g., 'Main Street Plaza'" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" {...register('address')} placeholder="e.g., '123 Main St, Anytown, USA'"/>
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message as string}</p>}
              </div>

              <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <Label>Has Basement</Label>
                        <p className="text-xs text-muted-foreground">Does this building have underground levels?</p>
                    </div>
                     <Controller
                        name="hasBasement"
                        control={control}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                  </div>
                  {hasBasement && (
                    <div className="pl-4">
                        <Label>Number of Basement Levels</Label>
                        <Controller
                            name="basementCount"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={String(field.value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select number of levels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                  )}
              </div>
              
               <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <Label>Has Mezzanine</Label>
                        <p className="text-xs text-muted-foreground">Does this building have mezzanine floors?</p>
                    </div>
                     <Controller
                        name="hasMezzanine"
                        control={control}
                        render={({ field }) => (
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                  </div>
                  {hasMezzanine && (
                    <div className="pl-4">
                        <Label>Number of Mezzanine Levels</Label>
                         <Controller
                            name="mezzanineCount"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={String(field.value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select number of levels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                  )}
              </div>
              
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Has Penthouse</Label>
                     <p className="text-xs text-muted-foreground">Does this building have a penthouse?</p>
                </div>
                 <Controller
                    name="hasPenthouse"
                    control={control}
                    render={({ field }) => (
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
              </div>

               <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Has Rooftop</Label>
                    <p className="text-xs text-muted-foreground">Is there a usable rooftop level?</p>
                </div>
                 <Controller
                    name="hasRooftop"
                    control={control}
                    render={({ field }) => (
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />
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
