
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { DatePickerOriginal } from '@/components/ui/date-picker-original';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { parseDate } from '@internationalized/date';
import { I18nProvider } from 'react-aria';

export default function DatePickerTestPage() {
  const [originalDate, setOriginalDate] = React.useState<Date | undefined>(new Date());
  
  // React Aria uses a different date object structure.
  const [customDate, setCustomDate] = React.useState(parseDate(new Date().toISOString().split('T')[0]));

  const customDateAsJsDate = customDate ? customDate.toDate(Intl.DateTimeFormat().resolvedOptions().timeZone) : null;

  return (
    <I18nProvider locale="en-US">
      <Card>
        <CardHeader>
          <CardTitle>Date Picker Comparison</CardTitle>
          <CardDescription>
            A side-by-side comparison of the original date picker and our new custom-built version.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-center">Original ShadCN/Tailwind Date Picker</h3>
               <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                  <DatePickerOriginal 
                      value={originalDate}
                      onSelect={setOriginalDate}
                  />
              </div>
              <div className="space-y-2">
                  <h4 className="font-medium">Current State Value</h4>
                  <div className="p-4 bg-muted/50 rounded-lg text-sm min-h-[60px]">
                      {originalDate ? originalDate.toString() : 'No date selected'}
                  </div>
              </div>
              <Button variant="outline" onClick={() => setOriginalDate(undefined)} className="w-full">Clear Date</Button>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-center">Our New Custom Date Picker</h3>
              <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                  <DatePicker 
                      label="Appointment date"
                      value={customDate}
                      onChange={setCustomDate}
                  />
              </div>
               <div className="space-y-2">
                  <h4 className="font-medium">Current State Value</h4>
                  <div className="p-4 bg-muted/50 rounded-lg text-sm min-h-[60px]">
                      {customDateAsJsDate ? customDateAsJsDate.toString() : 'No date selected'}
                  </div>
              </div>
              <Button variant="outline" onClick={() => setCustomDate(null as any)} className="w-full">Clear Date</Button>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-semibold text-lg">Test Notes</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>The left component is the default one you disliked, based on `react-day-picker`.</li>
              <li>The right component is our new version, built from scratch using `react-aria`. It has no dependency on the old library.</li>
              <li>Notice the different visual design and interaction model of the new component.</li>
            </ul>
          </div>
          
        </CardContent>
      </Card>
    </I18nProvider>
  );
}
