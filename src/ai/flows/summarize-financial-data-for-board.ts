'use server';

/**
 * @fileOverview Summarizes the building's financial data for board members.
 *
 * - summarizeFinancialDataForBoard - A function that generates a financial summary for the board.
 * - SummarizeFinancialDataForBoardInput - The input type for the summarizeFinancialDataForBoard function.
 * - SummarizeFinancialDataForBoardOutput - The return type for the summarizeFinancialDataForBoard function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFinancialDataForBoardInputSchema = z.object({
  annualBudget: z.number().describe('The current annual budget of the building.'),
  totalCollectedFees: z
    .number()
    .describe('The total amount of fees collected from all units.'),
  outstandingFees: z
    .number()
    .describe('The total amount of outstanding fees from all units.'),
  numberOfUnits: z.number().describe('The total number of units in the building.'),
  numberOfUnitsWithOutstandingFees: z
    .number()
    .describe('The number of units with outstanding fees.'),
  averageMaintenanceFee: z
    .number()
    .describe('The average maintenance fee across all units.'),
});
export type SummarizeFinancialDataForBoardInput = z.infer<
  typeof SummarizeFinancialDataForBoardInputSchema
>;

const SummarizeFinancialDataForBoardOutputSchema = z.object({
  summary: z.string().describe('A summary of the building\s financial data.'),
});
export type SummarizeFinancialDataForBoardOutput = z.infer<
  typeof SummarizeFinancialDataForBoardOutputSchema
>;

export async function summarizeFinancialDataForBoard(
  input: SummarizeFinancialDataForBoardInput
): Promise<SummarizeFinancialDataForBoardOutput> {
  return summarizeFinancialDataForBoardFlow(input);
}

const summarizeFinancialDataForBoardPrompt = ai.definePrompt({
  name: 'summarizeFinancialDataForBoardPrompt',
  input: {schema: SummarizeFinancialDataForBoardInputSchema},
  output: {schema: SummarizeFinancialDataForBoardOutputSchema},
  prompt: `You are a financial analyst providing a summary of the building's financial data for the board members.

  Provide a concise summary of the key financial data, highlighting any trends, anomalies, and potential issues.

  Annual Budget: {{{annualBudget}}}
  Total Collected Fees: {{{totalCollectedFees}}}
  Outstanding Fees: {{{outstandingFees}}}
  Number of Units: {{{numberOfUnits}}}
  Number of Units with Outstanding Fees: {{{numberOfUnitsWithOutstandingFees}}}
  Average Maintenance Fee: {{{averageMaintenanceFee}}}
  `,
});

const summarizeFinancialDataForBoardFlow = ai.defineFlow(
  {
    name: 'summarizeFinancialDataForBoardFlow',
    inputSchema: SummarizeFinancialDataForBoardInputSchema,
    outputSchema: SummarizeFinancialDataForBoardOutputSchema,
  },
  async input => {
    const {output} = await summarizeFinancialDataForBoardPrompt(input);
    return output!;
  }
);
