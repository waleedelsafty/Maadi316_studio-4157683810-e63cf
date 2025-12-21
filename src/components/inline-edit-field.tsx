
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Edit, X } from 'lucide-react';

type InlineEditFieldProps = {
  label: string;
  value: string;
  onSave: (newValue: string) => void;
};

export function InlineEditField({ label, value, onSave }: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentValue, setCurrentValue] = React.useState(value);

  React.useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleSave = () => {
    if (currentValue.trim()) {
      onSave(currentValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setCurrentValue(value);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };


  return (
    <div className="flex items-center justify-between min-h-[40px] border-b">
      <label className="text-sm font-medium text-muted-foreground w-1/3">{label}</label>
      {isEditing ? (
        <div className="flex items-center gap-2 w-2/3">
          <Input
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 w-2/3 group">
          <p className="text-sm font-semibold text-right flex-grow">{value}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

    