
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { parseDate, getLocalTimeZone } from '@internationalized/date';
import { I18nProvider } from 'react-aria';

const jobTitles: Employee['jobTitle'][] = ["Security", "Doorman", "Concierge", "Gardner"];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phoneNumber: z.string().optional(),
  idNumber: z.string().min(1, 'ID number is required'),
  photoUrl: z.string().url().optional().or(z.literal('')),
  jobTitle: z.enum(jobTitles),
  jobDescription: z.string().optional(),
  hireDate: z.any(),
});

export default function EditEmployeePage() {
    const { buildingId, employeeId } = useParams() as { buildingId: string, employeeId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const employeeRef = React.useMemo(() => {
        if (!firestore || !buildingId || !employeeId) return null;
        return doc(firestore, 'buildings', buildingId, 'employees', employeeId);
    }, [firestore, buildingId, employeeId]);

    const { data: employee } = useDoc<Employee>(employeeRef);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        control
    } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    React.useEffect(() => {
        if (employee) {
            reset({
                name: employee.name,
                phoneNumber: employee.phoneNumber,
                idNumber: employee.idNumber,
                photoUrl: employee.photoUrl,
                jobTitle: employee.jobTitle,
                jobDescription: employee.jobDescription,
                hireDate: employee.hireDate ? parseDate(employee.hireDate.toDate().toISOString().split('T')[0]) : null,
            });
        }
    }, [employee, reset]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!employeeRef) return;

        const submissionData = {
            ...data,
            hireDate: Timestamp.fromDate(data.hireDate.toDate(getLocalTimeZone())),
        };

        updateDoc(employeeRef, submissionData)
            .then(() => {
                toast({
                    title: 'Employee Updated',
                    description: `${data.name}'s profile has been saved.`,
                });
                router.push(`/building/${buildingId}/employees`);
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: employeeRef.path,
                    operation: 'update',
                    requestResourceData: submissionData,
                }));
            });
    };

    return (
        <I18nProvider locale="en-US">
        <main className="w-full max-w-2xl">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}/employees`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Employees
                </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Employee</CardTitle>
                        <CardDescription>
                            Make changes to the employee's profile. Click save when you're done.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 py-6">
                        {!employee ? (
                             <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" {...register('name')} />
                                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="phoneNumber">Phone Number</Label>
                                        <Input id="phoneNumber" {...register('phoneNumber')} />
                                    </div>
                                     <div>
                                        <Label htmlFor="idNumber">ID Number</Label>
                                        <Input id="idNumber" {...register('idNumber')} />
                                        {errors.idNumber && <p className="text-red-500 text-xs mt-1">{errors.idNumber.message}</p>}
                                    </div>
                                </div>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <Label>Job Title</Label>
                                        <Controller
                                            name="jobTitle"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>{jobTitles.map(title => <SelectItem key={title} value={title}>{title}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )}
                                        />
                                         {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle.message}</p>}
                                    </div>
                                    <div>
                                        <Label>Hire Date</Label>
                                        <Controller
                                            name="hireDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DatePicker 
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="jobDescription">Job Description</Label>
                                    <Textarea id="jobDescription" {...register('jobDescription')} />
                                </div>
                                <div>
                                    <Label htmlFor="photoUrl">Photo URL</Label>
                                    <Input id="photoUrl" {...register('photoUrl')} />
                                    {errors.photoUrl && <p className="text-red-500 text-xs mt-1">{errors.photoUrl.message}</p>}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.push(`/building/${buildingId}/employees`)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !employee}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </main>
        </I18nProvider>
    );
}
