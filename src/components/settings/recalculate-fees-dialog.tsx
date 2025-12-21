"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/hooks/use-app";
import { useToast } from "@/hooks/use-toast";

interface RecalculateFeesDialogProps {
  currentBudget: number;
}

export function RecalculateFeesDialog({ currentBudget }: RecalculateFeesDialogProps) {
  const [newBudget, setNewBudget] = useState(currentBudget);
  const { recalculateFees, loading } = useApp();
  const { toast } = useToast();

  const handleRecalculate = () => {
    recalculateFees(newBudget);
    toast({
      title: "Fees Recalculated",
      description: `All unit fees have been updated based on the new annual budget of ${newBudget.toLocaleString()}.`,
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Recalculate All Fees</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalculate All Maintenance Fees?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will recalculate the maintenance fee for every billable
            unit in the building based on the new annual budget you provide.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="budget" className="text-right">
              New Budget (EGP)
            </Label>
            <Input
              id="budget"
              type="number"
              value={newBudget}
              onChange={(e) => setNewBudget(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecalculate} disabled={loading || newBudget <= 0}>
            {loading ? "Calculating..." : "Yes, Recalculate Fees"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
