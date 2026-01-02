
'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, updateDoc, collection, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Unit, Owner, Level, Building, GlobalUnitType } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ChevronsUpDown, Check, Link as LinkIcon, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OwnerCombobox } from '@/components/owner-combobox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const formSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  unitTypeId: z.string().min(1, 'Unit type is required'),
  sqm: z.coerce.number().min(1, 'Size must be greater than 0'),
  levelId: z.string().min(1, 'Level is required'),
  // Fields for parent units
  quarterlyMaintenanceFees: z.coerce.number().optional(),
  ownerId: z.string().optional(),
  // Field for child units
  parentUnitId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    // If it's a parent unit (no parentUnitId), owner and fees are required.
    if (!data.parentUnitId) {
        if (!data.ownerId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner is required for a parent unit.", path: ['ownerId']});
        }
        if (data.quarterlyMaintenanceFees === undefined || data.quarterlyMaintenanceFees < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A valid maintenance fee is required for a parent unit.", path: ['quarterlyMaintenanceFees']});
        }
    }
});


export default function EditUnitPage() {
  const { buildingId, unitId } = useParams() as { buildingId: string; unitId: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPath = searchParams.get('from');

  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLevelComboboxOpen, setIsLevelComboboxOpen] = React.useState(false);
  const [levelComboboxSearch, setLevelComboboxSearch] = React.useState("");

  // --- Data Fetching ---
  const buildingRef = React.useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
  const { data: building } = useDoc<Building>(buildingRef);

  const unitRef = React.useMemo(() => doc(firestore, 'buildings', buildingId, 'units', unitId), [firestore, buildingId, unitId]);
  const { data: unit, setData: setUnitLocally } = useDoc<Unit>(unitRef);
  
  const allUnitsQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'units'), [firestore, buildingId]);
  const { data: allUnits } = useCollection<Unit>(allUnitsQuery);

  const ownersQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'owners'), [firestore, buildingId]);
  const { data: owners } = useCollection<Owner>(ownersQuery);
  
  const levelsQuery = React.useMemo(() => collection(firestore, 'buildings', buildingId, 'levels'), [firestore, buildingId]);
  const { data: levels } = useCollection<Level>(levelsQuery);
  const levelsMap = React.useMemo(() => new Map((levels || []).map(l => [l.id, l.name])), [levels]);
  
  const globalUnitTypesQuery = React.useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
  const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);
  const unitTypesMap = React.useMemo(() => new Map((globalUnitTypes || []).map(t => [t.id, t])), [globalUnitTypes]);


  // --- Form Setup ---
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    watch,
    reset,
    setValue,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const parentUnitId = watch('parentUnitId');
  const unitTypeId = watch('unitTypeId');
  const isMultiLevelType = unitTypesMap.get(unitTypeId)?.isMultiLevel;
  
  // This is the key: we need to dynamically set the `parentUnitId` field in the form
  // when the component loads, if the unit from DB is a child.
   React.useEffect(() => {
    if (unit) {
      reset({
        ...unit,
        unitTypeId: unit.unitTypeId,
        parentUnitId: unit.parentUnitId,
      });
    }
  }, [unit, reset]);
  

  // --- Combobox Filtering & Derived State ---
  const comboboxFilteredLevels = React.useMemo(() => {
    if (!levels) return [];
    return levels.filter(l => l.name.toLowerCase().includes(levelComboboxSearch.toLowerCase()));
  }, [levels, levelComboboxSearch]);

  const potentialParentUnits = React.useMemo(() => {
      if (!allUnits) return [];
      // A potential parent is a multi-level type, is not itself a child, and is not the unit we are currently editing.
      return allUnits.filter(u => 
          unitTypesMap.get(u.unitTypeId)?.isMultiLevel &&
          !u.parentUnitId &&
          u.id !== unitId
      );
  }, [allUnits, unitTypesMap, unitId]);
  
  const originalParentId = unit?.parentUnitId;


  // --- Actions ---
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!unitRef || !firestore || !allUnits) return;
    
    const batch = writeBatch(firestore);
    
    const newParentId = data.parentUnitId;

    // Logic for detaching from an old parent
    if (originalParentId && originalParentId !== newParentId) {
        const oldParentRef = doc(firestore, 'buildings', buildingId, 'units', originalParentId);
        const oldParent = allUnits.find(u => u.id === originalParentId);
        if (oldParent) {
            const updatedChildren = (oldParent.childUnitIds || []).filter(id => id !== unitId);
            batch.update(oldParentRef, { childUnitIds: updatedChildren });
        }
    }
    
    // Logic for attaching to a new parent
    if (newParentId && newParentId !== originalParentId) {
        const newParentRef = doc(firestore, 'buildings', buildingId, 'units', newParentId);
        const newParent = allUnits.find(u => u.id === newParentId);
        if (newParent) {
            const updatedChildren = [...(newParent.childUnitIds || []), unitId];
            batch.update(newParentRef, { childUnitIds: updatedChildren });
        }
    }

    const submissionData: Partial<Unit> = { ...data };

    if (data.parentUnitId) {
        // If it's a child, nullify financial/owner fields
        submissionData.ownerId = null;
        submissionData.quarterlyMaintenanceFees = null;
    } else {
        // Ensure parentUnitId is null, not undefined, if it's a parent.
        submissionData.parentUnitId = null;
    }
    
    batch.update(unitRef, submissionData);

    try {
        await batch.commit();
        toast({ title: 'Unit Updated', description: `Unit "${data.unitNumber}" has been saved.` });
        router.push(fromPath || `/building/${buildingId}/units`);
    } catch (e) {
        console.error(e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: unitRef.path, operation: 'update', requestResourceData: submissionData,
        }));
    }
  };
  
  const handleCancel = () => {
    router.push(fromPath || `/building/${buildingId}/units`);
  }

  const availableUnitTypes = React.useMemo(() => {
    if (!globalUnitTypes || !building?.enabledUnitTypeIds) return [];
    return globalUnitTypes.filter(type => building.enabledUnitTypeIds?.includes(type.id));
  }, [globalUnitTypes, building]);
  
  const isLoading = !unit || !allUnits || !owners || !levels || !building || !globalUnitTypes;
  const isChildUnit = !!parentUnitId;

  return (
    <main className="w-full max-w-2xl space-y-4">
        <Button variant="ghost" onClick={handleCancel} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
            <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {isLoading ? (
             <Card><CardHeader><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-64" /></CardHeader><CardContent className="grid gap-6 py-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Unit</CardTitle>
                        <CardDescription>
                            Make changes to unit details for "{unit.unitNumber}". Click save when you're done.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 py-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="unitNumber">Unit Number</Label>
                                    <Input id="unitNumber" {...register('unitNumber')} />
                                    {errors.unitNumber && <p className="text-red-500 text-xs mt-1">{errors.unitNumber.message as string}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="unitTypeId">Unit Type</Label>
                                    <Controller name="unitTypeId" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                            <SelectContent>{availableUnitTypes.map(type => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}</SelectContent>
                                        </Select>
                                    )} />
                                    {errors.unitTypeId && <p className="text-red-500 text-xs mt-1">{errors.unitTypeId.message as string}</p>}
                                </div>
                            </div>
                            
                            {isMultiLevelType && (
                                <div className="space-y-3 rounded-lg border bg-background p-4">
                                    <h3 className="font-medium flex items-center gap-2"><LinkIcon className="h-4 w-4"/> Multi-Level Linking</h3>
                                    <div>
                                      <Controller name="parentUnitId" control={control} render={({ field }) => (
                                        <Select onValueChange={(value) => field.onChange(value === 'detach' ? null : value)} value={field.value || 'detach'}>
                                          <SelectTrigger><SelectValue placeholder="Select parent unit..." /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="detach">Not part of another unit (This is a Parent)</SelectItem>
                                            {potentialParentUnits.map(pUnit => (
                                              <SelectItem key={pUnit.id} value={pUnit.id}>
                                                Link to: Unit {pUnit.unitNumber} (Owner: {owners.find(o => o.id === pUnit.ownerId)?.name || 'N/A'})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )} />
                                      <p className="text-xs text-muted-foreground mt-1">If this unit is part of a duplex, link it to its parent here. Detach to make it a standalone parent unit.</p>
                                    </div>
                                </div>
                            )}

                             {isChildUnit && (
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>This is a Child Unit</AlertTitle>
                                    <AlertDescription>
                                        Its owner and maintenance fees are managed by its parent unit. To set these, first detach it.
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                <Label htmlFor="sqm">Size (sqm)</Label>
                                <Input id="sqm" type="number" {...register('sqm')} />
                                {errors.sqm && <p className="text-red-500 text-xs mt-1">{errors.sqm.message as string}</p>}
                            </div>
                                <div>
                                <Label htmlFor="quarterlyMaintenanceFees">Quarterly Maintenance</Label>
                                <Input id="quarterlyMaintenanceFees" type="number" {...register('quarterlyMaintenanceFees')} disabled={isChildUnit} />
                                {errors.quarterlyMaintenanceFees && <p className="text-red-500 text-xs mt-1">{errors.quarterlyMaintenanceFees.message as string}</p>}
                            </div>
                            </div>
                            
                            <div>
                                <Label>Owner</Label>
                                <Controller name="ownerId" control={control} render={({ field }) => (
                                    <OwnerCombobox buildingId={buildingId} owners={owners || []} value={field.value || null} onChange={field.onChange} disabled={isChildUnit} />
                                )} />
                                {errors.ownerId && <p className="text-red-500 text-xs mt-1">{errors.ownerId.message as string}</p>}
                            </div>
                            
                            <div>
                                <Label>Level</Label>
                                <Controller name="levelId" control={control} render={({ field }) => (
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
                                )} />
                                {errors.levelId && <p className="text-red-500 text-xs mt-1">{errors.levelId.message as string}</p>}
                            </div>

                             {unit.childUnitIds && unit.childUnitIds.length > 0 && (
                                <div className="space-y-2 rounded-lg border bg-background p-4">
                                     <h3 className="font-medium flex items-center gap-2 text-sm"><LinkIcon className="h-4 w-4"/> Linked Child Units</h3>
                                     <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                        {unit.childUnitIds.map(childId => {
                                            const childUnit = allUnits.find(u => u.id === childId);
                                            return <li key={childId}>{childUnit ? `Unit ${childUnit.unitNumber} on level "${levelsMap.get(childUnit.levelId)}"` : `Unknown Unit (${childId})`}</li>;
                                        })}
                                     </ul>
                                </div>
                            )}

                    </CardContent>
                </Card>

                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        )}
    </main>
  );
}

    