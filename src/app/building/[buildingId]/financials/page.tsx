
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import type { Building, Payment, Payable, Unit } from '@/types';
import { ArrowLeft, ArrowRight, Scale, TrendingUp, HandCoins, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, getYear, getMonth, isWithinInterval, startOfYear, endOfYear, startOfQuarter, endOfQuarter, endOfMonth, getQuarter, startOfMonth, endOfDay } from 'date-fns';
import { useApp } from '@/components/app-provider';
import { getQuartersForRange } from '@/lib/calculations';
import { addQuarters } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


function StatCard({ title, value, icon, description, ctaLink, ctaText }: { title: string; value: string | number; icon: React.ReactNode; description?: string; ctaLink?: string; ctaText?: string; }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className='space-y-1.5'>
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    {description && <CardDescription>{description}</CardDescription>}
                </div>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {ctaLink && ctaText && (
                    <Button variant="link" asChild className="p-0 h-auto mt-2">
                        <Link href={ctaLink}>{ctaText} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function BuildingFinancialsDashboardPage() {
    const { buildingId } = useParams() as { buildingId:string };
    const router = useRouter();
    const firestore = useFirestore();
    const { quarterRange } = useApp();
    const [subPeriod, setSubPeriod] = useState('all'); // 'all', 'Q1', 'Q2', 'Q3', 'Q4'

    // Firestore Hooks
    const buildingRef = useMemo(() => doc(firestore, 'buildings', buildingId), [firestore, buildingId]);
    const { data: building } = useDoc<Building>(buildingRef);

    const unitsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'units'), [firestore, buildingId]);
    const { data: allUnits } = useCollection<Unit>(unitsQuery);

    const paymentsQuery = useMemo(() => collection(firestore, 'buildings', buildingId, 'payments'), [firestore, buildingId]);
    const { data: payments } = useCollection<Payment>(paymentsQuery);
    
    const payablesQuery = useMemo(() => query(collection(firestore, 'buildings', buildingId, 'payables')), [firestore, buildingId]);
    const { data: payables } = useCollection<Payable>(payablesQuery);
    
    const quarterOptions = useMemo(() => {
        if (!building) return [];
        const quarters = getQuartersForRange(building.financialStartDate.toDate(), quarterRange);
        const uniqueQuarters = new Set(quarters.map(q => `Q${q.split(' ')[0].substring(1)}`));
        return ['all', ...Array.from(uniqueQuarters)];
    }, [building, quarterRange]);
    
    // Reset sub-period if it becomes invalid
    useMemo(() => {
        if (!quarterOptions.includes(subPeriod)) {
            setSubPeriod('all');
        }
    }, [quarterOptions, subPeriod]);

    const { 
        totalDue,
        totalCollected, 
        totalPayables, 
        netBalance, 
        monthlyChartData, 
        payablesByCategoryChartData 
    } = useMemo(() => {
        if (!building || !payments || !payables || !allUnits) {
            return { totalDue: 0, totalCollected: 0, totalPayables: 0, netBalance: 0, monthlyChartData: [], payablesByCategoryChartData: [] };
        }

        const now = new Date();
        let baseInterval: Interval;

        // Determine the base date interval from the global selection
        switch (quarterRange) {
            case 'current_quarter':
                baseInterval = { start: startOfQuarter(now), end: endOfQuarter(now) };
                break;
            case 'year_to_date':
                baseInterval = { start: startOfYear(now), end: endOfDay(now) };
                break;
            case 'all_since_start':
                baseInterval = { start: building.financialStartDate.toDate(), end: endOfMonth(addQuarters(now, 2)) };
                break;
            default: // Handles 'year_YYYY'
                const year = parseInt(quarterRange.split('_')[1], 10);
                baseInterval = { start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 11, 31)) };
                break;
        }

        const yearForSubPeriod = getYear(baseInterval.start);
        
        let finalInterval: Interval = baseInterval;

        // Apply sub-period filtering if not 'all'
        if (subPeriod !== 'all') {
            const quarterNum = parseInt(subPeriod.substring(1), 10); // Q1 -> 1
            const quarterStart = new Date(yearForSubPeriod, (quarterNum - 1) * 3, 1);
            finalInterval = { start: startOfQuarter(quarterStart), end: endOfQuarter(quarterStart) };
        }

        const quartersInRange = getQuartersForRange(building.financialStartDate.toDate(), quarterRange)
            .filter(qStr => {
                 if (subPeriod === 'all') return true;
                 const [q, y] = qStr.split(' ');
                 return `Q${getQuarter(new Date(parseInt(y), (parseInt(q.substring(1)) - 1) * 3, 1))}` === subPeriod && parseInt(y) === yearForSubPeriod;
            });

        
        const totalQuarterlyFees = allUnits
            .filter(u => !u.parentUnitId)
            .reduce((sum, unit) => sum + (unit.quarterlyMaintenanceFees || 0), 0);
        
        const totalDue = totalQuarterlyFees * quartersInRange.length;

        const filteredPayments = payments.filter(p => isWithinInterval(p.paymentDate.toDate(), finalInterval));
        const filteredPayables = payables.filter(p => isWithinInterval(p.expenseDate.toDate(), finalInterval));

        const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPayables = filteredPayables.reduce((sum, p) => sum + p.amount, 0);
        const netBalance = totalCollected - totalPayables;
        
        const monthlyPlannedBudget = totalQuarterlyFees / 3;
        
        const monthlyData: { [key: string]: { name: string; planned: number; collected: number; expenses: number } } = {};
        
        const start = finalInterval.start;
        const end = finalInterval.end;

        let currentMonth = startOfMonth(start);
        while(isWithinInterval(currentMonth, {start, end})) {
            const monthKey = format(currentMonth, 'MMM yyyy');
            monthlyData[monthKey] = { name: format(currentMonth, 'MMM'), planned: monthlyPlannedBudget, collected: 0, expenses: 0 };
            currentMonth = subMonths(currentMonth, -1);
        }

        filteredPayments.forEach(p => {
            const date = p.paymentDate.toDate();
            const monthKey = format(date, 'MMM yyyy');
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].collected += p.amount;
            }
        });

        filteredPayables.forEach(p => {
            const date = p.expenseDate.toDate();
            const monthKey = format(date, 'MMM yyyy');
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].expenses += p.amount;
            }
        });

        const payablesByCategory: { [key: string]: number } = {};
        filteredPayables.forEach(p => {
            payablesByCategory[p.category] = (payablesByCategory[p.category] || 0) + p.amount;
        });

        const payablesByCategoryChartData = Object.entries(payablesByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { 
            totalDue,
            totalCollected, 
            totalPayables, 
            netBalance, 
            monthlyChartData: Object.values(monthlyData),
            payablesByCategoryChartData
        };
    }, [payments, payables, building, quarterRange, allUnits, subPeriod]);
    
    const isLoading = building === undefined || payments === null || payables === null || allUnits === null;

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Dashboard</CardTitle>
                    <CardDescription>An overview of the treasury for "{building?.name || '...'}" based on the selected period.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs value={subPeriod} onValueChange={setSubPeriod} className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            {quarterOptions.map(option => (
                                <TabsTrigger key={option} value={option}>{option === 'all' ? 'All' : option}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                         {isLoading ? (
                            <>
                                <Skeleton className="h-40" />
                                <Skeleton className="h-40" />
                                <Skeleton className="h-40" />
                                <Skeleton className="h-40" />
                            </>
                         ) : (
                            <>
                                <StatCard 
                                    title="Total Due (Planned)"
                                    value={formatCurrency(totalDue)}
                                    icon={<ReceiptText className="h-4 w-4 text-muted-foreground" />}
                                    description="Expected income in this period."
                                    ctaLink={`/building/${buildingId}/financials/receivables`}
                                    ctaText="Manage Receivables"
                                />
                                <StatCard 
                                    title="Total Collected (Actual)"
                                    value={formatCurrency(totalCollected)}
                                    icon={<HandCoins className="h-4 w-4 text-muted-foreground" />}
                                    description="Actual income received in this period."
                                />
                                <StatCard 
                                    title="Total Expenses"
                                    value={formatCurrency(totalPayables)}
                                    icon={<HandCoins className="h-4 w-4 text-muted-foreground" />}
                                    description="Expenses paid in this period."
                                    ctaLink={`/building/${buildingId}/financials/payables`}
                                    ctaText="Manage Payables"
                                />
                                 <StatCard 
                                    title="Net Balance (Cash Flow)"
                                    value={formatCurrency(netBalance)}
                                    icon={<Scale className="h-4 w-4 text-muted-foreground" />}
                                    description="Collected minus expenses for the period."
                                />
                            </>
                         )}
                     </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" /> Monthly Cash Flow</CardTitle>
                        <CardDescription>Planned budget vs. actual income collected vs. expenses paid for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-64" /> : (
                             <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyChartData}>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="planned" name="Planned" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Expenses by Category</CardTitle>
                        <CardDescription>Breakdown of payables for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-64" /> : payablesByCategoryChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={payablesByCategoryChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name"
                                        label={(entry) => `${entry.name} (${(entry.percent * 100).toFixed(0)}%)`}
                                    >
                                        {payablesByCategoryChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="flex items-center justify-center h-[300px] text-center text-muted-foreground">
                                No expense data for this period.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
