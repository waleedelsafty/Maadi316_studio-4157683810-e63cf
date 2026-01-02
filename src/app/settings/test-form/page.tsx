
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc, useUser, useCollection } from '@/firebase';
import { doc, setDoc, Timestamp, collection, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { TestRecord, Owner, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { I18nProvider } from 'react-aria';
import { parseDate, getLocalTimeZone } from '@internationalized/date';

const recordTypes = [0, 1, 2, 3, 4];
const TEST_RECORD_ID = 'main-test-record';

const formSchema = z.object({
  date: z.any().optional(),
  ownerId: z.string().min(1, "Owner is required."),
  type: z.coerce.number(),
});

export default function TestFormPage() {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // --- Data Fetching ---
    const { data: userProfile } = useDoc<UserProfile>(user ? doc(firestore, 'users', user.uid) : null);
    const defaultBuildingId = userProfile?.defaultBuildingId;

    const testRecordRef = React.useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'testRecords', TEST_RECORD_ID);
    }, [firestore]);
    const { data: testRecord } = useDoc<TestRecord>(testRecordRef);

    const ownersQuery = React.useMemo(() => {
        if (!firestore || !defaultBuildingId) return null;
        return query(collection(firestore, 'buildings', defaultBuildingId, 'owners'));
    }, [firestore, defaultBuildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    // --- Form Setup ---
    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: null,
            ownerId: '',
            type: 0,
        }
    });

    // --- Effect to pre-fill form ---
    React.useEffect(() => {
        if (testRecord) {
            reset({
                date: testRecord.date ? parseDate(testRecord.date.toDate().toISOString().split('T')[0]) : null,
                ownerId: testRecord.ownerId || '',
                type: testRecord.type ?? 0,
            });
        }
    }, [testRecord, reset]);

    // --- Actions ---
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!testRecordRef) return;

        const submissionData = {
            ...data,
            date: data.date ? Timestamp.fromDate(data.date.toDate(getLocalTimeZone())) : Timestamp.now(),
        };

        setDoc(testRecordRef, submissionData, { merge: true })
            .then(() => {
                toast({
                    title: 'Record Saved',
                    description: 'The test record has been updated successfully.',
                });
            })
            .catch((e) => {
                console.error(e);
                toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: 'Could not save the record.',
                });
            });
    };

    const isLoading = !owners || testRecord === undefined;

    return (
        <I18nProvider locale="en-US">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Form Field Test</CardTitle>
                    <CardDescription>
                        This page is for testing the state management of form fields, especially date pickers and dropdowns. Edit the record and save. When you reload the page, the fields should show the saved values.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <Label>Date</Label>
                                <Controller
                                    name="date"
                                    control={control}
                                    render={({ field }) => (
                                        <DatePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message as string}</p>}
                            </div>
                            
                            <div>
                                <Label>Owner</Label>
                                <Controller
                                    name="ownerId"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an owner..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {owners && owners.length > 0 ? (
                                                    owners.map(owner => (
                                                        <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                                                    ))
                                                ) : (
                                                    <SelectItem value="no-owners" disabled>No owners found in default building</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.ownerId && <p className="text-red-500 text-xs mt-1">{errors.ownerId.message as string}</p>}
                            </div>

                            <div>
                                <Label>Type</Label>
                                <Controller
                                    name="type"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a type..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {recordTypes.map(type => (
                                                    <SelectItem key={type} value={String(type)}>Type {type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message as string}</p>}
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save Test Record'}
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </I18nProvider>
    );
}

    