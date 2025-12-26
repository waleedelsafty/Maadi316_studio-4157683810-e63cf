
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import type { Building, Level, Unit } from '@/types';
import { Upload } from 'lucide-react';

type ImportedBuilding = Omit<Building, 'id' | 'createdAt' | 'ownerId'>;


export function ImportBuildingButton({ existingBuildings }: { existingBuildings: Building[] }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const firestore = useFirestore();
    const user = useUser();
    const [isImporting, setIsImporting] = useState(false);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        if (file.name.endsWith('.json')) {
            reader.onload = (e) => handleImport(e.target?.result as string, 'json');
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (e) => handleImport(e.target?.result as ArrayBuffer, 'xlsx');
            reader.readAsArrayBuffer(file);
        } else {
            toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please select a .json or .xlsx file.' });
            setIsImporting(false);
        }

        // Reset file input
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImport = async (fileContent: string | ArrayBuffer, format: 'json' | 'xlsx') => {
        try {
            if (!firestore || !user) throw new Error("Authentication error.");

            let buildingData: Partial<ImportedBuilding>;
            
            if (format === 'json') {
                const importedJson = JSON.parse(fileContent as string);
                
                // Correctly extract top-level properties, ignoring nested arrays for now
                const { levels, units, id, ownerId, createdAt, ...restOfBuilding } = importedJson;
                buildingData = restOfBuilding;

            } else { // xlsx
                const workbook = XLSX.read(fileContent as ArrayBuffer, { type: 'buffer' });
                
                const buildingSheet = workbook.Sheets['Building Info'];
                if (!buildingSheet) throw new Error("Missing 'Building Info' worksheet in the Excel file.");
                
                const buildingInfoJson: any[] = XLSX.utils.sheet_to_json(buildingSheet, { header: ["Key", "Value"], skipHeader: false });
                
                const infoMap = buildingInfoJson.reduce((acc, row) => {
                    acc[row.Key] = row.Value;
                    return acc;
                }, {} as { [key: string]: any });

                buildingData = {
                    name: infoMap['Building Name'],
                    address: infoMap['Address'],
                    hasBasement: String(infoMap['Has Basement']).startsWith('Yes'),
                    basementCount: String(infoMap['Has Basement']).startsWith('Yes') ? parseInt(String(infoMap['Has Basement']).match(/\((\d+)/)?.[1] || '1', 10) : 0,
                    hasMezzanine: String(infoMap['Has Mezzanine']).startsWith('Yes'),
                    mezzanineCount: String(infoMap['Has Mezzanine']).startsWith('Yes') ? parseInt(String(infoMap['Has Mezzanine']).match(/\((\d+)/)?.[1] || '1', 10) : 0,
                    hasPenthouse: infoMap['Has Penthouse'] === 'Yes',
                    hasRooftop: infoMap['Has Rooftop'] === 'Yes',
                };
            }
            
            if (!buildingData || !buildingData.name) {
                throw new Error("Could not find building name in the imported file.");
            }
            
            // --- Data processing and Firestore writing ---
            // Handle name conflicts
            let finalBuildingName = buildingData.name;
            const existingNames = new Set((existingBuildings || []).map(b => b.name));
            if (existingNames.has(finalBuildingName)) {
                const date = new Date().toISOString().split('T')[0];
                finalBuildingName = `${finalBuildingName}_#2_${date}`;
            }

            const newBuildingDoc: Omit<Building, 'id'> = {
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
                floors: 0, // Will be updated later
                units: 0, // Will be updated later
            };

            await addDoc(collection(firestore, 'buildings'), newBuildingDoc);

            toast({ title: 'Import Successful', description: `Building "${finalBuildingName}" shell has been created.` });

        } catch (error: any) {
            console.error("Import failed:", error);
            toast({ variant: 'destructive', title: 'Import Failed', description: error.message || 'Could not parse or save the file.' });
        } finally {
            setIsImporting(false);
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
        </>
    );
}
