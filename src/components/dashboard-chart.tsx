
'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { Building, Unit } from '@/types';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Skeleton } from './ui/skeleton';

type ChartData = {
  building: string;
  units: number;
};

const chartConfig = {
  units: {
    label: 'Units',
    color: 'hsl(var(--primary))',
  },
};

export function DashboardChart({ buildings }: { buildings: Building[] }) {
  const firestore = useFirestore();
  const [chartData, setChartData] = React.useState<ChartData[] | null>(null);

  React.useEffect(() => {
    async function fetchUnits() {
      if (!firestore || buildings.length === 0) {
        setChartData([]);
        return;
      }

      const data: ChartData[] = [];
      for (const building of buildings) {
        const unitsRef = collection(firestore, 'buildings', building.id, 'units');
        const unitsSnapshot = await getDocs(unitsRef);
        const buildingName = building.name;
        data.push({
          building: buildingName,
          units: unitsSnapshot.size,
        });
      }
      setChartData(data);
    }

    fetchUnits();
  }, [firestore, buildings]);

  if (chartData === null) {
      return (
          <div className="flex flex-col justify-between rounded-lg border p-4">
              <p className="text-sm text-muted-foreground mb-2">Units per Building</p>
              <Skeleton className="w-full h-[80px]" />
          </div>
      )
  }

  return (
    <div className="flex flex-col justify-between rounded-lg border p-4">
        <p className="text-sm text-muted-foreground mb-2">Units per Building</p>
        {chartData.length > 0 ? (
        <ChartContainer config={chartConfig} className="min-h-[80px] w-full">
            <BarChart accessibilityLayer data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                 <YAxis
                    dataKey="units"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => String(value)}
                    allowDecimals={false}
                />
                <XAxis
                    dataKey="building"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    hide
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="units" fill="var(--color-units)" radius={4} />
            </BarChart>
        </ChartContainer>
        ) : (
            <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No unit data available.</p>
            </div>
        )}
    </div>
  );
}
