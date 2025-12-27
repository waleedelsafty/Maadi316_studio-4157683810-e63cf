
'use client';

import * as React from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export type UnitColumnVisibility = {
  type: boolean;
  level: boolean;
  owner: boolean;
};

export const defaultColumnVisibility: UnitColumnVisibility = {
  type: true,
  level: true,
  owner: true,
};

export default function DisplaySettingsPage() {
  const [columnVisibility, setColumnVisibility] = useLocalStorage<UnitColumnVisibility>(
    'unit-column-visibility',
    defaultColumnVisibility
  );

  const handleToggle = (key: keyof UnitColumnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Settings</CardTitle>
        <CardDescription>
          Customize the information you see across the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">All Units Table Columns</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which columns to display in the "All Units" table on the building detail page.
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>Show "Type" Column</Label>
              </div>
              <Switch
                checked={columnVisibility.type}
                onCheckedChange={() => handleToggle('type')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>Show "Level" Column</Label>
              </div>
              <Switch
                checked={columnVisibility.level}
                onCheckedChange={() => handleToggle('level')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>Show "Owner" Column</Label>
              </div>
              <Switch
                checked={columnVisibility.owner}
                onCheckedChange={() => handleToggle('owner')}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
