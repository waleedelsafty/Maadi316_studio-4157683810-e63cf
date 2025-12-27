
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Unit } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const unitTypes: Unit['type'][] = ['Office', 'Commercial', 'Flat Apartment', 'Duplex Apartment', 'Storage'];

const formSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  type: z.enum(unitTypes),
  sqm: z.coerce.number().min(1, 'Size must be greater than 0'),
  quarterlyMaintenanceFees: z.coerce.number().min(0, 'Maintenance fees cannot be negative'),
  ownerName: z.string().min(1, "Owner's name is required"),
});

export default function EditUnitPage() {
  const { buildingId, unitId } = useParams() as { buildingId: string; unitId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const unitRef = React.useMemo(() => {
    if (!firestore || !buildingId || !unitId) return null;
    return doc(firestore, 'buildings', buildingId, 'units', unitId);
  }, [firestore, buildingId, unitId]);

  const { data: unit } = useDoc(unitRef);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitNumber: '',
      sqm: 0,
      quarterlyMaintenanceFees: 0,
      ownerName: '',
    }
  });

  React.useEffect(() => {
    if (unit) {
      reset({
        unitNumber: unit.unitNumber || '',
        type: unit.type,
        sqm: unit.sqm || 0,
        quarterlyMaintenanceFees: unit.quarterlyMaintenanceFees || 0,
        ownerName: unit.ownerName || '',
      });
    }
  }, [unit, reset]);
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!unitRef) return;
    
    updateDoc(unitRef, data)
      .then(() => {
        toast({
          title: 'Unit Updated',
          description: `Unit "${data.unitNumber}" has been saved.`,
        });
        if (unit) {
            router.push(`/building/${buildingId}/level/${unit.levelId}`);
        } else {
            router.back();
        }
      })
      .catch(() => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: unitRef.path,
            operation: 'update',
            requestResourceData: data,
        }));
      });
  };
  
  const handleCancel = () => {
    if (unit) {
        router.push(`/building/${buildingId}/level/${unit.levelId}`);
    } else {
        router.back();
    }
  }


  return (
    <main className="w-full max-w-2xl">
        <div className="mb-4">
             <Button variant="ghost" onClick={handleCancel} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                <ArrowLeft className="h-4 w-4" /> Back to Level
            </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Edit Unit</CardTitle>
                            <CardDescription>
                                Make changes to unit details. Click save when you're done.
                            </CardDescription>
                        </div>
                        <Button variant="outline" asChild>
                            <Link href={`/building/${buildingId}/unit/${unitId}/payments`}>
                                <History className="mr-2 h-4 w-4" />
                                View Payments
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 py-6">
                    {!unit ? (
                        <>
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="unitNumber">Unit Number</Label>
                                    <Input id="unitNumber" {...register('unitNumber')} />
                                    {errors.unitNumber && <p className="text-red-500 text-xs mt-1">{errors.unitNumber.message as string}</p>}
                                </div>
                                    <div>
                                    <Label htmlFor="type">Type</Label>
                                    <Controller
                                        name="type"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {unitTypes.map(type => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message as string}</p>}
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
                            <Label htmlFor="ownerName">Owner's Name</Label>
                            <Input id="ownerName" {...register('ownerName')} />
                            {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName.message as string}</p>}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

             <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || !unit}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </form>
    </main>
  );
}

    
