
'use client';

import { useMemo } from 'react';
import type { Building, Level } from '@/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckIcon } from '@/components/icons';
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

    const { data: levels, error } = useCollection(levelsQuery);

    const levelInfo = useMemo(() => {
        if (!levels) return { hasGround: false, hasPenthouse: false, hasRooftop: false, typicalFloorCount: 0 };
        
        const hasGround = levels.some(l => l.type === 'Ground');
        const hasPenthouse = levels.some(l => l.type === 'Penthouse');
        const hasRooftop = levels.some(l => l.type === 'Rooftop');
        const typicalFloorCount = levels.filter(l => l.type === 'Typical Floor').length;

        return { hasGround, hasPenthouse, hasRooftop, typicalFloorCount };
    }, [levels]);
    
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


    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-destructive text-center">
                        Could not load level data for {building.name}.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{building.name}</CardTitle>
                        <CardDescription>{building.address}</CardDescription>
                    </div>
                    <Button size="sm" asChild>
                       <Link href={`/building/${building.id}`}>Open Full Details</Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2 text-sm">Building Structure Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border rounded-lg p-4">
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Basement</p>
                            <p className="font-semibold">{building.hasBasement ? building.basementCount : '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Mezzanine</p>
                            <p className="font-semibold">{building.hasMezzanine ? building.mezzanineCount : '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Ground</p>
                            <p className="font-semibold">{levelInfo.hasGround ? <CheckIcon /> : '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Typical Floors</p>
                            <p className="font-semibold">{levelInfo.typicalFloorCount > 0 ? levelInfo.typicalFloorCount : '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Penthouse</p>
                            <p className="font-semibold">{levelInfo.hasPenthouse ? <CheckIcon /> : '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Rooftop</p>
                            <p className="font-semibold">{levelInfo.hasRooftop ? <CheckIcon /> : '—'}</p>
                        </div>
                    </div>
                </div>

                <Separator />
                
                <div>
                    <h4 className="font-medium mb-2 text-sm">Levels</h4>
                    {sortedLevels && sortedLevels.length > 0 ? (
                        <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                            {sortedLevels.map((level) => (
                                <div key={level.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-b-0 last:pb-0">
                                    <p className="font-semibold">{level.name}</p>
                                    <p className="text-muted-foreground">
                                        {level.type}
                                        {level.type === 'Typical Floor' && ` - Floor ${level.floorNumber}`}
                                    </p>
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
