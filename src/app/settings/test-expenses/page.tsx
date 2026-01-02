
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { UserProfile, Payable } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExpenseEditDialog } from '@/components/expense-edit-dialog';

export default function TestExpensesPage() {
    const firestore = useFirestore();
    const user = useUser();

    // State
    const [editingExpense, setEditingExpense] = React.useState<Payable | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // --- Data Fetching ---
    const userProfileRef = React.useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const defaultBuildingId = userProfile?.defaultBuildingId;

    const payablesQuery = React.useMemo(() => {
        if (!firestore || !defaultBuildingId) return null;
        return query(collection(firestore, 'buildings', defaultBuildingId, 'payables'), orderBy('expenseDate', 'desc'));
    }, [firestore, defaultBuildingId]);
    const { data: payables } = useCollection<Payable>(payablesQuery);
    
    const handleEditClick = (payable: Payable) => {
        setEditingExpense(payable);
        setIsDialogOpen(true);
    };
    
    const handleDialogChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingExpense(null);
        }
    }

    const isLoading = userProfile === undefined || (defaultBuildingId && payables === null);

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Test Expenses</CardTitle>
                    <CardDescription>A list of expenses from your default building. Click one to open the edit dialog.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg p-4">
                        <Skeleton className="h-40 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!defaultBuildingId) {
        return <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Default Building Set</AlertTitle><AlertDescription>Please select a default building in the "My Buildings" page to use this test page.</AlertDescription></Alert>;
    }

    return (
        <>
            <Card>
                 <CardHeader>
                    <CardTitle>Test Expenses</CardTitle>
                    <CardDescription>A list of expenses from your default building. Click one to open the edit dialog.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payables && payables.length > 0 ? payables.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(p.expenseDate.toDate(), 'PPP')}</TableCell>
                                        <TableCell className="font-medium">{p.description}</TableCell>
                                        <TableCell>{p.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleEditClick(p)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">No expenses found in default building.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {defaultBuildingId && (
                 <ExpenseEditDialog
                    isOpen={isDialogOpen}
                    onOpenChange={handleDialogChange}
                    buildingId={defaultBuildingId}
                    payable={editingExpense}
                />
            )}
        </>
    );
}
