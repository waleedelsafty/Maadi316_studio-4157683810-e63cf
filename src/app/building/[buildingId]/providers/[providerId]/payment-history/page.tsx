
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ServiceProvider, ContractPaymentHistory } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function ProviderPaymentHistoryPage() {
    const { buildingId, providerId } = useParams() as { buildingId: string; providerId: string; };
    const router = useRouter();
    const firestore = useFirestore();

    const providerRef = useMemo(() => {
        if (!firestore || !buildingId || !providerId) return null;
        return doc(firestore, 'buildings', buildingId, 'serviceProviders', providerId);
    }, [firestore, buildingId, providerId]);
    const { data: provider } = useDoc<ServiceProvider>(providerRef);

    const paymentHistoryQuery = useMemo(() => {
        if (!firestore || !buildingId || !providerId) return null;
        return query(
            collection(firestore, 'buildings', buildingId, 'serviceProviders', providerId, 'paymentHistory'),
            orderBy('effectiveDate', 'desc')
        );
    }, [firestore, buildingId, providerId]);

    const { data: paymentHistory } = useCollection<ContractPaymentHistory>(paymentHistoryQuery);

    return (
        <main className="w-full max-w-4xl space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}/providers`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to All Providers
                </Button>
            </div>

            <Card>
                <CardHeader>
                    {provider ? (
                        <div>
                            <CardTitle>Payment History for {provider.name}</CardTitle>
                            <CardDescription>A complete log of all payment adjustments for this service provider.</CardDescription>
                            <Badge variant="secondary" className="mt-2">{provider.serviceType}</Badge>
                        </div>
                    ) : (
                         <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Effective Date</TableHead>
                                    <TableHead>Payment Amount</TableHead>
                                    <TableHead>Reason for Change</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paymentHistory && paymentHistory.length > 0 ? (
                                    paymentHistory.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-semibold">{format(record.effectiveDate.toDate(), 'PPP')}</TableCell>
                                            <TableCell>
                                                {record.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                                {provider?.paymentPeriod && ` / ${provider.paymentPeriod}`}
                                            </TableCell>
                                            <TableCell>{record.changeReason || '—'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : paymentHistory ? (
                                     <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            No payment history found for this provider.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
