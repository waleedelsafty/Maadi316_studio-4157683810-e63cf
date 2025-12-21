
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useMemo, useState, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuildingInfoCard } from '@/components/building-info-card';
import type { Building } from '@/types';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'buildings'), where('ownerId', '==', user.uid));
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);
  
  useEffect(() => {
    const buildingIdFromUrl = searchParams.get('building');
    if (buildingIdFromUrl) {
      setSelectedBuildingId(buildingIdFromUrl);
    } else {
      setSelectedBuildingId(null);
    }
  }, [searchParams]);

  const selectedBuilding = useMemo(() => {
    if (!buildings || !selectedBuildingId) return null;
    return buildings.find(b => b.id === selectedBuildingId) || null;
  }, [buildings, selectedBuildingId]);
  
  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('building', buildingId);
    router.push(`${pathname}?${newSearchParams.toString()}`);
  }

  if (!user || !firestore) {
    return null;
  }

  return (
    <main className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold">Building Dashboard</h2>
         {buildings && buildings.length > 0 && (
            <Select onValueChange={handleBuildingSelect} value={selectedBuildingId || undefined}>
                <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select a building to view" />
                </SelectTrigger>
                <SelectContent>
                    {buildings.map(building => (
                        <SelectItem key={building.id} value={building.id}>
                            {building.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
         )}
      </div>

      <div className="space-y-4">
        {selectedBuilding ? (
            <BuildingInfoCard building={selectedBuilding as Building} />
        ) : (
          <div className="text-center py-12 rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              {buildings && buildings.length > 0
                ? "Select a building from the dropdown to see its details."
                : "You haven't added any buildings yet."
              }
            </p>
             {(!buildings || buildings.length === 0) && (
                 <p className="text-sm text-muted-foreground mt-2">
                    Add a building in the Settings page.
                </p>
             )}
          </div>
        )}
      </div>
    </main>
  );
}
