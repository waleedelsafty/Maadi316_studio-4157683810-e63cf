
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
import type { Level } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const levelTypes: Level['levelType'][] = ['Basement', 'Ground', 'Mezzanine', 'Typical Floor', 'Penthouse', 'Rooftop'];
const uniqueLevelTypes: Level['levelType'][] = ['Ground', 'Penthouse', 'Rooftop'];

const formSchema = z.object({
  name: z.string().min(1, 'Level name is required'),
  levelType: z.enum(levelTypes),
  floorNumber: z.number().optional(),
});

type LevelFormSheetProps = {
  level: Level;
  buildingId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  existingLevels: Level[];
};

export function LevelFormSheet({ level, buildingId, isOpen, onOpenChange, existingLevels }: LevelFormSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    control
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  const selectedType = watch('levelType');

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!firestore || !buildingId || !level) return;

    if (data.levelType === 'Typical Floor') {
      if (data.floorNumber === undefined || isNaN(data.floorNumber)) {
        toast({
          variant: 'destructive',
          title: 'Invalid Floor Number',
          description: 'Please provide a valid number for the typical floor.',
        });
        return;
      }
      // Check if another typical floor with this number already exists
      if (existingLevels.some(l => l.id !== level.id && l.levelType === 'Typical Floor' && l.floorNumber === data.floorNumber)) {
        toast({
          variant: 'destructive',
          title: 'Duplicate Floor Number',
          description: `A "Typical Floor" with the number ${data.floorNumber} already exists.`,
        });
        return;
      }
    }
    
    // Check for unique level types
    if (uniqueLevelTypes.includes(data.levelType)) {
      if (existingLevels.some(l => l.id !== level.id && l.levelType === data.levelType)) {
         toast({
          variant: 'destructive',
          title: 'Duplicate Level Type',
          description: `A level of type "${data.levelType}" already exists in this building.`,
        });
        return;
      }
    }

    const levelRef = doc(firestore, 'buildings', buildingId, 'levels', level.id);

    const submissionData = {
        name: data.name,
        levelType: data.levelType,
        floorNumber: data.levelType === 'Typical Floor' ? data.floorNumber : null,
    };
    
    updateDoc(levelRef, submissionData)
      .then(() => {
        toast({
          title: 'Level Updated',
          description: 'The level details have been saved.',
        });
        onOpenChange(false);
      })
      .catch(() => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: levelRef.path,
            operation: 'update',
            requestResourceData: submissionData,
        }));
      });
  };

  React.useEffect(() => {
    if (isOpen && level) {
      reset({
        name: level.name || '',
        levelType: level.levelType || undefined,
        floorNumber: level.floorNumber || undefined,
      });
    }
  }, [isOpen, level, reset]);
  
  const availableEditLevelTypes = React.useMemo(() => {
     let filteredTypes = [...levelTypes];
     const otherLevels = existingLevels.filter(l => l.id !== level.id);

     uniqueLevelTypes.forEach(uniqueType => {
         if (otherLevels.some(l => l.levelType === uniqueType)) {
             filteredTypes = filteredTypes.filter(t => t !== uniqueType);
         }
     });
     
     return filteredTypes;

  }, [existingLevels, level]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>Edit Level</SheetTitle>
            <SheetDescription>
              Make changes to your level details. Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g., 'Lobby'" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="levelType">Type</Label>
                 <Controller
                    name="levelType"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableEditLevelTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.levelType && <p className="text-red-500 text-xs mt-1">{errors.levelType.message as string}</p>}
              </div>

              {selectedType === 'Typical Floor' && (
                <div>
                    <Label htmlFor="floorNumber">Floor Number</Label>
                    <Input
                        id="floorNumber"
                        type="number"
                        {...register('floorNumber', { valueAsNumber: true })}
                        placeholder="e.g., 1, 2, 3..."
                    />
                    {errors.floorNumber && <p className="text-red-500 text-xs mt-1">{errors.floorNumber.message as string}</p>}
                </div>
              )}
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
