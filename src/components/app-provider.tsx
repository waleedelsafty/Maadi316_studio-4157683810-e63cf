"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { Unit, BuildingSettings } from '@/lib/types';
import { initialUnitsData } from '@/lib/initial-data';
import { calculateAreaShares, calculateFees } from '@/lib/logic';

interface AppContextType {
  units: Unit[];
  settings: BuildingSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<BuildingSettings>) => void;
  recalculateFees: (newBudgetOrRate: number) => void;
  getUnitByCode: (code: string) => Unit | undefined;
}

const defaultSettings: BuildingSettings = {
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
    last_recalculation_date: new Date().toISOString(),
  },
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [settings, setSettings] = useState<BuildingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const performRecalculation = useCallback((currentUnits: Unit[], currentSettings: BuildingSettings): Unit[] => {
    // 1. Map initial raw data to Unit structure, preserving existing units if needed.
    // This simple implementation re-maps every time.
    const mappedUnits: Unit[] = initialUnitsData.map(u => ({
      ...u,
      net_sqm: u.sqm,
      billing_parent_code: u.parent,
      // The factor from raw data is now a multiplier in settings, not on the unit itself
      type_factor: currentSettings.financials.type_multipliers[u.type as keyof typeof currentSettings.financials.type_multipliers] || 1.0,
      // Initialize calculated fields
      share_local_common: 0,
      share_global_common: 0,
      total_gross_sqm: 0,
      weighted_billing_area: 0,
      current_maintenance_fee: 0,
    } as Unit));

    // 2. Run Algorithm A (Area Calculation)
    let processedUnits = calculateAreaShares(mappedUnits, currentSettings);

    // 3. Run Algorithm B (Fee Calculation)
    processedUnits = calculateFees(processedUnits, currentSettings);
    
    return processedUnits;
  }, []);


  useEffect(() => {
    setLoading(true);
    const initialCalculatedUnits = performRecalculation(units, defaultSettings);
    setUnits(initialCalculatedUnits);
    setSettings(defaultSettings);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performRecalculation]);

  const updateSettings = (newSettingsPartial: Partial<BuildingSettings>) => {
    setLoading(true);
    const newSettings: BuildingSettings = {
        ...settings,
        ...newSettingsPartial,
        commonAreas: {
            ...settings.commonAreas,
            ...newSettingsPartial.commonAreas,
        },
        financials: {
            ...settings.financials,
            ...newSettingsPartial.financials,
            last_recalculation_date: new Date().toISOString(),
        }
    };
    setSettings(newSettings);
    const updatedUnits = performRecalculation(units, newSettings);
    setUnits(updatedUnits);
    setLoading(false);
  };
  
  const recalculateFees = (newBudgetOrRate: number) => {
    setLoading(true);
    const newFinancials = { ...settings.financials, last_recalculation_date: new Date().toISOString() };
    if (settings.financials.calculation_method === 'budget_based') {
        newFinancials.current_annual_budget = newBudgetOrRate;
    } else {
        newFinancials.rate_per_sqm = newBudgetOrRate;
    }

    const newSettings: BuildingSettings = {
        ...settings,
        financials: newFinancials,
    };
    setSettings(newSettings);
    const updatedUnits = calculateFees(units, newSettings);
    setUnits(updatedUnits);
    setLoading(false);
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
