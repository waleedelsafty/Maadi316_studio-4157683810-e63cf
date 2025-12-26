
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from './ui/scroll-area';

export type ImportData = {
    format: 'json' | 'xlsx';
    data: any;
}

type ImportPreviewDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    data: ImportData;
    onConfirm: (data: ImportData) => void;
};

// A recursive component to display nested JSON objects/arrays
const JsonViewer = ({ data }: { data: any }) => {
    if (data === null || typeof data !== 'object') {
        return <span className="text-sm text-green-600">{String(data)}</span>;
    }

    return (
        <div className="pl-4">
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex">
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 pr-2">{key}:</span>
                    {Array.isArray(value) ? (
                        <span className="text-sm text-muted-foreground italic">Array[{value.length}]</span>
                    ) : typeof value === 'object' && value !== null ? (
                        <JsonViewer data={value} />
                    ) : (
                        <span className="text-sm text-foreground truncate">{String(value)}</span>
                    )}
                </div>
            ))}
        </div>
    );
};


export function ImportPreviewDialog({ isOpen, onOpenChange, data, onConfirm }: ImportPreviewDialogProps) {
  
  const isJson = data.format === 'json';

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Import Preview</AlertDialogTitle>
          <AlertDialogDescription>
            The application has read the following data from the file. Please review it before confirming the import.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-[50vh] rounded-md border p-4 bg-muted/50">
            <div className="font-mono text-xs space-y-2">
                <h3 className="font-bold text-base mb-2">File Contents:</h3>
                 {isJson ? <JsonViewer data={data.data} /> : <p>Preview for this file type is not yet supported.</p>}
            </div>
        </ScrollArea>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(data)}>
            Confirm Import
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
