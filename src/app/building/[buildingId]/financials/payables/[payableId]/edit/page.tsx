
'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ExpenseEditDialog } from '@/components/expense-edit-dialog';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Payable } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditPayablePage() {
    const { buildingId, payableId } = useParams() as { buildingId: string; payableId: string };
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();

    const payableRef = React.useMemo(() => doc(firestore, 'buildings', buildingId, 'payables', payableId), [firestore, buildingId, payableId]);
    const { data: payable } = useDoc<Payable>(payableRef);

    const handleBack = () => {
        const query = searchParams.toString();
        // Since this page is now just a trigger for a dialog, we redirect back to the main list.
        router.push(`/building/${buildingId}/financials/payables?${query}`);
    };

    if (!payable) {
        return (
             <div className="w-full max-w-xl mx-auto space-y-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }
    
    return (
        <ExpenseEditDialog
            isOpen={true}
            onOpenChange={(open) => {
                if (!open) {
                    handleBack();
                }
            }}
            buildingId={buildingId}
            payable={payable}
        />
    );
}

    