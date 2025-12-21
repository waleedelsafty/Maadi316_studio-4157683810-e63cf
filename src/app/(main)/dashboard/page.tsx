"use client";

import { DollarSign, Building, Users, AlertCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/page-header";
import { FinancialSummary } from "@/components/dashboard/financial-summary";
import { useApp } from "@/hooks/use-app";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { units, settings, loading } = useApp();
  const { can } = useAuth();

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Overview of the building's financial status." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="mt-6">
            <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const totalCollectedFees = units.reduce((acc, unit) => acc + unit.current_maintenance_fee, 0);
  const outstandingFees = settings.financials.current_annual_budget - totalCollectedFees;
  const billableUnits = units.filter(u => u.billing_parent_code === null);
  
  const financialData = {
    annualBudget: settings.financials.current_annual_budget,
    totalCollectedFees,
    outstandingFees,
    numberOfUnits: units.length,
    numberOfUnitsWithOutstandingFees: 0, // Mock data for now
    averageMaintenanceFee: totalCollectedFees / billableUnits.length,
  };

  const showFinancialDetails = can("Board Member");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of the building's financial status."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Annual Budget"
          value={settings.financials.current_annual_budget}
          icon={DollarSign}
          isCurrency
          description="Target collection amount"
        />
        <KpiCard
          title="Total Units"
          value={units.length}
          icon={Building}
          description={`${billableUnits.length} billable units`}
        />
        <KpiCard
          title="Total Fees Calculated"
          value={totalCollectedFees}
          icon={Users}
          isCurrency
          description="Sum of all calculated fees"
        />
        <KpiCard
          title="Outstanding Fees"
          value={Math.max(0, outstandingFees)}
          icon={AlertCircle}
          isCurrency
          description="Budget minus calculated fees"
        />
      </div>

      {showFinancialDetails && (
         <div className="mt-6">
            <FinancialSummary data={financialData} />
        </div>
      )}
    </>
  );
}
