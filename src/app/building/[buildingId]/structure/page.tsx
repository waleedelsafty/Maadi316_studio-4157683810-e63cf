
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Level, Unit } from '@/types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BuildingLevelsTab } from '@/components/building-levels-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export default function BuildingStructurePage() {
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

    const buildingName = (building as any)?.Building_name || (building as any)?.name;

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <BuildingLevelsTab building={building} levels={levels} units={units} />

             <Card>
                <CardHeader>
                    <CardTitle>All Units</CardTitle>
                    <CardDescription>A complete list of every unit in "{buildingName}". Units are managed on their respective level pages.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Unit #</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Size (sqm)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {units && levels && units.length > 0 ? (
                                    units.map(unit => {
                                        const level = levels.find(l => l.id === unit.levelId);
                                        return (
                                            <TableRow key={unit.id}>
                                                <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                                <TableCell>{level?.name || 'N/A'}</TableCell>
                                                <TableCell>{unit.type}</TableCell>
                                                <TableCell>{unit.ownerName}</TableCell>
                                                <TableCell>{unit.sqm}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">No units have been created for this building.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
