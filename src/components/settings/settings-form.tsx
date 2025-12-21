"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/hooks/use-app";
import { useToast } from "@/hooks/use-toast";
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
import { Label } from "../ui/label";
import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Separator } from "../ui/separator";


const formSchema = z.object({
  global_amenities_sqm: z.coerce.number().min(0, "Must be a positive number."),
  floor_standard_sqm: z.coerce.number().min(0, "Must be a positive number."),
  shop_multiplier: z.coerce.number().min(0),
  office_multiplier: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

export function SettingsForm() {
  const { settings, updateSettings, loading } = useApp();
  const { toast } = useToast();

  const [calculationMethod, setCalculationMethod] = useState(settings.financials.calculation_method);
  const [quarterlyExpenses, setQuarterlyExpenses] = useState(settings.financials.current_annual_budget / 4);
  const [ratePerSqm, setRatePerSqm] = useState(settings.financials.rate_per_sqm);

  const newAnnualBudget = useMemo(() => quarterlyExpenses * 4, [quarterlyExpenses]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      global_amenities_sqm: settings.commonAreas.global_amenities_sqm,
      floor_standard_sqm: settings.commonAreas.floor_standard_sqm,
      shop_multiplier: settings.financials.type_multipliers.Shop,
      office_multiplier: settings.financials.type_multipliers.Office,
    },
  });
  
  function onAreaSubmit(values: z.infer<typeof areaSchema>) {
    updateSettings({
        commonAreas: {
            global_amenities_sqm: values.global_amenities_sqm,
            floor_standard_sqm: values.floor_standard_sqm,
        }
    });
    toast({
      title: "Area Settings Updated",
      description: "Common area settings have been saved and all unit areas recalculated.",
    });
  }

  const handleMethodChange = (value: "budget_based" | "rate_based") => {
    setCalculationMethod(value);
    updateSettings({ financials: { calculation_method: value } });
    toast({
        title: "Calculation Method Updated",
        description: `Switched to ${value.replace('_', ' ')} method.`,
    });
  }
  
  const handleRecalculate = () => {
    const newSettings = {
        ...settings,
        financials: {
            ...settings.financials,
            calculation_method: calculationMethod,
            current_annual_budget: calculationMethod === 'budget_based' ? newAnnualBudget : settings.financials.current_annual_budget,
            rate_per_sqm: calculationMethod === 'rate_based' ? ratePerSqm : settings.financials.rate_per_sqm,
        }
    };
    updateSettings(newSettings);
    toast({
      title: "Fees Recalculated",
      description: `All unit fees have been updated based on the new settings.`,
    });
  };
  
  const areaSchema = z.object({
      global_amenities_sqm: z.coerce.number().min(0),
      floor_standard_sqm: z.coerce.number().min(0),
  });

  const multiplierSchema = z.object({
      shop_multiplier: z.coerce.number().min(0),
      office_multiplier: z.coerce.number().min(0),
  });

  function onMultiplierSubmit(values: z.infer<typeof multiplierSchema>) {
    updateSettings({
        financials: {
            ...settings.financials,
            type_multipliers: {
                Shop: values.shop_multiplier,
                Office: values.office_multiplier,
            }
        }
    });
    toast({
      title: "Multipliers Updated",
      description: "Fee multipliers have been updated and all fees recalculated.",
    });
  }

  const areaForm = useForm<z.infer<typeof areaSchema>>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
        global_amenities_sqm: settings.commonAreas.global_amenities_sqm,
        floor_standard_sqm: settings.commonAreas.floor_standard_sqm,
    },
  });

  const multiplierForm = useForm<z.infer<typeof multiplierSchema>>({
    resolver: zodResolver(multiplierSchema),
    defaultValues: {
        shop_multiplier: settings.financials.type_multipliers.Shop,
        office_multiplier: settings.financials.type_multipliers.Office,
    },
  });

  const RecalculationDialogContent = () => {
      if (calculationMethod === 'budget_based') {
          return (
             <AlertDialogDescription>
                This will recalculate fees for all billable units based on a new annual budget of <span className="font-bold">{formatCurrency(newAnnualBudget)}</span>. This action cannot be undone.
              </AlertDialogDescription>
          )
      }
      return (
        <AlertDialogDescription>
            This will recalculate fees for all billable units based on a new rate of <span className="font-bold">{formatCurrency(ratePerSqm)} / m²</span>. This action cannot be undone.
        </AlertDialogDescription>
      )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Common Area Settings</CardTitle>
          <CardDescription>
            Adjust the square meter values for common areas. This will trigger a
            recalculation of all unit gross areas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...areaForm}>
            <form onSubmit={areaForm.handleSubmit(onAreaSubmit)} className="space-y-8">
              <FormField
                control={areaForm.control}
                name="global_amenities_sqm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Global Amenities SQM</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="600.0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Total size of Pool, Lobby, Gym, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={areaForm.control}
                name="floor_standard_sqm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor Standard SQM</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="80.0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Standard size of a corridor/shafts per floor.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Area Settings"}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Fee Calculation Method</CardTitle>
            <CardDescription>
                Choose how to calculate maintenance fees and set the corresponding values.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <RadioGroup value={calculationMethod} onValueChange={handleMethodChange} className="grid grid-cols-2 gap-4">
                <div>
                    <RadioGroupItem value="budget_based" id="budget_based" className="peer sr-only" />
                    <Label htmlFor="budget_based" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Budget-Based
                    </Label>
                </div>
                 <div>
                    <RadioGroupItem value="rate_based" id="rate_based" className="peer sr-only" />
                    <Label htmlFor="rate_based" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Rate-Based
                    </Label>
                </div>
            </RadioGroup>

            {calculationMethod === 'budget_based' ? (
                <div className="space-y-2">
                    <Label htmlFor="quarterly-expenses">Estimated Quarterly Expenses (EGP)</Label>
                    <Input 
                        id="quarterly-expenses"
                        type="number"
                        value={quarterlyExpenses}
                        onChange={(e) => setQuarterlyExpenses(Number(e.target.value))}
                        placeholder="e.g. 250000"
                    />
                    <p className="text-sm text-muted-foreground">
                        New annual budget: <span className="font-medium text-primary">{formatCurrency(newAnnualBudget)}</span>
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="rate-per-sqm">Fee Rate (EGP per m² per year)</Label>
                    <Input 
                        id="rate-per-sqm"
                        type="number"
                        value={ratePerSqm}
                        onChange={(e) => setRatePerSqm(Number(e.target.value))}
                        placeholder="e.g. 250"
                    />
                     <p className="text-sm text-muted-foreground">
                        Set a fixed annual rate per gross square meter.
                    </p>
                </div>
            )}
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading}>Recalculate All Fees</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Fee Recalculation</AlertDialogTitle>
                  <RecalculationDialogContent />
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRecalculate} disabled={loading}>
                    {loading ? "Calculating..." : "Yes, Recalculate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>Fee Multipliers</CardTitle>
          <CardDescription>
            Adjust the billing weight for different unit types. Residential units have a multiplier of 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...multiplierForm}>
            <form onSubmit={multiplierForm.handleSubmit(onMultiplierSubmit)} className="space-y-8">
              <FormField
                control={multiplierForm.control}
                name="shop_multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Multiplier</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                     <FormDescription>Multiplier for 'Shop' unit types.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={multiplierForm.control}
                name="office_multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office Multiplier</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormDescription>Multiplier for 'Office' unit types.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Multipliers"}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
