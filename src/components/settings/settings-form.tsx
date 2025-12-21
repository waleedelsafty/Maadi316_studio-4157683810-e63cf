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
import { RecalculateFeesDialog } from "./recalculate-fees-dialog";

const formSchema = z.object({
  global_amenities_sqm: z.coerce.number().min(0, "Must be a positive number."),
  floor_standard_sqm: z.coerce.number().min(0, "Must be a positive number."),
});

type FormValues = z.infer<typeof formSchema>;

export function SettingsForm() {
  const { settings, updateSettings, loading } = useApp();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      global_amenities_sqm: settings.commonAreas.global_amenities_sqm,
      floor_standard_sqm: settings.commonAreas.floor_standard_sqm,
    },
  });

  function onSubmit(values: FormValues) {
    const newSettings = {
        ...settings,
        commonAreas: {
            global_amenities_sqm: values.global_amenities_sqm,
            floor_standard_sqm: values.floor_standard_sqm,
        }
    }
    updateSettings(newSettings);
    toast({
      title: "Settings Updated",
      description: "Building settings have been saved and all unit areas recalculated.",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Common Area Settings</CardTitle>
          <CardDescription>
            Adjust the square meter values for common areas. This will trigger a
            recalculation of all unit gross areas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
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
                control={form.control}
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
            <CardTitle>Financial Settings</CardTitle>
            <CardDescription>
                Manage the building's budget and trigger system-wide fee recalculations.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <h4 className="font-medium">Current Annual Budget</h4>
                <p className="text-2xl font-bold font-mono text-primary">{settings.financials.current_annual_budget.toLocaleString("en-US", { style: "currency", currency: "EGP" })}</p>
                <p className="text-xs text-muted-foreground">Last Recalculation: {new Date(settings.financials.last_recalculation_date).toLocaleDateString()}</p>
            </div>
            <RecalculateFeesDialog currentBudget={settings.financials.current_annual_budget} />
        </CardContent>
      </Card>
    </div>
  );
}
