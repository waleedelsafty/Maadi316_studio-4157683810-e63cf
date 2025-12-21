"use client";

import { PageHeader } from "@/components/page-header";
import { UnitsTable } from "@/components/units/units-table";
import { useApp } from "@/hooks/use-app";
import { useAuth } from "@/hooks/use-auth";

export default function UnitsPage() {
    const { units, loading } = useApp();
    const { can } = useAuth();
    const showFinancials = can("Board Member");

  return (
    <>
      <PageHeader
        title="Units"
        description="Manage and view all units in the building."
      />
      <UnitsTable units={units} isLoading={loading} showFinancials={showFinancials} />
    </>
  );
}
