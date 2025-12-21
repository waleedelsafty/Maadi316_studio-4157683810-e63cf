import type { Unit, BuildingSettings } from './types';

// Helper to extract floor number from unit code.
// Floors are 'C', 'O', or numeric.
const getUnitFloor = (code: string): string => {
  if (code.startsWith('C') || code.startsWith('O')) {
    return code.charAt(0);
  }
  // For codes like '11', '25', '101', the floor is the prefix.
  return code.slice(0, -1);
};

/**
 * Algorithm A: The "Pro-Rata" Area Calculator
 * Distributes common area load based on unit size.
 */
export function calculateAreaShares(units: Unit[], settings: BuildingSettings): Unit[] {
  const { global_amenities_sqm, floor_standard_sqm } = settings.commonAreas;

  const totalBuildingNetSqm = units.reduce((sum, unit) => sum + unit.net_sqm, 0);

  const floors = units.reduce((acc, unit) => {
    const floor = getUnitFloor(unit.code);
    if (!acc[floor]) {
      acc[floor] = { units: [], totalNetSqm: 0 };
    }
    acc[floor].units.push(unit);
    acc[floor].totalNetSqm += unit.net_sqm;
    return acc;
  }, {} as Record<string, { units: Unit[]; totalNetSqm: number }>);

  return units.map(unit => {
    const floor = getUnitFloor(unit.code);
    const floorData = floors[floor];

    const share_local_common = floorData.totalNetSqm > 0
      ? floor_standard_sqm * (unit.net_sqm / floorData.totalNetSqm)
      : 0;

    const share_global_common = totalBuildingNetSqm > 0
      ? global_amenities_sqm * (unit.net_sqm / totalBuildingNetSqm)
      : 0;

    const total_gross_sqm = unit.net_sqm + share_local_common + share_global_common;
    
    const type_factor = settings.financials.type_multipliers[unit.type as keyof typeof settings.financials.type_multipliers] || 1.0;
    const weighted_billing_area = total_gross_sqm * type_factor;


    return {
      ...unit,
      share_local_common,
      share_global_common,
      total_gross_sqm,
      weighted_billing_area,
      type_factor,
    };
  });
}


/**
 * Algorithm B: The "Budget-Based" or "Rate-Based" Fee Calculator
 */
export function calculateFees(units: Unit[], settings: BuildingSettings): Unit[] {
    const { calculation_method, current_annual_budget, rate_per_sqm } = settings.financials;
    
    // Create a list of billable units (not a child of another unit)
    const billableUnits = units.filter(u => u.billing_parent_code === null);
    
    // Calculate the effective weighted area for each billable unit, rolling up children
    const billableUnitsWithEffectiveArea = billableUnits.map(parent => {
        let effective_weighted_billing_area = parent.weighted_billing_area;
        let effective_gross_sqm = parent.total_gross_sqm;

        // Find children and add their area
        const children = units.filter(u => u.billing_parent_code === parent.code);
        children.forEach(child => {
            effective_weighted_billing_area += child.weighted_billing_area;
            effective_gross_sqm += child.total_gross_sqm;
        });

        return { ...parent, effective_weighted_billing_area, effective_gross_sqm };
    });

    let costPerPoint = 0;
    let totalWeight = 0;

    if (calculation_method === 'budget_based') {
        totalWeight = billableUnitsWithEffectiveArea.reduce((sum, u) => sum + u.effective_weighted_billing_area, 0);
        costPerPoint = totalWeight > 0 ? current_annual_budget / totalWeight : 0;
    } else { // rate_based
        // For rate-based, the "cost per point" is just the rate itself, but it's applied to gross area, not weighted area.
        costPerPoint = rate_per_sqm;
    }
  
  // Distribute the new fee to each unit
  const updatedUnits = units.map(unit => {
    // If unit is a child, its fee is 0 as it's rolled into the parent
    if (unit.billing_parent_code) {
      return { ...unit, current_maintenance_fee: 0 };
    }

    const billableUnit = billableUnitsWithEffectiveArea.find(u => u.code === unit.code);

    if (billableUnit) {
        let new_fee = 0;
        if (calculation_method === 'budget_based') {
            new_fee = billableUnit.effective_weighted_billing_area * costPerPoint;
        } else { // rate_based
            // The final fee is rate * effective_gross_area * type_factor
            new_fee = billableUnit.effective_gross_sqm * costPerPoint * billableUnit.type_factor;
        }
       return { ...unit, current_maintenance_fee: new_fee };
    }
    
    // Fallback for non-billable units that were somehow not filtered, should not happen.
    return { ...unit, current_maintenance_fee: 0 };
  });

  return updatedUnits;
}