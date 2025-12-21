"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { Unit, BuildingSettings } from '@/lib/types';
import { initialUnitsData } from '@/lib/initial-data';
import { calculateAreaShares, calculateFees } from '@/lib/logic';

interface AppContextType {
  units: Unit[];
  settings: BuildingSettings;
  loading: boolean;
  updateSettings: (newSettings: BuildingSettings) => void;
  recalculateFees: (newBudget: number) => void;
  getUnitByCode: (code: string) => Unit | undefined;
}

const defaultSettings: BuildingSettings = {
  commonAreas: {
    global_amenities_sqm: 600.0,
    floor_standard_sqm: 80.0,
  },
  financials: {
    current_annual_budget: 1000000,
    last_recalculation_date: new Date().toISOString(),
  },
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [settings, setSettings] = useState<BuildingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const initializeData = useCallback(() => {
    setLoading(true);
    // 1. Map initial raw data to Unit structure
    const mappedUnits: Unit[] = initialUnitsData.map(u => ({
      ...u,
      net_sqm: u.sqm,
      billing_parent_code: u.parent,
      type_factor: u.factor,
      // Initialize calculated fields to 0
      share_local_common: 0,
      share_global_common: 0,
      total_gross_sqm: 0,
      weighted_billing_area: 0,
      current_maintenance_fee: 0,
    } as Unit));

    // 2. Run Algorithm A (Area Calculation)
    let processedUnits = calculateAreaShares(mappedUnits, defaultSettings);

    // 3. Run Algorithm B (Fee Calculation) with default budget
    processedUnits = calculateFees(processedUnits, defaultSettings.financials.current_annual_budget);
    
    setUnits(processedUnits);
    setSettings(defaultSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const updateSettings = (newSettings: BuildingSettings) => {
    setLoading(true);
    setSettings(newSettings);
    // When settings that affect area change, we must re-run area calculations
    const areaUpdatedUnits = calculateAreaShares(units, newSettings);
    // And then re-run fee calculations with the existing budget
    const feesUpdatedUnits = calculateFees(areaUpdatedUnits, newSettings.financials.current_annual_budget);
    setUnits(feesUpdatedUnits);
    setLoading(false);
  };
  
  const recalculateFees = (newBudget: number) => {
    setLoading(true);
    const newSettings: BuildingSettings = {
        ...settings,
        financials: {
            ...settings.financials,
            current_annual_budget: newBudget,
            last_recalculation_date: new Date().toISOString()
        }
    };
    setSettings(newSettings);
    const updatedUnits = calculateFees(units, newBudget);
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
