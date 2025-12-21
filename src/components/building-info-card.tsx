
'use client';

import { useMemo } from 'react';
import type { Building, Level, Unit } from '@/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from './ui/separator';

const levelTypeOrder: Record<Level['type'], number> = {
    'Rooftop': 6,
    'Penthouse': 5,
    'Typical Floor': 4,
    'Mezzanine': 3,
    'Ground': 2,
    'Basement': 1,
};

export function BuildingInfoCard({ building }: { building: Building }) {
    const firestore = useFirestore();

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

    const unitInfo = useMemo(() => {
        if (!units) return { unitCountsByType: {}, totalUnits: 0 };
        
        const unitCountsByType = units.reduce((acc, unit) => {
            acc[unit.type] = (acc[unit.type] || 0) + 1;
            return acc;
        }, {} as Record<Unit['type'], number>);

        const totalUnits = units.length;

        return { unitCountsByType, totalUnits };
    }, [units]);
    
    const unitsPerLevel = useMemo(() => {
        if (!units) return {};
        return units.reduce((acc, unit) => {
            acc[unit.levelId] = (acc[unit.levelId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [units]);

    const sortedLevels = useMemo(() => {
        if (!levels) return [];
        return [...levels].sort((a, b) => {
            const typeA = levelTypeOrder[a.type];
            const typeB = levelTypeOrder[b.type];

            if (typeA !== typeB) {
                return typeA - typeB; // Default to ascending sort
            }

            if (a.type === 'Typical Floor') {
                 return (a.floorNumber || 0) - (b.floorNumber || 0);
            }
             if (a.type === 'Basement') {
                return a.name.localeCompare(b.name) * -1;
            }
            
            return a.name.localeCompare(b.name);
        });
    }, [levels]);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{building.name}</CardTitle>
                        <CardDescription>{building.address}</CardDescription>
                    </div>
                    <div className="text-right">
                         <Button size="sm" asChild>
                           <Link href={`/building/${building.id}`}>Open Full Details</Link>
                        </Button>
                        {units && <p className="text-sm text-muted-foreground mt-1">{unitInfo.totalUnits} Units Total</p>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2 text-sm">Unit Summary</h4>
                    {units && Object.keys(unitInfo.unitCountsByType).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border rounded-lg p-4">
                            {Object.entries(unitInfo.unitCountsByType).map(([type, count]) => (
                                <div key={type} className="space-y-1">
                                    <p className="text-muted-foreground">{type}</p>
                                    <p className="font-semibold">{count}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-8 rounded-lg border border-dashed">
                            <p className="text-sm text-muted-foreground">
                                No units have been added to this building yet.
                            </p>
                        </div>
                    )}
                </div>

                <Separator />
                
                <div>
                    <h4 className="font-medium mb-2 text-sm">Levels</h4>
                    {sortedLevels && sortedLevels.length > 0 ? (
                        <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                            {sortedLevels.map((level) => (
                                <div key={level.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-b-0 last:pb-0">
                                    <div>
                                        <p className="font-semibold">{level.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {level.type}
                                            {level.type === 'Typical Floor' && ` - Floor ${level.floorNumber}`}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium text-muted-foreground">{unitsPerLevel[level.id] || 0} units</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 rounded-lg border border-dashed">
                            <p className="text-sm text-muted-foreground">
                            No levels have been added to this building yet.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
