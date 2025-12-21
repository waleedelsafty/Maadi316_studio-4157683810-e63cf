'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting initial building settings based on a building description.
 *
 * - suggestInitialBuildingSettings - A function that suggests initial building settings.
 * - SuggestInitialBuildingSettingsInput - The input type for the suggestInitialBuildingSettings function.
 * - SuggestInitialBuildingSettingsOutput - The return type for the suggestInitialBuildingSettings function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestInitialBuildingSettingsInputSchema = z.object({
  buildingDescription: z
    .string()
    .describe(
      'A detailed description of the building, including its size, number of units, amenities, and any other relevant characteristics.'
    ),
});
export type SuggestInitialBuildingSettingsInput = z.infer<
  typeof SuggestInitialBuildingSettingsInputSchema
>;

const SuggestInitialBuildingSettingsOutputSchema = z.object({
  globalAmenitiesSqm: z
    .number()
    .describe('Suggested total size of global amenities (Pool, Lobby, Gym) in square meters.'),
  floorStandardSqm: z
    .number()
    .describe(
      'Suggested standard size of a corridor/shafts per floor in square meters.'
    ),
  currentAnnualBudget: z
    .number()
    .describe('Suggested initial current annual budget for the building in EGP.'),
});
export type SuggestInitialBuildingSettingsOutput = z.infer<
  typeof SuggestInitialBuildingSettingsOutputSchema
>;

export async function suggestInitialBuildingSettings(
  input: SuggestInitialBuildingSettingsInput
): Promise<SuggestInitialBuildingSettingsOutput> {
  return suggestInitialBuildingSettingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestInitialBuildingSettingsPrompt',
  input: {schema: SuggestInitialBuildingSettingsInputSchema},
  output: {schema: SuggestInitialBuildingSettingsOutputSchema},
  prompt: `You are an experienced property management consultant. Based on the description of the building provided, suggest reasonable initial values for the building settings.

Building Description: {{{buildingDescription}}}

Consider the size of the building, the number of units, and the amenities when determining the appropriate values.

Provide the suggested values in the following JSON format:
{
  "globalAmenitiesSqm": <suggested size in square meters>,
  "floorStandardSqm": <suggested size in square meters>,
  "currentAnnualBudget": <suggested budget in EGP>
}
`,
});

const suggestInitialBuildingSettingsFlow = ai.defineFlow(
  {
    name: 'suggestInitialBuildingSettingsFlow',
    inputSchema: SuggestInitialBuildingSettingsInputSchema,
    outputSchema: SuggestInitialBuildingSettingsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
