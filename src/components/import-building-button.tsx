
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
type ImportedLevel = Omit<Level, 'id' | 'createdAt'>;
type ImportedUnit = Omit<Unit, 'id' | 'createdAt' | 'levelId'> & { originalLevelName?: string };


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

            let buildingData: ImportedBuilding;
            
            if (format === 'json') {
                const data = JSON.parse(fileContent as string);
                
                // Separate building properties from levels and units
                const { levels, units, id, ownerId, createdAt, ...restOfBuilding } = data;
                buildingData = restOfBuilding;

            } else { // xlsx
                const workbook = XLSX.read(fileContent as ArrayBuffer, { type: 'buffer' });
                
                const buildingSheet = workbook.Sheets['Building Info'];
                if (!buildingSheet) throw new Error("Missing 'Building Info' worksheet in the Excel file.");
                const buildingInfoJson: any[] = XLSX.utils.sheet_to_json(buildingSheet);
                
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
                ...buildingData,
                name: finalBuildingName,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
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
