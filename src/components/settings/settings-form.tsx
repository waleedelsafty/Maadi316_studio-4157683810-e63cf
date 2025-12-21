
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
import { suggestInitialBuildingSettings } from "@/ai/flows/suggest-initial-building-settings";
import { Loader } from "lucide-react";
import { Textarea } from "../ui/textarea";

const areaSchema = z.object({
  global_amenities_sqm: z.coerce.number().min(0, "Must be a positive number."),
  floor_standard_sqm: z.coerce.number().min(0, "Must be a positive number."),
});

const multiplierSchema = z.object({
  Shop: z.coerce.number().min(0),
  Office: z.coerce.number().min(0),
});

const buildingDescriptionSchema = z.object({
    description: z.string().min(10, "Please provide a more detailed description."),
});

export function SettingsForm() {
  const { settings, updateSettings, loading, units } = useApp();
  const { toast } = useToast();

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState(settings.financials.calculation_method);
  const [quarterlyExpenses, setQuarterlyExpenses] = useState(settings.financials.current_annual_budget / 4);
  const [ratePerSqm, setRatePerSqm] = useState(settings.financials.rate_per_sqm);

  const newAnnualBudget = useMemo(() => quarterlyExpenses * 4, [quarterlyExpenses]);

  const areaForm = useForm<z.infer<typeof areaSchema>>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      global_amenities_sqm: settings.commonAreas.global_amenities_sqm,
      floor_standard_sqm: settings.commonAreas.floor_standard_sqm,
    },
  });

  const multiplierForm = useForm<z.infer<typeof multiplierSchema>>({
    resolver: zodResolver(multiplierSchema),
    defaultValues: settings.financials.type_multipliers,
  });

  const descriptionForm = useForm<z.infer<typeof buildingDescriptionSchema>>({
    resolver: zodResolver(buildingDescriptionSchema),
    defaultValues: {
        description: `A building with ${units.length} units, containing a mix of residential flats, duplexes, offices, and shops. Key amenities include a pool, lobby, and gym.`,
    }
  });

  function onAreaSubmit(values: z.infer<typeof areaSchema>) {
    updateSettings({ commonAreas: values });
    toast({
      title: "Area Settings Updated",
      description: "Common area settings have been saved and all unit areas recalculated.",
    });
  }

  function onMultiplierSubmit(values: z.infer<typeof multiplierSchema>) {
    updateSettings({
      financials: { ...settings.financials, type_multipliers: values }
    });
    toast({
      title: "Multipliers Updated",
      description: "Fee multipliers have been updated and all fees recalculated.",
    });
  }

  async function onDescriptionSubmit(values: z.infer<typeof buildingDescriptionSchema>) {
    setIsSuggesting(true);
    try {
        const result = await suggestInitialBuildingSettings({ buildingDescription: values.description });
        areaForm.setValue('global_amenities_sqm', result.globalAmenitiesSqm);
        areaForm.setValue('floor_standard_sqm', result.floorStandardSqm);
        setQuarterlyExpenses(result.currentAnnualBudget / 4);
        toast({
            title: "AI Suggestions Applied",
            description: "The AI has suggested initial settings based on your description."
        });
    } catch (error) {
        console.error("Failed to get AI suggestions:", error);
        toast({
            variant: "destructive",
            title: "Suggestion Failed",
            description: "Could not get suggestions from the AI. Please try again."
        });
    }
    setIsSuggesting(false);
  }

  const handleMethodChange = (value: "budget_based" | "rate_based") => {
    setCalculationMethod(value);
    updateSettings({ financials: { calculation_method: value } });
    toast({
        title: "Calculation Method Updated",
        description: `Switched to ${value.replace(/_/g, ' ')} method.`,
    });
  }
  
  const handleRecalculate = () => {
    const financialSettingsUpdate = {
        ...settings.financials,
        calculation_method: calculationMethod,
        current_annual_budget: calculationMethod === 'budget_based' ? newAnnualBudget : settings.financials.current_annual_budget,
        rate_per_sqm: calculationMethod === 'rate_based' ? ratePerSqm : settings.financials.rate_per_sqm,
    };
    updateSettings({ financials: financialSettingsUpdate });
    toast({
      title: "Fees Recalculated",
      description: `All unit fees have been updated based on the new settings.`,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-3">
            <CardHeader>
                <CardTitle>Building Setup Assistant (AI)</CardTitle>
                <CardDescription>
                    Describe your building, and the AI will suggest initial settings for common areas and budget.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...descriptionForm}>
                    <form onSubmit={descriptionForm.handleSubmit(onDescriptionSubmit)} className="space-y-4">
                        <FormField
                            control={descriptionForm.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Building Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., A 10-story luxury apartment building with 50 units..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isSuggesting || loading}>
                            {isSuggesting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            {isSuggesting ? "Analyzing..." : "Get AI Suggestions"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Area Settings</CardTitle>
          <CardDescription>
            Adjust common area sizes. Triggers recalculation of all unit gross areas.
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
                Choose how to calculate fees and set the corresponding values.
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
                  <AlertDialogDescription>
                    This will recalculate fees for all billable units based on the new settings. This action cannot be undone.
                  </AlertDialogDescription>
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
                name="Shop"
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
                name="Office"
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

    