export interface BuildingSettings {
  commonAreas: {
    global_amenities_sqm: number;
    floor_standard_sqm: number;
  };
  financials: {
    calculation_method: "budget_based" | "rate_based";
    current_annual_budget: number;
    rate_per_sqm: number;
    type_multipliers: {
      Shop: number;
      Office: number;
      // Other types default to 1
    };
    last_recalculation_date: string; // ISO string
  };
}

export interface Unit {
  code: string;
  type: "Flat" | "Duplex" | "Shop" | "Office" | "Merged";
  billing_parent_code: string | null;
  owner: string;

  // Area Breakdown
  net_sqm: number;
  share_local_common: number;
  share_global_common: number;
  total_gross_sqm: number;

  // Financials
  type_factor: number;
  weighted_billing_area: number;
  current_maintenance_fee: number;
}
