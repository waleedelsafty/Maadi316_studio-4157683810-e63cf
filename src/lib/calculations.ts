
// src/lib/calculations.ts

/**
 * Calculates the number of quarters that have started between a given date and today.
 * If the start date is in the middle of a quarter, that quarter is counted.
 * @param calculationStartDate The starting date for the calculation.
 * @returns The number of quarters that have started.
 */
export function getQuartersSince(calculationStartDate: Date | null | undefined): number {
    if (!calculationStartDate) {
        return 0;
    }

    const now = new Date();
    let start = new Date(calculationStartDate);

    // If start date is in the future, no quarters have passed.
    if (start > now) {
        return 0;
    }

    let quarters = 0;
    let current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= now) {
        const month = current.getMonth();
        // A new quarter starts in January (0), April (3), July (6), October (9)
        if (month === 0 || month === 3 || month === 6 || month === 9) {
             // Only count if this quarter start is on or after the original start date.
             // This correctly handles a financialStartDate that is after the start of its own quarter.
             if (current >= new Date(start.getFullYear(), start.getMonth(), 1)) {
                quarters++;
             }
        }
        // Move to the next month
        current.setMonth(current.getMonth() + 1);
    }
    
    // The loop above only counts when a *new* quarter starts.
    // We need to also count the very first quarter if it wasn't counted.
    // Let's use a simpler, more robust logic.

    const end = new Date();

    // If start date is in the future, no quarters have passed.
    if (start > end) {
        return 0;
    }

    const startYear = start.getFullYear();
    const startQuarter = Math.floor(start.getMonth() / 3); // 0-indexed (0, 1, 2, 3)

    const endYear = end.getFullYear();
    const endQuarter = Math.floor(end.getMonth() / 3); // 0-indexed (0, 1, 2, 3)

    const yearDiff = endYear - startYear;
    
    // Total quarters based on year difference, plus the difference in quarters within the year.
    // We add 1 because the calculation is inclusive of the start and end quarters.
    const totalQuarters = (yearDiff * 4) + (endQuarter - startQuarter) + 1;

    return totalQuarters;
}
