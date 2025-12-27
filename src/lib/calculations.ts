
// src/lib/calculations.ts

/**
 * Calculates the number of full quarters that have passed between a start date and an end date.
 * A quarter starts on Jan 1, Apr 1, Jul 1, Oct 1.
 * This calculation is inclusive of the start and end quarters.
 * @param calculationStartDate The starting date for the calculation.
 * @returns The number of quarters that have started.
 */
export function getQuartersSince(calculationStartDate: Date | null | undefined): number {
    if (!calculationStartDate) {
        return 0;
    }

    const start = new Date(calculationStartDate);
    const end = new Date(); // Today

    // If start date is in the future, no quarters have passed.
    if (start > end) {
        return 0;
    }

    const startYear = start.getFullYear();
    // 0-indexed quarter (0 for Q1, 1 for Q2, etc.)
    const startQuarter = Math.floor(start.getMonth() / 3); 

    const endYear = end.getFullYear();
    const endQuarter = Math.floor(end.getMonth() / 3);

    // Calculate the difference in years and multiply by 4 quarters per year.
    const yearDifferenceInQuarters = (endYear - startYear) * 4;

    // Calculate the difference in quarters within the year.
    const quarterDifference = endQuarter - startQuarter;

    // Add 1 to be inclusive of the starting quarter.
    const totalQuarters = yearDifferenceInQuarters + quarterDifference + 1;

    return totalQuarters > 0 ? totalQuarters : 0;
}
