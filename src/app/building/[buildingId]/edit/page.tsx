
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, updateDoc, Timestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Building, GlobalUnitType } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { parseDate, getLocalTimeZone } from '@internationalized/date';
import { I18nProvider } from 'react-aria';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  address: z.string().min(1, 'Building address is required'),
  hasBasement: z.boolean().default(false),
  basementCount: z.coerce.number().optional(),
  hasMezzanine: z.boolean().default(false),
  mezzanineCount: z.coerce.number().optional(),
  hasPenthouse: z.boolean().default(false),
  hasRooftop: z.boolean().default(false),
  financialStartDate: z.any().optional(),
  enabledUnitTypeIds: z.array(z.string()).default([]),
});

export default function EditBuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Fetch Global App Settings for Unit Types
    const unitTypesCollectionRef = React.useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
    const { data: globalUnitTypes } = useCollection<GlobalUnitType>(unitTypesCollectionRef);

    // Fetch Building Data
    const buildingRef = React.useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            enabledUnitTypeIds: [],
        },
    });

    const hasBasement = form.watch('hasBasement');
    const hasMezzanine = form.watch('hasMezzanine');

    React.useEffect(() => {
        if (building) {
            form.reset({
                name: building.name || '',
                address: building.address || '',
                hasBasement: building.hasBasement || false,
                basementCount: building.basementCount || 1,
                hasMezzanine: building.hasMezzanine || false,
                mezzanineCount: building.mezzanineCount || 1,
                hasPenthouse: building.hasPenthouse || false,
                hasRooftop: building.hasRooftop || false,
                financialStartDate: building.financialStartDate ? parseDate(building.financialStartDate.toDate().toISOString().split('T')[0]) : null,
                enabledUnitTypeIds: building.enabledUnitTypeIds || [],
            });
        }
    }, [building, form]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!buildingRef) return;

        const submissionData: any = {
            name: data.name,
            address: data.address,
            hasBasement: data.hasBasement,
            basementCount: data.hasBasement ? data.basementCount : 0,
            hasMezzanine: data.hasMezzanine,
            mezzanineCount: data.hasMezzanine ? data.mezzanineCount : 0,
            hasPenthouse: data.hasPenthouse,
            hasRooftop: data.hasRooftop,
            financialStartDate: data.financialStartDate ? Timestamp.fromDate(data.financialStartDate.toDate(getLocalTimeZone())) : null,
            enabledUnitTypeIds: data.enabledUnitTypeIds,
        };

        updateDoc(buildingRef, submissionData)
            .then(() => {
                toast({
                    title: 'Building Updated',
                    description: 'The building details have been saved.',
                });
                router.push(`/building/${buildingId}`);
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: buildingRef.path,
                    operation: 'update',
                    requestResourceData: submissionData,
                }));
            });
    };

    const isLoading = !building || globalUnitTypes === undefined;

    return (
        <I18nProvider locale="en-US">
        <main className="w-full max-w-3xl">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building
                </Button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Building</CardTitle>
                        <CardDescription>
                            Make changes to your building details. Click save when you're done.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 py-6">
                        {isLoading ? (
                             <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="name">Building Name</Label>
                                        <Input id="name" {...form.register('name')} placeholder="e.g., 'Main Street Plaza'" />
                                        {form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message as string}</p>}
                                    </div>
                                    <div>
                                        <Label htmlFor="address">Address</Label>
                                        <Input id="address" {...form.register('address')} placeholder="e.g., '123 Main St, Anytown, USA'"/>
                                        {form.formState.errors.address && <p className="text-red-500 text-xs mt-1">{form.formState.errors.address.message as string}</p>}
                                    </div>
                                </div>
                                
                                <div>
                                    <Label htmlFor="financialStartDate">Financial Start Date</Label>
                                    <Controller
                                        name="financialStartDate"
                                        control={form.control}
                                        render={({ field }) => (
                                            <DatePicker 
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                    {form.formState.errors.financialStartDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.financialStartDate.message as string}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">Date to start calculating financial balances for all units.</p>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                     <h3 className="font-medium">Structure Options</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <Label>Has Basement</Label>
                                            </div>
                                            <Controller name="hasBasement" control={form.control} render={({ field }) => ( <Switch checked={field.value} onCheckedChange={field.onChange} /> )} />
                                        </div>
                                        {hasBasement && (
                                            <div className="pl-4">
                                                <Label>Number of Basement Levels</Label>
                                                <Controller name="basementCount" control={form.control} render={({ field }) => (<Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value || 1)}><SelectTrigger><SelectValue placeholder="Select number of levels" /></SelectTrigger><SelectContent>{[1, 2, 3].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}</SelectContent></Select>)} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <Label>Has Mezzanine</Label>
                                            </div>
                                            <Controller name="hasMezzanine" control={form.control} render={({ field }) => ( <Switch checked={field.value} onCheckedChange={field.onChange} /> )}/>
                                        </div>
                                        {hasMezzanine && (
                                            <div className="pl-4">
                                                <Label>Number of Mezzanine Levels</Label>
                                                <Controller name="mezzanineCount" control={form.control} render={({ field }) => (<Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value || 1)}><SelectTrigger><SelectValue placeholder="Select number of levels" /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}</SelectContent></Select>)} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <Label>Has Penthouse</Label>
                                        <Controller name="hasPenthouse" control={form.control} render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)}/>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <Label>Has Rooftop</Label>
                                        <Controller name="hasRooftop" control={form.control} render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} /> )}/>
                                    </div>
                                </div>
                                
                                <Separator />
                                
                                <div className="space-y-4">
                                    <h3 className="font-medium">Available Unit Types</h3>
                                    <p className="text-sm text-muted-foreground">Select which globally-defined unit types are available for units in this building.</p>
                                    
                                    {globalUnitTypes && globalUnitTypes.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-lg border p-4">
                                            {globalUnitTypes.map((type) => (
                                                <Controller
                                                    key={type.id}
                                                    name="enabledUnitTypeIds"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`type-${type.id}`}
                                                                checked={field.value?.includes(type.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...(field.value || []), type.id])
                                                                        : field.onChange(field.value?.filter((value) => value !== type.id));
                                                                }}
                                                            />
                                                            <Label htmlFor={`type-${type.id}`} className="font-normal cursor-pointer">{type.name}</Label>
                                                        </div>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                         <Alert>
                                            <Terminal className="h-4 w-4" />
                                            <AlertTitle>No Global Unit Types Found</AlertTitle>
                                            <AlertDescription>
                                                You must first define some unit types in the main application settings.
                                                <Button variant="link" asChild className="p-0 h-auto ml-1"><Link href="/settings/unit-types">Go to Global Unit Type Settings</Link></Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                        Save Changes
                    </Button>
                </div>
            </form>
        </main>
        </I18nProvider>
    );
}
