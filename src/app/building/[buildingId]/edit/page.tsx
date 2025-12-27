
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Building } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CalendarIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  Building_name: z.string().min(1, 'Building name is required'),
  address: z.string().min(1, 'Building address is required'),
  hasBasement: z.boolean().default(false),
  basementCount: z.coerce.number().optional(),
  hasMezzanine: z.boolean().default(false),
  mezzanineCount: z.coerce.number().optional(),
  hasPenthouse: z.boolean().default(false),
  hasRooftop: z.boolean().default(false),
  financialStartDate: z.date().optional(),
});

export default function EditBuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const buildingRef = React.useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc(buildingRef);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        control,
        watch
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    const hasBasement = watch('hasBasement');
    const hasMezzanine = watch('hasMezzanine');

    React.useEffect(() => {
        if (building) {
            const buildingName = (building as any)?.Building_name || (building as any)?.name || '';
            reset({
                Building_name: buildingName,
                address: building.address || '',
                hasBasement: building.hasBasement || false,
                basementCount: building.basementCount || 1,
                hasMezzanine: building.hasMezzanine || false,
                mezzanineCount: building.mezzanineCount || 1,
                hasPenthouse: building.hasPenthouse || false,
                hasRooftop: building.hasRooftop || false,
                financialStartDate: building.financialStartDate?.toDate() || undefined,
            });
        }
    }, [building, reset]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!buildingRef) return;

        const submissionData: any = {
            ...data,
            basementCount: data.hasBasement ? data.basementCount : 0,
            mezzanineCount: data.hasMezzanine ? data.mezzanineCount : 0,
            financialStartDate: data.financialStartDate ? Timestamp.fromDate(data.financialStartDate) : null
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

    return (
        <main className="w-full max-w-2xl">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building
                </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Building</CardTitle>
                        <CardDescription>
                            Make changes to your building details. Click save when you're done.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 py-6">
                        {!building ? (
                             <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="Building_name">Building Name</Label>
                                    <Input id="Building_name" {...register('Building_name')} placeholder="e.g., 'Main Street Plaza'" />
                                    {errors.Building_name && <p className="text-red-500 text-xs mt-1">{errors.Building_name.message as string}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="address">Address</Label>
                                    <Input id="address" {...register('address')} placeholder="e.g., '123 Main St, Anytown, USA'"/>
                                    {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message as string}</p>}
                                </div>
                                
                                <div>
                                    <Label htmlFor="financialStartDate">Financial Start Date</Label>
                                    <Controller
                                        name="financialStartDate"
                                        control={control}
                                        render={({ field }) => (
                                        <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                    {errors.financialStartDate && <p className="text-red-500 text-xs mt-1">{errors.financialStartDate.message as string}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">Date to start calculating financial balances for all units.</p>
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
                                                    <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value || 1)}>
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
                                                    <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value || 1)}>
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
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !building}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </main>
    );
}
