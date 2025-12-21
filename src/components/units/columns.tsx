"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Building, ChevronsRight, Home, Briefcase, Store } from "lucide-react";
import { Unit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { UnitDetailsDialog } from "./unit-details-dialog";

const UnitTypeIcon = ({ type }: { type: Unit["type"] }) => {
    switch (type) {
        case "Flat": return <Home className="h-4 w-4 text-muted-foreground" />;
        case "Duplex": return <Building className="h-4 w-4 text-muted-foreground" />;
        case "Office": return <Briefcase className="h-4 w-4 text-muted-foreground" />;
        case "Shop": return <Store className="h-4 w-4 text-muted-foreground" />;
        case "Merged": return <ChevronsRight className="h-4 w-4 text-muted-foreground" />;
        default: return null;
    }
};


export const getColumns = (showFinancials: boolean, showQuarterly: boolean): ColumnDef<Unit>[] => [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="font-medium">{row.original.code}</div>,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
        <div className="flex items-center gap-2">
            <UnitTypeIcon type={row.original.type} />
            <span>{row.original.type}</span>
        </div>
    )
  },
  {
    accessorKey: "owner",
    header: "Owner",
  },
  ...(showFinancials ? [
  {
    accessorKey: "net_sqm",
    header: "Net Area (m²)",
    cell: ({ row }) => row.original.net_sqm.toFixed(2),
  },
  {
    accessorKey: "total_gross_sqm",
    header: "Gross Area (m²)",
    cell: ({ row }) => row.original.total_gross_sqm.toFixed(2),
  },
  {
    accessorKey: "current_maintenance_fee",
    header: `Maint. Fee (${showQuarterly ? 'Quarterly' : 'Annual'})`,
    cell: ({ row }) => {
        const fee = row.original.current_maintenance_fee;
        if (row.original.billing_parent_code) {
            return <Badge variant="secondary">Rolled up</Badge>
        }
        const displayFee = showQuarterly ? fee / 4 : fee;
        return formatCurrency(displayFee)
    },
  },
  ] : []),
  {
    accessorKey: "billing_parent_code",
    header: "Parent Unit",
    cell: ({ row }) => row.original.billing_parent_code || "N/A",
  },
  {
    id: "actions",
    cell: ({ row }) => <UnitDetailsDialog unit={row.original} />,
  },
];
