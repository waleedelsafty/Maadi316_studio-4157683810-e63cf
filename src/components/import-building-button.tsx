
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
            let levelsData: ImportedLevel[];
            let unitsData: ImportedUnit[];

            if (format === 'json') {
                const data = JSON.parse(fileContent as string);
                
                // Correctly separate building properties from levels and units
                const { levels, units, id, ownerId, createdAt, ...restOfBuilding } = data;
                
                buildingData = restOfBuilding;
                levelsData = levels || [];
                // Find original level name for units from the imported levels array
                unitsData = (units || []).map((u: Unit) => {
                    const level = (levelsData as (Level & { id: string})[]).find(l => l.id === u.levelId);
                    const { id, levelId, createdAt, ...restOfUnit } = u;
                    return { ...restOfUnit, originalLevelName: level?.name };
                });

            } else { // xlsx
                const workbook = XLSX.read(fileContent as ArrayBuffer, { type: 'buffer' });
                
                // Parse Building Info
                const buildingSheet = workbook.Sheets['Building Info'];
                if (!buildingSheet) throw new Error("Missing 'Building Info' worksheet in the Excel file.");
                const buildingInfoJson: any[] = XLSX.utils.sheet_to_json(buildingSheet, {header: 1});
                
                const infoMap = new Map(buildingInfoJson.map(row => [row[0], row[1]]));

                buildingData = {
                    name: infoMap.get('Building Name'),
                    address: infoMap.get('Address'),
                    hasBasement: String(infoMap.get('Has Basement')).startsWith('Yes'),
                    basementCount: String(infoMap.get('Has Basement')).startsWith('Yes') ? parseInt(String(infoMap.get('Has Basement')).match(/\((\d+)/)?.[1] || '1', 10) : undefined,
                    hasMezzanine: String(infoMap.get('Has Mezzanine')).startsWith('Yes'),
                    mezzanineCount: String(infoMap.get('Has Mezzanine')).startsWith('Yes') ? parseInt(String(infoMap.get('Has Mezzanine')).match(/\((\d+)/)?.[1] || '1', 10) : undefined,
                    hasPenthouse: infoMap.get('Has Penthouse') === 'Yes',
                    hasRooftop: infoMap.get('Has Rooftop') === 'Yes',
                };


                // Parse Levels
                const levelsSheet = workbook.Sheets['Levels'];
                const rawLevels: any[] = levelsSheet ? XLSX.utils.sheet_to_json(levelsSheet) : [];
                levelsData = rawLevels.map(l => ({
                    name: l['Level Name'],
                    type: l['Type'],
                    floorNumber: l['Floor Number'] === 'N/A' ? undefined : l['Floor Number']
                }));
                
                // Parse Units
                const unitsSheet = workbook.Sheets['Units'];
                const rawUnits: any[] = unitsSheet ? XLSX.utils.sheet_to_json(unitsSheet) : [];
                unitsData = rawUnits.map(u => ({
                    unitNumber: u['Unit #'],
                    originalLevelName: u['Level'],
                    type: u['Type'],
                    sqm: u['Size (sqm)'],
                    ownerName: u['Owner'],
                    quarterlyMaintenanceFees: u['Quarterly Maintenance'],
                }));
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

            const buildingRef = await addDoc(collection(firestore, 'buildings'), newBuildingDoc);

            const batch = writeBatch(firestore);
            
            // Add Levels and map old names to new IDs
            const levelNameMap = new Map<string, string>();
            for (const level of levelsData) {
                const levelRef = doc(collection(firestore, 'buildings', buildingRef.id, 'levels'));
                batch.set(levelRef, { ...level, createdAt: serverTimestamp() });
                levelNameMap.set(level.name, levelRef.id);
            }
            
            // Add Units, using the name map to set the correct new levelId
            for (const unit of unitsData) {
                const levelId = levelNameMap.get(unit.originalLevelName || '');
                if (levelId) {
                    const unitRef = doc(collection(firestore, 'buildings', buildingRef.id, 'units'));
                    const { originalLevelName, ...restOfUnit } = unit;
                    batch.set(unitRef, { ...restOfUnit, levelId, createdAt: serverTimestamp() });
                }
            }

            await batch.commit();

            toast({ title: 'Import Successful', description: `Building "${finalBuildingName}" has been created.` });

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

    