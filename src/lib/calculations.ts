
// src/lib/calculations.ts
import { startOfQuarter, isBefore, addQuarters, getYear, getQuarter as getQuarterFns } from 'date-fns';

type QuarterRangeOption = 'current_quarter' | 'year_to_date' | 'all_since_start';

export type Quarter = {
    year: number;
    quarter: 1 | 2 | 3 | 4;
};

export function formatQuarter(q: Quarter): string {
    return `Q${q.quarter} ${q.year}`;
}

export function getCurrentQuarter(): Quarter {
    const now = new Date();
    return {
        year: getYear(now),
        quarter: getQuarterFns(now) as Quarter['quarter']
    };
}


/**
 * Generates an array of quarter strings (e.g., "Q1 2024") for a given date range.
 * @param financialStartDate The start date of the financial period.
 * @param rangeOption The time range to calculate for.
 * @returns An array of quarter strings.
 */
export function getQuartersForRange(
    financialStartDate: Date | null | undefined,
    rangeOption: QuarterRangeOption
): string[] {
    if (!financialStartDate) {
        return [];
    }

    const now = new Date();
    const quarters: string[] = [];

    let startDate: Date;
    const currentQuarterInfo = getCurrentQuarter();

    switch (rangeOption) {
        case 'current_quarter':
            return [formatQuarter(currentQuarterInfo)];
        
        case 'year_to_date':
            startDate = new Date(currentQuarterInfo.year, 0, 1); // January 1st of the current year
            break;
            
        case 'all_since_start':
        default:
            startDate = financialStartDate;
            break;
    }

    // Align the start date with the beginning of its quarter
    let currentQuarterDate = startOfQuarter(startDate);
    
    // Ensure we don't start before the financial start date's quarter
    if (isBefore(currentQuarterDate, startOfQuarter(financialStartDate))) {
        currentQuarterDate = startOfQuarter(financialStartDate);
    }

    while (isBefore(currentQuarterDate, now) || currentQuarterDate.getTime() === startOfQuarter(now).getTime()) {
        const year = getYear(currentQuarterDate);
        const quarter = getQuarterFns(currentQuarterDate) as Quarter['quarter'];
        quarters.push(formatQuarter({ year, quarter }));
        
        // Move to the next quarter
        currentQuarterDate = addQuarters(currentQuarterDate, 1);
    }
    
    return quarters;
}
