

'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Owner, Unit, Payment, Building, GlobalUnitType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, User, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuartersForRange } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { EditOwnerDialog } from '@/components/edit-owner-dialog';
import Link from 'next/link';

function FinancialStatusCard({ 
    title, 
    value, 
    label, 
    className,
    isLink = false,
    href = ''
}: { 
    title: string; 
    value: number | string; 
    label: string, 
    className?: string,
    isLink?: boolean,
    href?: string,
}) {
    const cardContent = (
        <div className={cn(
            "flex-1 rounded-lg border bg-card text-card-foreground shadow-sm p-1",
            isLink && "transition-colors hover:bg-muted/50",
            className
        )}>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-lg font-bold", typeof value === 'number' && value < 0 && 'text-destructive')}>
                {typeof value === 'number' ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );

    if (isLink) {
        return <Link href={href} className="flex-1">{cardContent}</Link>;
    }
    
    return cardContent;
}


export default function OwnerDashboardPage() {
    const { buildingId, ownerId } = useParams() as { buildingId: string; ownerId: string };
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromPath = searchParams.get('from');

    const firestore = useFirestore();
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

    // --- Data Fetching ---
    const ownerRef = React.useMemo(() => doc(firestore, 'buildings', buildingId, 'owners', ownerId), [firestore, buildingId, ownerId]);
    const { data: owner } = useDoc<Owner>(ownerRef);

    const buildingRef = React.useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);
    
    const unitsQuery = React.useMemo(() => {
        if (!firestore || !buildingId || !ownerId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'), where('ownerId', '==', ownerId));
    }, [firestore, buildingId, ownerId]);
    const { data: ownedUnits } = useCollection<Unit>(unitsQuery);

    const paymentsQuery = React.useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'payments'));
    }, [firestore, buildingId]);
    const { data: allPayments } = useCollection<Payment>(paymentsQuery);
    
    const globalUnitTypesQuery = React.useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
    const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);

    // --- Memoized Calculations ---
    const unitTypesMap = React.useMemo(() => {
        if (!globalUnitTypes) return new Map<string, string>();
        return new Map(globalUnitTypes.map(t => [t.id, t.name]));
    }, [globalUnitTypes]);

    const quartersInRange = React.useMemo(() => {
        if (!building?.financialStartDate) return [];
        return getQuartersForRange(building.financialStartDate.toDate(), 'all_since_start');
    }, [building]);

    const financialDataByUnit = React.useMemo(() => {
        const results = new Map<string, { totalDue: number; totalPaid: number; balance: number }>();
        if (!ownedUnits || !allPayments || quartersInRange.length === 0) return results;

        ownedUnits.forEach(unit => {
            const totalDue = (unit.quarterlyMaintenanceFees || 0) * quartersInRange.length;
            const totalPaid = allPayments
                .filter(p => p.unitId === unit.id && quartersInRange.includes(p.quarter))
                .reduce((sum, p) => sum + p.amount, 0);
            const balance = totalPaid - totalDue;
            results.set(unit.id, { totalDue, totalPaid, balance });
        });
        return results;
    }, [ownedUnits, allPayments, quartersInRange]);

    const isLoading = !owner || !ownedUnits || !building || !globalUnitTypes;
    
    const backPath = fromPath || `/building/${buildingId}/owners`;
    const backButtonText = fromPath ? 'Back' : 'Back to All Owners';


    return (
        <>
        <main className="w-full max-w-4xl space-y-2">
            <div className="mb-1">
                <Button variant="ghost" onClick={() => router.push(backPath)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0 h-8">
                    <ArrowLeft className="h-4 w-4" /> {backButtonText}
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center p-3">
                    {isLoading ? (
                        <div className="space-y-1">
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    ) : (
                         <div className="flex items-baseline gap-x-3">
                            <CardTitle className="text-xl">{owner.name}</CardTitle>
                            <CardDescription>Owner Dashboard</CardDescription>
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} disabled={isLoading}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Owner
                    </Button>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    {isLoading ? <Skeleton className="h-5 w-full" /> : (
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {owner.contactPerson && <div className="flex items-center gap-1"><User className="h-4 w-4" /><span>Contact: <strong>{owner.contactPerson}</strong></span></div>}
                            {owner.email && <div className="flex items-center gap-1"><Mail className="h-4 w-4" /><span>{owner.email}</span></div>}
                            {owner.phoneNumber && <div className="flex items-center gap-1"><Phone className="h-4 w-4" /><span>{owner.phoneNumber}</span></div>}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-2">
                 <h2 className="text-lg font-semibold px-1">Owned Units & Financials</h2>
                 {isLoading ? (
                     [...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                 ) : ownedUnits.length > 0 ? (
                     ownedUnits.map(unit => {
                         const financials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0, balance: 0 };
                         return (
                            <Card key={unit.id}>
                                <CardContent className="flex flex-col md:flex-row gap-2 p-1">
                                     <div className="md:flex-none md:w-48 rounded-lg border bg-card text-card-foreground shadow-sm p-2">
                                        <div className="flex items-baseline gap-2">
                                            <p className="font-bold text-base leading-tight">{unitTypesMap.get(unit.unitTypeId) || 'N/A'} {unit.unitNumber}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Quarterly Fee</p>
                                        <p className="text-sm font-semibold">
                                            {(unit.quarterlyMaintenanceFees || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                        </p>
                                    </div>
                                     <FinancialStatusCard title="Total Due" value={financials.totalDue} label={`Across ${quartersInRange.length} quarters`} />
                                     <FinancialStatusCard 
                                        title="Total Paid" 
                                        value={financials.totalPaid} 
                                        label="All recorded payments"
                                        isLink={true}
                                        href={`/building/${buildingId}/unit/${unit.id}/payments`}
                                    />
                                     <FinancialStatusCard title="Balance" value={financials.balance} label="Paid - Due" />
                                </CardContent>
                            </Card>
                         )
                     })
                 ) : (
                     <p className="text-muted-foreground text-center py-4 text-sm">This owner does not have any units assigned to them in this building.</p>
                 )}
            </div>
        </main>
        {owner && (
            <EditOwnerDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                owner={owner}
                buildingId={buildingId}
            />
        )}
        </>
    );
}
