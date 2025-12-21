"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Unit } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { useAuth } from "@/hooks/use-auth";

interface UnitDetailsDialogProps {
  unit: Unit;
}

const DetailRow = ({ label, value, description }: { label: string; value: string | number; description?: string; }) => (
  <div className="flex justify-between items-center py-2">
    <div>
      <p className="font-medium text-sm">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <p className="font-mono text-sm">{value}</p>
  </div>
);

export function UnitDetailsDialog({ unit }: UnitDetailsDialogProps) {
  const { can } = useAuth();
  const showFullDetails = can("Board Member");
  const showFee = can("Owner");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unit Details: {unit.code}</DialogTitle>
          <DialogDescription>
            Owned by {unit.owner}. Type: {unit.type}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <h3 className="font-semibold text-md mt-4">Area Breakdown</h3>
          <Separator />
          <DetailRow label="Net Area" value={`${unit.net_sqm.toFixed(2)} m²`} description="Internal living space." />
          {showFullDetails && (
            <>
              <DetailRow label="Share of Local Common Area" value={`${unit.share_local_common.toFixed(2)} m²`} description="Share of floor corridor/shafts." />
              <DetailRow label="Share of Global Common Area" value={`${unit.share_global_common.toFixed(2)} m²`} description="Share of pool, lobby, gym." />
              <Separator />
              <DetailRow label="Total Gross Area" value={`${unit.total_gross_sqm.toFixed(2)} m²`} description="Billable area (Net + Common Shares)." />
            </>
          )}

          {showFee && (
            <>
              <h3 className="font-semibold text-md mt-6">Financials</h3>
              <Separator />
              {showFullDetails && (
                 <DetailRow label="Type Factor" value={unit.type_factor.toFixed(2)} description="Weighting for unit type." />
              )}
               {showFullDetails && (
                 <DetailRow label="Weighted Billing Area" value={`${unit.weighted_billing_area.toFixed(2)}`} description="Gross Area × Type Factor" />
              )}
              <DetailRow 
                label="Current Maintenance Fee" 
                value={unit.billing_parent_code ? "Rolled up to " + unit.billing_parent_code : formatCurrency(unit.current_maintenance_fee)} 
                description="Final calculated fee."
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
