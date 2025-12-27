
// src/lib/calculations.ts

/**
 * Calculates the number of full quarters that have passed between a start date and today.
 * @param calculationStartDate The starting date for the calculation.
 * @returns The number of quarters passed.
 */
export function getQuartersSince(calculationStartDate: Date | null | undefined): number {
    if (!calculationStartDate) {
        return 0;
    }

    const now = new Date();
    const start = new Date(calculationStartDate);

    // Ensure start date is not in the future
    if (start > now) {
        return 0;
    }
    
    // Set start day to 1 to count the start quarter if it's not in the future
    start.setDate(1);

    const startYear = start.getFullYear();
    const startQuarter = Math.floor(start.getMonth() / 3) + 1;

    const nowYear = now.getFullYear();
    const nowQuarter = Math.floor(now.getMonth() / 3) + 1;
    
    // Quarters passed in the same year
    if (startYear === nowYear) {
        return Math.max(0, nowQuarter - startQuarter + 1);
    }
    
    // Quarters remaining in the start year
    const quartersInStartYear = 4 - startQuarter + 1;

    // Quarters passed in the current year
    const quartersInCurrentYear = nowQuarter;
    
    // Quarters for the full years in between
    const fullYearsBetween = nowYear - startYear - 1;
    const quartersInFullYears = fullYearsBetween > 0 ? fullYearsBetween * 4 : 0;
    
    return quartersInStartYear + quartersInFullYears + quartersInCurrentYear;
}
