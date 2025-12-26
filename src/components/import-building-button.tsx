
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Building, Level, Unit } from '@/types';
import { Upload } from 'lucide-react';
import { ImportPreviewDialog, type ImportData } from './import-preview-dialog';

export function ImportBuildingButton({ existingBuildings }: { existingBuildings: Building[] }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const firestore = useFirestore();
    const user = useUser();
    const [isImporting, setIsImporting] = useState(false);
    
    const [previewData, setPreviewData] = useState<ImportData | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                if (!result) throw new Error("File could not be read.");
                
                let data: any;
                if (file.name.endsWith('.json')) {
                    data = JSON.parse(result as string);
                     setPreviewData({ format: 'json', data });
                } else {
                    // For excel, we need to implement a more robust parsing
                    throw new Error("Excel import is not fully supported yet.");
                }

                setIsPreviewOpen(true);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Parse Failed', description: `Could not read the file. Error: ${error.message}` });
            } finally {
                setIsImporting(false);
            }
        };

        reader.readAsText(file);

        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleConfirmImport = async (data: ImportData) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to import.'});
            return;
        }

        setIsImporting(true);
        try {
            const importedData = data.data;

            if (!importedData) {
                 throw new Error("Imported file appears to be empty or corrupted.");
            }
            if (!importedData.Building_name) {
                throw new Error("Could not find 'Building_name' in the imported file.");
            }
            
            const { id, ownerId, createdAt, floors, units, levels, ...buildingCore } = importedData;
            
            let finalBuildingName = buildingCore.Building_name;
            const existingNames = new Set((existingBuildings || []).map(b => b.Building_name));
            if (existingNames.has(finalBuildingName)) {
                const date = new Date().toISOString().split('T')[0];
                finalBuildingName = `${finalBuildingName}_#2_${date}`;
            }

            const newBuildingDocData = {
                Building_name: finalBuildingName,
                address: buildingCore.address || 'N/A',
                hasBasement: buildingCore.hasBasement || false,
                basementCount: buildingCore.basementCount || 0,
                hasMezzanine: buildingCore.hasMezzanine || false,
                mezzanineCount: buildingCore.mezzanineCount || 0,
                hasPenthouse: buildingCore.hasPenthouse || false,
                hasRooftop: buildingCore.hasRooftop || false,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
            };

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
                accept=".json"
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
