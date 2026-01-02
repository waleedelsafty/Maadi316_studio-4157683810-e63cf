
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import useLocalStorage from "@/hooks/use-local-storage";

type QuarterRangeOption = 'current_quarter' | 'year_to_date' | 'all_since_start' | `year_${number}`;

type AppContextType = {
    quarterRange: QuarterRangeOption;
    setQuarterRange: (value: QuarterRangeOption | ((val: QuarterRangeOption) => QuarterRangeOption)) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [quarterRange, setQuarterRange] = useLocalStorage<QuarterRangeOption>('global-quarter-range', 'all_since_start');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const value = useMemo(() => ({
    quarterRange,
    setQuarterRange,
  }), [quarterRange, setQuarterRange]);

  if (!isMounted) {
    return null;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
