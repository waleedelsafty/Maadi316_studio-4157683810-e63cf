
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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
                let format: 'json' | 'xlsx' = 'json';

                if (file.name.endsWith('.json')) {
                    data = JSON.parse(result as string);
                    format = 'json';
                } else if (file.name.endsWith('.xlsx')) {
                    const workbook = XLSX.read(result, { type: 'array' });
                    // For excel, we construct a similar object to the JSON export
                    const buildingInfoSheet = workbook.Sheets['Building Info'];
                    const levelsSheet = workbook.Sheets['Levels'];
                    const unitsSheet = workbook.Sheets['Units'];

                    const buildingInfo = XLSX.utils.sheet_to_json<{ Key: string, Value: any }>(buildingInfoSheet);
                    const buildingData: {[key: string]: any} = {};
                    buildingInfo.forEach(row => {
                         if (row.Key === 'Building Name') buildingData['Building_name'] = row.Value;
                         if (row.Key === 'Address') buildingData['address'] = row.Value;
                         if (row.Key === 'Has Basement') buildingData['hasBasement'] = row.Value?.startsWith('Yes');
                         if (row.Key === 'Has Mezzanine') buildingData['hasMezzanine'] = row.Value?.startsWith('Yes');
                         if (row.Key === 'Has Penthouse') buildingData['hasPenthouse'] = row.Value?.startsWith('Yes');
                         if (row.Key === 'Has Rooftop') buildingData['hasRooftop'] = row.Value?.startsWith('Yes');
                         if (row.Value?.includes('level/s')) {
                            const count = parseInt(row.Value.match(/\((\d+)/)?.[1] || '1', 10);
                            if (row.Key === 'Has Basement') buildingData['basementCount'] = count;
                            if (row.Key === 'Has Mezzanine') buildingData['mezzanineCount'] = count;
                         }
                    });

                    data = {
                        ...buildingData,
                        levels: levelsSheet ? XLSX.utils.sheet_to_json(levelsSheet) : [],
                        units: unitsSheet ? XLSX.utils.sheet_to_json(unitsSheet) : []
                    }
                    format = 'xlsx';

                } else {
                    throw new Error("Unsupported file type. Please upload a .json or .xlsx file.");
                }
                
                setPreviewData({ format, data });
                setIsPreviewOpen(true);

            } catch (error: any) {
                console.error("File parse error:", error);
                toast({ variant: 'destructive', title: 'Parse Failed', description: `Could not read the file. Error: ${error.message}` });
            } finally {
                setIsImporting(false);
            }
        };

        if (file.name.endsWith('.json')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }


        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleConfirmImport = async (importSessionData: ImportData) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to import.'});
            return;
        }

        setIsImporting(true);
        try {
            const importedData = importSessionData.data;

            if (!importedData) {
                 throw new Error("Imported file appears to be empty or corrupted.");
            }
            if (!importedData.Building_name) {
                throw new Error("Could not find 'Building_name' in the imported file.");
            }
            
            // --- Data processing and Firestore writing ---
            const { levels, units, id, ownerId, createdAt, ...buildingCore } = importedData;
            
            let finalBuildingName = buildingCore.Building_name;
            const existingNames = new Set((existingBuildings || []).map(b => b.Building_name || (b as any).name));
            if (existingNames.has(finalBuildingName)) {
                const date = new Date().toISOString().split('T')[0];
                finalBuildingName = `${finalBuildingName} (Imported ${date})`;
            }

            const newBuildingDocData = {
                ...buildingCore,
                Building_name: finalBuildingName,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
            };

            const newBuildingRef = await addDoc(collection(firestore, 'buildings'), newBuildingDocData);
            const newBuildingId = newBuildingRef.id;
            
            toast({ title: 'Import Successful', description: `Building "${finalBuildingName}" shell created.` });

            // Now, import levels and units if they exist
            if ((levels && levels.length > 0) || (units && units.length > 0)) {
                const batch = writeBatch(firestore);
                const levelIdMap = new Map<string, string>(); // Maps old level name to new level ID

                if (levels && levels.length > 0) {
                    for (const level of levels) {
                        const { id: oldLevelId, ...levelData } = level;
                        const newLevelRef = doc(collection(firestore, 'buildings', newBuildingId, 'levels'));
                        batch.set(newLevelRef, { ...levelData, createdAt: serverTimestamp() });
                        
                        // Use level name as the key, as it's the most stable identifier we have during import
                        if (level.name) {
                            levelIdMap.set(level.name, newLevelRef.id);
                        }
                    }
                }
                
                await batch.commit(); // Commit levels first to get their IDs

                // Now commit units in a new batch
                if (units && units.length > 0 && levelIdMap.size > 0) {
                    const unitBatch = writeBatch(firestore);
                    const levelsMapByName = new Map(levels.map((l: any) => [l['Level Name'] || l.name, l]));
                    
                    for (const unit of units) {
                        const { id: oldUnitId, ...unitData } = unit;
                        const levelName = importSessionData.format === 'xlsx' ? (unit as any)['Level'] : levelsMapByName.get((unit as any).levelId)?.name;
                        const newLevelId = levelIdMap.get(levelName);
                        
                        if (newLevelId) {
                            const newUnitRef = doc(collection(firestore, 'buildings', newBuildingId, 'units'));
                            unitBatch.set(newUnitRef, {
                                ...unitData,
                                levelId: newLevelId,
                                createdAt: serverTimestamp(),
                            });
                        }
                    }
                    await unitBatch.commit();
                }

                toast({ title: 'Full Import Complete', description: `Levels and units for "${finalBuildingName}" have been imported.`});
            }

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
