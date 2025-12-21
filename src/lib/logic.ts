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
    const weighted_billing_area = total_gross_sqm * unit.type_factor;

    return {
      ...unit,
      share_local_common,
      share_global_common,
      total_gross_sqm,
      weighted_billing_area,
    };
  });
}


/**
 * Algorithm B: The "Budget-Based" Fee Calculator
 * Distributes the total budget across units based on their weighted area.
 */
export function calculateFees(units: Unit[], newAnnualBudget: number): Unit[] {
  // Create a map for easy lookup of units by code
  const unitsMap = new Map(units.map(u => [u.code, u]));

  // Create a list of billable units (not a child of another unit)
  const billableUnits = units.filter(u => u.billing_parent_code === null);
  
  // Calculate the effective weighted area for each billable unit, rolling up children
  const billableUnitsWithEffectiveArea = billableUnits.map(parent => {
    let effective_weighted_billing_area = parent.weighted_billing_area;

    // Find children and add their weighted area
    const children = units.filter(u => u.billing_parent_code === parent.code);
    children.forEach(child => {
      effective_weighted_billing_area += child.weighted_billing_area;
    });

    return { ...parent, effective_weighted_billing_area };
  });

  // Calculate total weight across all billable units
  const totalWeight = billableUnitsWithEffectiveArea.reduce((sum, u) => sum + u.effective_weighted_billing_area, 0);

  // Calculate the cost per "point" of weighted area
  const costPerPoint = totalWeight > 0 ? newAnnualBudget / totalWeight : 0;
  
  // Distribute the new fee to each unit
  const updatedUnits = units.map(unit => {
    // If unit is a child, its fee is 0 as it's rolled into the parent
    if (unit.billing_parent_code) {
      return { ...unit, current_maintenance_fee: 0 };
    }

    // Find the corresponding billable unit with its calculated effective area
    const billableUnit = billableUnitsWithEffectiveArea.find(u => u.code === unit.code);
    if (billableUnit) {
      const new_fee = billableUnit.effective_weighted_billing_area * costPerPoint;
      return { ...unit, current_maintenance_fee: new_fee };
    }
    
    // Should not happen, but as a fallback
    return { ...unit, current_maintenance_fee: unit.weighted_billing_area * costPerPoint };
  });

  return updatedUnits;
}
