
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Building } from '@/types';
import { Upload } from 'lucide-react';
import { ImportPreviewDialog, type ImportData } from './import-preview-dialog';

export function ImportBuildingButton({ existingBuildings }: { existingBuildings: Building[] }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const firestore = useFirestore();
    const user = useUser();
    const [isImporting, setIsImporting] = useState(false);
    
    // State for the new preview dialog
    const [previewData, setPreviewData] = useState<ImportData | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        if (file.name.endsWith('.json')) {
            reader.onload = (e) => handlePreview(e.target?.result as string, 'json');
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
             toast({ variant: 'destructive', title: 'Unsupported for now', description: 'Excel import is temporarily disabled for debugging.' });
             setIsImporting(false);
        } else {
            toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please select a .json file.' });
            setIsImporting(false);
        }

        // Reset file input
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handlePreview = (fileContent: string | ArrayBuffer, format: 'json' | 'xlsx') => {
        try {
            if (format === 'json') {
                const data = JSON.parse(fileContent as string);
                setPreviewData({ format: 'json', data });
                setIsPreviewOpen(true);
            }
            // XLSX logic will be re-added here later
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Parse Failed', description: `Could not read the JSON file. Error: ${error.message}` });
        } finally {
            setIsImporting(false);
        }
    };
    
    const handleConfirmImport = async (data: ImportData) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to import.'});
            return;
        }

        setIsImporting(true);
        try {
            let buildingData: Partial<Omit<Building, 'id' | 'ownerId' | 'createdAt'>>;
            
            // For now, we only handle JSON
            if (data.format === 'json') {
                 const { id, ownerId, createdAt, floors, units, levels, ...buildingCore } = data.data;
                 buildingData = buildingCore;
            } else {
                throw new Error("Excel format not supported yet in confirmation step.");
            }

            if (!buildingData.name) {
                throw new Error("Could not find building name in the imported file.");
            }
            
            let finalBuildingName = buildingData.name;
            const existingNames = new Set((existingBuildings || []).map(b => b.name));
            if (existingNames.has(finalBuildingName)) {
                const date = new Date().toISOString().split('T')[0];
                finalBuildingName = `${finalBuildingName}_#2_${date}`;
            }

            const newBuildingDocData = {
                name: finalBuildingName,
                address: buildingData.address || 'N/A',
                hasBasement: buildingData.hasBasement || false,
                basementCount: buildingData.basementCount || 0,
                hasMezzanine: buildingData.hasMezzanine || false,
                mezzanineCount: buildingData.mezzanineCount || 0,
                hasPenthouse: buildingData.hasPenthouse || false,
                hasRooftop: buildingData.hasRooftop || false,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
            };

            // For now, we just create the shell as requested.
            await addDoc(collection(firestore, 'buildings'), newBuildingDocData);

            toast({ title: 'Import Successful', description: `Building "${finalBuildingName}" shell has been created.` });

        } catch (error: any) {
            console.error("Import failed:", error);
            toast({ variant: 'destructive', title: 'Import Failed', description: error.message || 'Could not process the file.' });
        } finally {
            setIsImporting(false);
            setIsPreviewOpen(false);
            setPreviewData(null);
        }
    };


    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept=".json,.xlsx"
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                 <Upload className="mr-2 h-4 w-4" />
                {isImporting ? 'Importing...' : 'Import Building'}
            </Button>
            
            {previewData && (
                <ImportPreviewDialog 
                    isOpen={isPreviewOpen}
                    onOpenChange={setIsPreviewOpen}
                    data={previewData}
                    onConfirm={handleConfirmImport}
                />
            )}
        </>
    );
}
