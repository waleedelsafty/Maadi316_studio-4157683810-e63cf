'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
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
                buildingData = data;
                levelsData = data.levels || [];
                unitsData = data.units || [];
            } else { // xlsx
                const workbook = XLSX.read(fileContent as ArrayBuffer, { type: 'buffer' });
                
                // Parse Building Info
                const buildingSheet = workbook.Sheets['Building Info'];
                const buildingInfoJson: any[] = XLSX.utils.sheet_to_json(buildingSheet, { header: ['Key', 'Value'] });
                buildingData = buildingInfoJson.reduce((obj: any, item) => {
                    if (item.Key === 'Building Name') obj.name = item.Value;
                    if (item.Key === 'Address') obj.address = item.Value;
                    if (item.Key === 'Has Basement') {
                        obj.hasBasement = item.Value.startsWith('Yes');
                        if (obj.hasBasement) obj.basementCount = parseInt(item.Value.match(/\((\d+)/)?.[1] || 1, 10);
                    }
                    if (item.Key === 'Has Mezzanine') {
                        obj.hasMezzanine = item.Value.startsWith('Yes');
                         if (obj.hasMezzanine) obj.mezzanineCount = parseInt(item.Value.match(/\((\d+)/)?.[1] || 1, 10);
                    }
                    if (item.Key === 'Has Penthouse') obj.hasPenthouse = item.Value === 'Yes';
                    if (item.Key === 'Has Rooftop') obj.hasRooftop = item.Value === 'Yes';
                    return obj;
                }, {});

                // Parse Levels
                const levelsSheet = workbook.Sheets['Levels'];
                const rawLevels: any[] = XLSX.utils.sheet_to_json(levelsSheet);
                levelsData = rawLevels.map(l => ({
                    name: l['Level Name'],
                    type: l['Type'],
                    floorNumber: l['Floor Number'] === 'N/A' ? undefined : l['Floor Number']
                }));
                
                // Parse Units
                const unitsSheet = workbook.Sheets['Units'];
                const rawUnits: any[] = XLSX.utils.sheet_to_json(unitsSheet);
                unitsData = rawUnits.map(u => ({
                    unitNumber: u['Unit #'],
                    originalLevelName: u['Level'],
                    type: u['Type'],
                    sqm: u['Size (sqm)'],
                    ownerName: u['Owner'],
                    quarterlyMaintenanceFees: u['Quarterly Maintenance'],
                }));
            }
            
            // --- Data processing and Firestore writing ---

            // Handle name conflicts
            let finalBuildingName = buildingData.name;
            const existingNames = new Set(existingBuildings.map(b => b.name));
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
