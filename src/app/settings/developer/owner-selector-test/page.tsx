
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, Owner } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { OwnerCombobox } from '@/components/owner-combobox';

function OwnerInfoCard({ owner }: { owner: Owner | null }) {
    if (!owner) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Owner Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No owner selected.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
         <Card>
            <CardHeader>
                <CardTitle>{owner.name}</CardTitle>
                <CardDescription>ID: {owner.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <p><strong className="text-muted-foreground">Email:</strong> {owner.email || 'N/A'}</p>
                <p><strong className="text-muted-foreground">Phone:</strong> {owner.phoneNumber || 'N/A'}</p>
                <p><strong className="text-muted-foreground">Contact Person:</strong> {owner.contactPerson || 'N/A'}</p>
            </CardContent>
        </Card>
    )
}


export default function OwnerSelectorTestPage() {
    const firestore = useFirestore();
    const user = useUser();

    // State for selection
    const [selectedOwnerId, setSelectedOwnerId] = React.useState<string | null>(null);

    // --- Data Fetching ---
    const userProfileRef = React.useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const defaultBuildingId = userProfile?.defaultBuildingId;
    
    const ownersQuery = React.useMemo(() => {
        if (!firestore || !defaultBuildingId) return null;
        return query(collection(firestore, 'buildings', defaultBuildingId, 'owners'));
    }, [firestore, defaultBuildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    const selectedOwner = React.useMemo(() => {
        if (!owners || !selectedOwnerId) return null;
        return owners.find(o => o.id === selectedOwnerId) || null;
    }, [owners, selectedOwnerId]);

    const isLoading = userProfile === undefined || (defaultBuildingId && owners === null);

    if (isLoading) {
        return (
            <div className="max-w-md mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Owner Selector Test</CardTitle>
                        <CardDescription>A test for a searchable dropdown that allows creating new owners on the fly.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!defaultBuildingId) {
        return <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>No Default Building Set</AlertTitle><AlertDescription>Please select a default building in the "My Buildings" page to use this test.</AlertDescription></Alert>;
    }

    return (
        <div className="max-w-md mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Owner Selector Test</CardTitle>
                    <CardDescription>A test for a searchable dropdown that allows creating new owners on the fly.</CardDescription>
                </CardHeader>
                <CardContent>
                    <OwnerCombobox
                        buildingId={defaultBuildingId}
                        owners={owners || []}
                        value={selectedOwnerId}
                        onChange={setSelectedOwnerId}
                    />
                </CardContent>
            </Card>

            <OwnerInfoCard owner={selectedOwner} />
        </div>
    );
}
