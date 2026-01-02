
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Unit, Owner, Level, Building } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, DollarSign, ChevronsUpDown, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const formSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitType: z.string().min(1, 'Unit type is required'),
  sqm: z.coerce.number().min(1, 'Size must be greater than 0'),
  quarterlyMaintenanceFees: z.coerce.number().min(0, 'Maintenance fees cannot be negative'),
  ownerId: z.string().min(1, "Owner is required"),
  levelId: z.string().min(1, 'Level is required'),
});

export default function EditUnitPage() {
  const { buildingId, unitId } = useParams() as { buildingId: string; unitId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isOwnerComboboxOpen, setIsOwnerComboboxOpen] = React.useState(false);
  const [ownerComboboxSearch, setOwnerComboboxSearch] = React.useState("");
  const [isLevelComboboxOpen, setIsLevelComboboxOpen] = React.useState(false);
  const [levelComboboxSearch, setLevelComboboxSearch] = React.useState("");

  // --- Data Fetching ---
  const buildingRef = React.useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
  const { data: building } = useDoc<Building>(buildingRef);

  const unitRef = React.useMemo(() => doc(firestore, 'buildings', buildingId, 'units', unitId), [firestore, buildingId, unitId]);
  const { data: unit } = useDoc<Unit>(unitRef);

  const ownersQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'owners'), [firestore, buildingId]);
  const { data: owners } = useCollection<Owner>(ownersQuery);
  const ownersMap = React.useMemo(() => new Map((owners || []).map(o => [o.id, o.name])), [owners]);
  
  const levelsQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'levels'), [firestore, buildingId]);
  const { data: levels } = useCollection<Level>(levelsQuery);
  const levelsMap = React.useMemo(() => new Map((levels || []).map(l => [l.id, l.name])), [levels]);

  // --- Form Setup ---
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  });

  // --- Effect to Populate Form ---
  React.useEffect(() => {
    if (unit) {
      reset({
        unitNumber: String(unit.unitNumber),
        unitType: unit.unitType || unit.type,
        sqm: unit.sqm,
        quarterlyMaintenanceFees: unit.quarterlyMaintenanceFees,
        ownerId: unit.ownerId,
        levelId: unit.levelId,
      });
    }
  }, [unit, reset]);
  
  // --- Combobox Filtering ---
  const comboboxFilteredOwners = React.useMemo(() => {
    if (!owners) return [];
    return owners.filter(o => o.name.toLowerCase().includes(ownerComboboxSearch.toLowerCase()));
  }, [owners, ownerComboboxSearch]);

  const comboboxFilteredLevels = React.useMemo(() => {
    if (!levels) return [];
    return levels.filter(l => l.name.toLowerCase().includes(levelComboboxSearch.toLowerCase()));
  }, [levels, levelComboboxSearch]);

  // --- Actions ---
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!unitRef) return;
    
    const submissionData: any = { ...data };
    delete submissionData.type;

    updateDoc(unitRef, submissionData)
      .then(() => {
        toast({
          title: 'Unit Updated',
          description: `Unit "${data.unitNumber}" has been saved.`,
        });
        router.push(`/building/${buildingId}/level/${data.levelId}`);
      })
      .catch(() => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: unitRef.path,
            operation: 'update',
            requestResourceData: submissionData,
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

  const availableUnitTypes = building?.enabledUnitTypes || [];
  const isLoading = !unit || !owners || !levels || !building;

  return (
    <main className="w-full max-w-2xl space-y-6">
        <div className="mb-4">
             <Button variant="ghost" onClick={handleCancel} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                <ArrowLeft className="h-4 w-4" /> Back to Level View
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
                                <DollarSign className="mr-2 h-4 w-4" />
                                Record/View Payments
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 py-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="unitNumber">Unit Number</Label>
                                    <Input id="unitNumber" {...register('unitNumber')} />
                                    {errors.unitNumber && <p className="text-red-500 text-xs mt-1">{errors.unitNumber.message as string}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="unitType">Unit Type</Label>
                                    <Controller
                                        name="unitType"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                <SelectContent>
                                                    {availableUnitTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.unitType && <p className="text-red-500 text-xs mt-1">{errors.unitType.message as string}</p>}
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
                                        <Popover open={isOwnerComboboxOpen} onOpenChange={setIsOwnerComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" aria-expanded={isOwnerComboboxOpen} className="w-full justify-between">
                                                    {field.value ? ownersMap.get(field.value) : "Select owner..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <div className="p-2"><Input placeholder="Search owner..." value={ownerComboboxSearch} onChange={(e) => setOwnerComboboxSearch(e.target.value)} /></div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    {comboboxFilteredOwners?.length > 0 ? comboboxFilteredOwners.map(owner => (
                                                        <div key={owner.id} onClick={() => { field.onChange(owner.id); setIsOwnerComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                            <span>{owner.name}</span>
                                                            {field.value === owner.id && <Check className="h-4 w-4" />}
                                                        </div>
                                                    )) : <p className="p-2 text-center text-sm text-muted-foreground">No owners found.</p>}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                />
                                {errors.ownerId && <p className="text-red-500 text-xs mt-1">{errors.ownerId.message as string}</p>}
                            </div>
                            
                            <div>
                                <Label>Level</Label>
                                <Controller
                                    name="levelId"
                                    control={control}
                                    render={({ field }) => (
                                        <Popover open={isLevelComboboxOpen} onOpenChange={setIsLevelComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" aria-expanded={isLevelComboboxOpen} className="w-full justify-between">
                                                    {field.value ? levelsMap.get(field.value) : "Select level..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <div className="p-2"><Input placeholder="Search level..." value={levelComboboxSearch} onChange={(e) => setLevelComboboxSearch(e.target.value)} /></div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    {comboboxFilteredLevels?.length > 0 ? comboboxFilteredLevels.map(level => (
                                                        <div key={level.id} onClick={() => { field.onChange(level.id); setIsLevelComboboxOpen(false); }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                            <span>{level.name}</span>
                                                            {field.value === level.id && <Check className="h-4 w-4" />}
                                                        </div>
                                                    )) : <p className="p-2 text-center text-sm text-muted-foreground">No levels found.</p>}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                />
                                {errors.levelId && <p className="text-red-500 text-xs mt-1">{errors.levelId.message as string}</p>}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

             <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </form>
    </main>
  );
}
