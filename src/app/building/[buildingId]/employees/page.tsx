
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, deleteDoc, Timestamp, writeBatch, orderBy, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Employee, SalaryHistory } from '@/types';
import { ArrowLeft, Trash2, History, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AdjustSalaryDialog } from '@/components/adjust-salary-dialog';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { type CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { I18nProvider } from 'react-aria';

const jobTitles: Employee['jobTitle'][] = ["Security", "Doorman", "Concierge", "Gardner"];

type EmployeeWithSalary = Employee & { currentSalary?: number };

export default function EmployeesPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [jobTitle, setJobTitle] = useState<Employee['jobTitle'] | ''>('');
    const [jobDescription, setJobDescription] = useState('');
    const [initialSalary, setInitialSalary] = useState<number | ''>('');
    const [hireDate, setHireDate] = useState<CalendarDate | null>(null);
    const [photoUrl, setPhotoUrl] = useState('');

    // Dialog state
    const [adjustSalaryEmployee, setAdjustSalaryEmployee] = useState<Employee | null>(null);

    // Firestore Hooks
    const employeesQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'employees'));
    }, [firestore, buildingId]);

    const { data: employees } = useCollection(employeesQuery);

    const [employeesWithSalaries, setEmployeesWithSalaries] = useState<EmployeeWithSalary[]>([]);

    // Fetch current salaries for all employees
    useMemo(() => {
        if (!employees || !firestore || !buildingId) {
            setEmployeesWithSalaries([]);
            return;
        }

        const fetchSalaries = async () => {
            const enrichedEmployees = await Promise.all(
                employees.map(async (employee) => {
                    const salaryHistoryQuery = query(
                        collection(firestore, 'buildings', buildingId, 'employees', employee.id, 'salaryHistory'),
                        orderBy('effectiveDate', 'desc'),
                    );
                    
                    return new Promise<EmployeeWithSalary>((resolve) => {
                        const unsubscribe = onSnapshot(salaryHistoryQuery, (snapshot) => {
                            const latestSalaryRecord = snapshot.docs[0]?.data() as SalaryHistory | undefined;
                            resolve({ ...employee, currentSalary: latestSalaryRecord?.amount });
                            unsubscribe();
                        }, () => resolve(employee));
                    });
                })
            );
            setEmployeesWithSalaries(enrichedEmployees);
        };
        fetchSalaries();

    }, [employees, firestore, buildingId]);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !idNumber.trim() || !jobTitle || initialSalary === '' || !hireDate || !firestore) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill out all required employee details.' });
            return;
        }

        const hireDateAsDate = hireDate.toDate(getLocalTimeZone());

        const newEmployeeData = {
            name, idNumber, phoneNumber, photoUrl, jobTitle, jobDescription,
            hireDate: Timestamp.fromDate(hireDateAsDate),
            createdAt: serverTimestamp(),
        };
        
        try {
            const batch = writeBatch(firestore);
            
            const employeeRef = doc(collection(firestore, 'buildings', buildingId, 'employees'));
            batch.set(employeeRef, newEmployeeData);
            
            const salaryHistoryRef = doc(collection(firestore, 'buildings', buildingId, 'employees', employeeRef.id, 'salaryHistory'));
            const initialSalaryData = {
                amount: Number(initialSalary),
                effectiveDate: Timestamp.fromDate(hireDateAsDate),
                changeReason: 'Initial Salary',
            };
            batch.set(salaryHistoryRef, initialSalaryData);

            await batch.commit();

            setName(''); setPhoneNumber(''); setIdNumber(''); setInitialSalary(''); setHireDate(null); setPhotoUrl(''); setJobTitle(''); setJobDescription('');
            setIsAdding(false);
            toast({ title: 'Employee Added', description: `${name} has been added to the staff.` });

        } catch (error) {
            console.error("Error adding employee:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `/buildings/${buildingId}/employees`, operation: 'create', requestResourceData: newEmployeeData,
            }));
        }
    };

    const handleDeleteEmployee = (employeeId: string, employeeName: string) => {
        if (!firestore || !buildingId) return;
        const employeeRef = doc(firestore, 'buildings', buildingId, 'employees', employeeId);
        deleteDoc(employeeRef)
            .then(() => {
                toast({ title: "Employee Removed", description: `${employeeName} has been removed from the staff records.` });
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: employeeRef.path, operation: 'delete' }));
            });
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return '??';
        return name.split(' ').map((n) => n[0]).join('');
    };

    return (
        <I18nProvider locale="en-US">
        <main className="w-full max-w-6xl space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Employee Management</CardTitle>
                            <CardDescription>Add, view, and manage your building's staff.</CardDescription>
                        </div>
                        {!isAdding && <Button onClick={() => setIsAdding(true)}>Add New Employee</Button>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isAdding && (
                        <form onSubmit={handleAddEmployee} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Add a New Employee</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                <Input placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="ID Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
                                <Select onValueChange={(value) => setJobTitle(value as Employee['jobTitle'])} value={jobTitle}>
                                    <SelectTrigger><SelectValue placeholder="Select Job Title" /></SelectTrigger>
                                    <SelectContent>{jobTitles.map(title => (<SelectItem key={title} value={title}>{title}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                             <div className="grid sm:grid-cols-2 gap-4">
                                <Input type="number" placeholder="Initial Monthly Salary" value={initialSalary} onChange={e => setInitialSalary(Number(e.target.value))} required />
                                <DatePicker value={hireDate} onChange={setHireDate} />
                            </div>
                            <div>
                                <Textarea placeholder="Job Description (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                            </div>
                             <div>
                                <Input placeholder="Photo URL (optional)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">Save Employee</Button>
                                <Button variant="outline" type="button" onClick={() => setIsAdding(false)}>Cancel</Button>
                            </div>
                        </form>
                    )}

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Job Title</TableHead>
                                    <TableHead>Hire Date</TableHead>
                                    <TableHead>Current Salary</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesWithSalaries && employeesWithSalaries.length > 0 ? (
                                    employeesWithSalaries.map((employee) => (
                                        <TableRow key={employee.id}>
                                            <TableCell className="font-semibold flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={employee.photoUrl} alt={employee.name} />
                                                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                                                </Avatar>
                                                {employee.name}
                                            </TableCell>
                                            <TableCell>{employee.jobTitle}</TableCell>
                                            <TableCell>{format(employee.hireDate.toDate(), 'PPP')}</TableCell>
                                            <TableCell>
                                                {employee.currentSalary !== undefined ? employee.currentSalary.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                     <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/building/${buildingId}/employees/${employee.id}/edit`}>
                                                            <Edit className="h-4 w-4 mr-2" /> Edit
                                                        </Link>
                                                    </Button>
                                                     <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/building/${buildingId}/employees/${employee.id}/salary`}>
                                                            <History className="h-4 w-4 mr-2" /> History
                                                        </Link>
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => setAdjustSalaryEmployee(employee)}>
                                                        Adjust Salary
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently remove {employee.name} from the staff records.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteEmployee(employee.id, employee.name)}>Continue</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No employees have been added yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
        {adjustSalaryEmployee && (
            <AdjustSalaryDialog 
                employee={adjustSalaryEmployee}
                buildingId={buildingId}
                isOpen={!!adjustSalaryEmployee}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setAdjustSalaryEmployee(null);
                }}
            />
        )}
        </I18nProvider>
    );
}
