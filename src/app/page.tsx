
'use client';

import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Building, Unit, UserProfile, Level, Payment, Payable, GlobalUnitType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Building2, Layers, Scale, Library, Banknote } from 'lucide-react';
import { getQuartersForRange } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';

function StatCard({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description?: string; }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}


export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();

  // 1. Get User Profile and list of all buildings
  const userProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const allBuildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'buildings'), where('ownerId', '==', user.uid));
  }, [user, firestore]);
  const { data: allBuildings } = useCollection<Building>(allBuildingsQuery);

  const activeBuildingId = userProfile?.defaultBuildingId;
  
  // 2. Get all data for the Active Building
  const activeBuildingRef = useMemo(() => {
      if (!firestore || !activeBuildingId) return null;
      return doc(firestore, 'buildings', activeBuildingId);
  }, [firestore, activeBuildingId]);
  const { data: activeBuilding } = useDoc<Building>(activeBuildingRef);

  const levelsQuery = useMemo(() => {
      if (!firestore || !activeBuildingId) return null;
      return query(collection(firestore, 'buildings', activeBuildingId, 'levels'));
  }, [firestore, activeBuildingId]);
  const { data: levels } = useCollection<Level>(levelsQuery);
  
  const unitsQuery = useMemo(() => {
      if (!firestore || !activeBuildingId) return null;
      return query(collection(firestore, 'buildings', activeBuildingId, 'units'));
  }, [firestore, activeBuildingId]);
  const { data: units } = useCollection<Unit>(unitsQuery);

  const paymentsQuery = useMemo(() => {
      if (!firestore || !activeBuildingId) return null;
      return query(collection(firestore, 'buildings', activeBuildingId, 'payments'));
  }, [firestore, activeBuildingId]);
  const { data: payments } = useCollection<Payment>(paymentsQuery);

  const payablesQuery = useMemo(() => {
      if (!firestore || !activeBuildingId) return null;
      return query(collection(firestore, 'buildings', activeBuildingId, 'payables'));
  }, [firestore, activeBuildingId]);
  const { data: payables } = useCollection<Payable>(payablesQuery);

  const globalUnitTypesQuery = useMemo(() => collection(firestore, 'globalUnitTypes'), [firestore]);
  const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);


  // 3. Memoized Calculations for the dashboard
  const draftBuildingCount = useMemo(() => {
      if (!allBuildings) return 0;
      const nonDeleted = allBuildings.filter(b => !b.isDeleted);
      return activeBuildingId ? nonDeleted.length - 1 : nonDeleted.length;
  }, [allBuildings, activeBuildingId]);

  const unitsByType = useMemo(() => {
    if (!units || !globalUnitTypes) return new Map<string, number>();
    const typeMap = new Map(globalUnitTypes.map(t => [t.id, t.name]));
    return units.reduce((acc, unit) => {
      const typeName = typeMap.get(unit.unitTypeId);
      if (typeName) {
        acc.set(typeName, (acc.get(typeName) || 0) + 1);
      }
      return acc;
    }, new Map<string, number>());
  }, [units, globalUnitTypes]);

  const { totalQuarterlyBudget, treasuryBalance } = useMemo(() => {
    if (!units || !payments || !payables || !activeBuilding?.financialStartDate) {
      return { totalQuarterlyBudget: 0, treasuryBalance: 0 };
    }

    const totalQuarterlyBudget = units.reduce((sum, unit) => sum + (unit.quarterlyMaintenanceFees || 0), 0);
    
    const quartersSinceStart = getQuartersForRange(activeBuilding.financialStartDate.toDate(), 'all_since_start');
    const totalDueAllTime = units.reduce((sum, unit) => {
        return sum + ((unit.quarterlyMaintenanceFees || 0) * quartersSinceStart.length);
    }, 0);

    const totalPaidAllTime = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = payables.reduce((sum, payable) => sum + payable.amount, 0);

    // Treasury is now income minus expenses
    const treasuryBalance = totalPaidAllTime - totalExpenses;

    return { totalQuarterlyBudget, treasuryBalance };
  }, [units, payments, payables, activeBuilding]);
  

  // --- RENDER STATES ---

  // Initial Loading state
  if (user === undefined || userProfile === undefined || allBuildings === undefined) {
    return (
        <main className="w-full max-w-5xl space-y-8">
            <Skeleton className="h-10 w-1/3" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-40 w-full" />
        </main>
    );
  }

  // User has no default building set
  if (!activeBuildingId) {
       return (
            <main className="w-full max-w-5xl space-y-4 text-center py-10">
              <h2 className="text-2xl font-bold">Welcome!</h2>
              <p className="text-muted-foreground">
                You haven't selected a default building yet. Choose one to get started.
              </p>
              <Button asChild>
                <Link href="/buildings">Select a Default Building</Link>
              </Button>
            </main>
      )
  }

  const buildingName = activeBuilding?.name;

  return (
    <main className="w-full max-w-5xl space-y-8">
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">
                    {buildingName ? `Dashboard: ${buildingName}`: <Skeleton className="h-9 w-72" />}
                </h2>
                <div className="flex items-center gap-2">
                    <Button asChild>
                        <Link href={`/building/${activeBuildingId}`}>View & Manage Building <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </div>
            </div>
             <p className="text-muted-foreground">An overview of your currently active property.</p>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Levels" value={levels?.length ?? <Skeleton className="h-8 w-12" />} icon={<Layers className="h-4 w-4 text-muted-foreground" />} description="Number of floors in the building." />
        <StatCard title="Total Units" value={units?.length ?? <Skeleton className="h-8 w-12" />} icon={<Building2 className="h-4 w-4 text-muted-foreground" />} description="Total rentable/ownable units." />
        <StatCard title="Quarterly Budget" value={totalQuarterlyBudget > 0 ? totalQuarterlyBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : <Skeleton className="h-8 w-24" />} icon={<Banknote className="h-4 w-4 text-muted-foreground" />} description="Total expected fees per quarter." />
        <StatCard title="Treasury Balance" value={treasuryBalance ? treasuryBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : <Skeleton className="h-8 w-24" />} icon={<Scale className="h-4 w-4 text-muted-foreground" />} description="Overall financial surplus or deficit." />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
                <CardTitle>Unit Composition</CardTitle>
                <CardDescription>Breakdown of all units by their designated type.</CardDescription>
            </CardHeader>
            <CardContent>
                {units ? (
                     <div className="flex flex-wrap gap-2">
                        {Array.from(unitsByType.entries()).map(([type, count]) => (
                            <Badge key={type} variant="secondary" className="text-base py-1 px-3">
                                {type}: <span className="font-bold ml-2">{count}</span>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-28" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>Draft Buildings</CardTitle>
                <CardDescription>Other buildings in your portfolio.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <div className="flex items-center">
                    <Library className="h-8 w-8 mr-4 text-muted-foreground" />
                    <div>
                         <p className="text-2xl font-bold">{draftBuildingCount}</p>
                         <p className="text-xs text-muted-foreground">Inactive buildings</p>
                    </div>
                </div>
                <Button asChild variant="outline">
                    <Link href="/buildings">Manage All Buildings</Link>
                </Button>
            </CardContent>
          </Card>
      </div>

    </main>
  );
}
