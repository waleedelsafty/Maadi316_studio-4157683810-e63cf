
'use client';

import { useMemo } from 'react';
import type { Building } from '@/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from './ui/skeleton';


export function BuildingInfoCard({ building }: { building: Building }) {
    const firestore = useFirestore();
    const buildingName = building.name;

    const levelsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'buildings', building.id, 'levels'));
    }, [firestore, building.id]);

    const { data: levels } = useCollection(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'buildings', building.id, 'units'));
    }, [firestore, building.id]);

    const { data: units } = useCollection(unitsQuery);

    const buildingFeatures = useMemo(() => {
        const features = [];
        if (building.hasBasement) features.push(`Basement (${building.basementCount})`);
        if (building.hasMezzanine) features.push(`Mezzanine (${building.mezzanineCount})`);
        if (building.hasPenthouse) features.push('Penthouse');
        if (building.hasRooftop) features.push('Rooftop');
        return features;
    }, [building]);


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{buildingName}</CardTitle>
                        <CardDescription>{building.address}</CardDescription>
                    </div>
                     <Button size="sm" asChild>
                       <Link href={`/building/${building.id}`}>Open Full Details</Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border rounded-lg p-4">
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Total Floors</p>
                        {levels ? <p className="font-semibold text-lg">{levels.length}</p> : <Skeleton className="h-6 w-8" />}
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Total Units</p>
                         {units ? <p className="font-semibold text-lg">{units.length}</p> : <Skeleton className="h-6 w-8" />}
                    </div>
                    <div className="space-y-1 col-span-2">
                        <p className="text-muted-foreground">Features</p>
                        <div className="flex flex-wrap gap-2">
                            {buildingFeatures.length > 0 ? buildingFeatures.map(feature => (
                                <Badge key={feature} variant="secondary">{feature}</Badge>
                            )) : <p className="text-muted-foreground">Standard structure</p>}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
