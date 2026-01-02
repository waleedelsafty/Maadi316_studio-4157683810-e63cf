
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Employee, SalaryHistory } from '@/types';
import { ArrowLeft, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AdjustSalaryDialog } from '@/components/adjust-salary-dialog';

export default function SalaryHistoryPage() {
    const { buildingId, employeeId } = useParams() as { buildingId: string; employeeId: string; };
    const router = useRouter();
    const firestore = useFirestore();
    const [editingRecord, setEditingRecord] = useState<SalaryHistory | null>(null);

    const employeeRef = useMemo(() => {
        if (!firestore || !buildingId || !employeeId) return null;
        return doc(firestore, 'buildings', buildingId, 'employees', employeeId);
    }, [firestore, buildingId, employeeId]);
    const { data: employee } = useDoc<Employee>(employeeRef);

    const salaryHistoryQuery = useMemo(() => {
        if (!firestore || !buildingId || !employeeId) return null;
        return query(
            collection(firestore, 'buildings', buildingId, 'employees', employeeId, 'salaryHistory'),
            orderBy('effectiveDate', 'desc')
        );
    }, [firestore, buildingId, employeeId]);

    const { data: salaryHistory } = useCollection<SalaryHistory>(salaryHistoryQuery);
    
    const getInitials = (name: string | null | undefined) => {
        if (!name) return '??';
        return name.split(' ').map((n) => n[0]).join('');
    };

    return (
        <>
        <main className="w-full max-w-4xl space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}/employees`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to All Employees
                </Button>
            </div>

            <Card>
                <CardHeader>
                    {employee ? (
                        <div className="flex items-center gap-4">
                             <Avatar className="h-16 w-16">
                                <AvatarImage src={employee.photoUrl} alt={employee.name} />
                                <AvatarFallback className="text-xl">{getInitials(employee.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle>Salary History for {employee.name}</CardTitle>
                                <CardDescription>A complete log of all salary adjustments for this employee.</CardDescription>
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center gap-4">
                             <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Effective Date</TableHead>
                                    <TableHead>Salary Amount</TableHead>
                                    <TableHead>Reason for Change</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salaryHistory && salaryHistory.length > 0 ? (
                                    salaryHistory.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-semibold">{format(record.effectiveDate.toDate(), 'PPP')}</TableCell>
                                            <TableCell>{record.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                            <TableCell>{record.changeReason || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingRecord(record)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : salaryHistory ? (
                                     <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No salary history found for this employee.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
        {employee && (
            <AdjustSalaryDialog 
                employee={employee}
                buildingId={buildingId}
                isOpen={!!editingRecord}
                onOpenChange={(isOpen) => !isOpen && setEditingRecord(null)}
                existingRecord={editingRecord}
            />
        )}
        </>
    );
}
