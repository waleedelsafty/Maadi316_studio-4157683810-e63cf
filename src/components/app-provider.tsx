"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { Unit, BuildingSettings } from '@/lib/types';
import { initialUnitsData } from '@/lib/initial-data';
import { calculateAreaShares, calculateFees } from '@/lib/logic';

interface AppContextType {
  units: Unit[];
  settings: BuildingSettings | null;
  loading: boolean;
  updateSettings: (newSettings: Partial<BuildingSettings>) => void;
  recalculateFees: (newBudgetOrRate: number) => void;
  getUnitByCode: (code: string) => Unit | undefined;
}

const initialSettingsData: Omit<BuildingSettings, 'financials'> & { financials: Omit<BuildingSettings['financials'], 'last_recalculation_date'> } = {
  commonAreas: {
    global_amenities_sqm: 600.0,
    floor_standard_sqm: 80.0,
  },
  financials: {
    calculation_method: "budget_based",
    current_annual_budget: 1000000,
    rate_per_sqm: 250, // Default rate
    type_multipliers: {
      Shop: 2.0,
      Office: 1.25,
    },
  },
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [settings, setSettings] = useState<BuildingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  const performFullRecalculation = useCallback((currentSettings: BuildingSettings): Unit[] => {
    // This function is now purely for calculation and doesn't assume initial data structure.
    const mappedUnits: Unit[] = initialUnitsData.map(u => ({
      ...u,
      net_sqm: u.sqm,
      billing_parent_code: u.parent,
      type_factor: 1.0, // Will be calculated in calculateAreaShares
      share_local_common: 0,
      share_global_common: 0,
      total_gross_sqm: 0,
      weighted_billing_area: 0,
      current_maintenance_fee: 0,
    } as Unit));

    let processedUnits = calculateAreaShares(mappedUnits, currentSettings);
    processedUnits = calculateFees(processedUnits, currentSettings);
    
    return processedUnits;
  }, []);

  useEffect(() => {
    // Defer ALL initialization logic to the client side inside a single useEffect to prevent hydration errors.
    const initializeState = () => {
        setLoading(true);
        // Step 1: Create the initial settings object on the client.
        const clientSideSettings: BuildingSettings = {
            ...initialSettingsData,
            financials: {
                ...initialSettingsData.financials,
                last_recalculation_date: new Date().toISOString(),
            }
        };

        // Step 2: Perform calculations using these new settings.
        const calculatedUnits = performFullRecalculation(clientSideSettings);
        
        // Step 3: Set both state variables at the same time.
        setSettings(clientSideSettings);
        setUnits(calculatedUnits);
        setLoading(false);
    };
    
    initializeState();
  }, [performFullRecalculation]);

  const updateSettings = (newSettingsPartial: Partial<BuildingSettings>) => {
    setSettings(prevSettings => {
        if (!prevSettings) return null; // Should not happen with new logic
        
        const newSettings: BuildingSettings = {
            ...prevSettings,
            ...newSettingsPartial,
            commonAreas: {
                ...prevSettings.commonAreas,
                ...newSettingsPartial.commonAreas,
            },
            financials: {
                ...prevSettings.financials,
                ...newSettingsPartial.financials,
                last_recalculation_date: new Date().toISOString(),
            }
        };

        // When settings change, always trigger a full recalculation.
        const recalculatedUnits = performFullRecalculation(newSettings);
        setUnits(recalculatedUnits);
        
        return newSettings;
    });
  };
  
  const recalculateFees = (newBudgetOrRate: number) => {
     updateSettings({
        financials: {
            ...(settings?.financials ?? initialSettingsData.financials),
            calculation_method: settings?.financials.calculation_method === 'budget_based' ? 'budget_based' : 'rate_based',
            current_annual_budget: settings?.financials.calculation_method === 'budget_based' ? newBudgetOrRate : settings!.financials.current_annual_budget,
            rate_per_sqm: settings?.financials.calculation_method === 'rate_based' ? newBudgetOrRate : settings!.financials.rate_per_sqm,
        }
    });
  };

  const getUnitByCode = (code: string) => {
    return units.find(u => u.code === code);
  };

  return (
    <AppContext.Provider value={{ units, settings, loading, updateSettings, recalculateFees, getUnitByCode }}>
      {children}
    </AppContext.Provider>
  );
}
