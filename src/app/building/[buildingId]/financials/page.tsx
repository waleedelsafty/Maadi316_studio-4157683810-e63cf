
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit, Payment } from '@/types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BuildingUnitsTab } from '@/components/building-units-tab';
import { BuildingPaymentsTab } from '@/components/building-payments-tab';


export default function BuildingFinancialsPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    
    // Firestore Hooks
    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);

    const { data: levels } = useCollection(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection(unitsQuery);

    const paymentsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'payments'));
    }, [firestore, buildingId]);
    const { data: payments } = useCollection(paymentsQuery);

    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this section.</p>
                <Button asChild className="mt-4">
                    <Link href="/">Go to Homepage</Link>
                </Button>
            </div>
        )
    }

    if (building?.isDeleted) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">Building Deleted</p>
                <p>This building is in the recycle bin. You can restore it from the settings page.</p>
                 <Button asChild className="mt-4">
                    <Link href="/settings/recycle-bin">Go to Recycle Bin</Link>
                </Button>
            </div>
        )
    }

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <div className="space-y-4">
                <BuildingPaymentsTab building={building} units={units} payments={payments} />
                <BuildingUnitsTab building={building} levels={levels} units={units} payments={payments} />
            </div>
        </main>
    );
}
