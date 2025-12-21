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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Skeleton } from "../ui/skeleton";
import { Label } from "../ui/label";

const settingsSchema = z.object({
    global_amenities_sqm: z.coerce.number().min(0, "Must be a positive number."),
    floor_standard_sqm: z.coerce.number().min(0, "Must be a positive number."),
    Shop: z.coerce.number().min(0),
    Office: z.coerce.number().min(0),
    calculation_method: z.enum(["budget_based", "rate_based"]),
    current_annual_budget: z.coerce.number().min(0),
    rate_per_sqm: z.coerce.number().min(0),
});

export function SettingsForm() {
  const { settings, updateSettings, loading } = useApp();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    // Use `useEffect` to update form values when settings are loaded
  });

  React.useEffect(() => {
    if (settings) {
        form.reset({
            global_amenities_sqm: settings.commonAreas.global_amenities_sqm,
            floor_standard_sqm: settings.commonAreas.floor_standard_sqm,
            Shop: settings.financials.type_multipliers.Shop,
            Office: settings.financials.type_multipliers.Office,
            calculation_method: settings.financials.calculation_method,
            current_annual_budget: settings.financials.current_annual_budget,
            rate_per_sqm: settings.financials.rate_per_sqm,
        });
    }
  }, [settings, form]);


  const watchCalculationMethod = form.watch("calculation_method");

  function onSubmit(values: z.infer<typeof settingsSchema>) {
    updateSettings({
      commonAreas: {
        global_amenities_sqm: values.global_amenities_sqm,
        floor_standard_sqm: values.floor_standard_sqm,
      },
      financials: {
        calculation_method: values.calculation_method,
        current_annual_budget: values.current_annual_budget,
        rate_per_sqm: values.rate_per_sqm,
        type_multipliers: {
          Shop: values.Shop,
          Office: values.Office,
        },
      },
    });
    toast({
      title: "Settings Updated",
      description: "Building settings have been saved and all fees recalculated.",
    });
  }
  
  if (loading || !settings) {
    return (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="xl:col-span-1">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <Card className="xl:col-span-1">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <Card className="xl:col-span-1">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        
        <Card className="xl:col-span-1">
            <CardHeader>
                <CardTitle>Common Area Settings</CardTitle>
                <CardDescription>
                    Adjust common area sizes used in calculations.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="global_amenities_sqm"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Global Amenities SQM</FormLabel>
                        <FormControl>
                        <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Total size of Pool, Lobby, Gym, etc.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="floor_standard_sqm"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Floor Standard SQM</FormLabel>
                        <FormControl>
                        <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Standard size of corridors/shafts per floor.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
        </Card>
        
        <Card className="xl:col-span-1">
            <CardHeader>
                <CardTitle>Fee Calculation Method</CardTitle>
                <CardDescription>
                    Choose how to calculate fees and set the corresponding values.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField
                    control={form.control}
                    name="calculation_method"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                                    <FormItem>
                                        <FormControl>
                                            <RadioGroupItem value="budget_based" id="budget_based" className="peer sr-only" />
                                        </FormControl>
                                        <Label htmlFor="budget_based" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                            Budget-Based
                                        </Label>
                                    </FormItem>
                                    <FormItem>
                                        <FormControl>
                                            <RadioGroupItem value="rate_based" id="rate_based" className="peer sr-only" />
                                        </FormControl>
                                        <Label htmlFor="rate_based" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                            Rate-Based
                                        </Label>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {watchCalculationMethod === 'budget_based' ? (
                     <FormField
                        control={form.control}
                        name="current_annual_budget"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Annual Budget (EGP)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name="rate_per_sqm"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fee Rate (EGP per m² per year)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
            </CardContent>
        </Card>

        <Card className="xl:col-span-1">
            <CardHeader>
                <CardTitle>Fee Multipliers</CardTitle>
                <CardDescription>
                    Adjust the billing weight for different unit types.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="Shop"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Shop Multiplier</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="Office"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Office Multiplier</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
        </Card>
        
        <div className="xl:col-span-3">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={loading}>Save Settings & Recalculate All Fees</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will save all settings and recalculate fees for all billable units. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={form.handleSubmit(onSubmit)} disabled={loading}>
                    {loading ? "Saving..." : "Yes, Save and Recalculate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </form>
    </Form>
  );
}