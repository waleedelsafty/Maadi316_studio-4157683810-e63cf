
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import type { Building, Level, Unit, Owner } from '@/types';
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
                    const buildingInfoSheet = workbook.Sheets['Building Info'];
                    const ownersSheet = workbook.Sheets['Owners'];
                    const levelsSheet = workbook.Sheets['Levels'];
                    const unitsSheet = workbook.Sheets['Units'];

                    if (!buildingInfoSheet) {
                         throw new Error("Could not find the 'Building Info' sheet in the Excel file.");
                    }

                    const buildingInfo = XLSX.utils.sheet_to_json(buildingInfoSheet) as Array<{ Key: string; Value: any }>;
                    const buildingData: {[key: string]: any} = {};
                    buildingInfo.forEach(row => {
                         if (row.Key === 'Building Name') buildingData['name'] = row.Value;
                         else if (row.Key === 'Address') buildingData['address'] = row.Value;
                         else if (row.Key === 'Has Basement') buildingData['hasBasement'] = row.Value?.startsWith('Yes');
                         else if (row.Key === 'Has Mezzanine') buildingData['hasMezzanine'] = row.Value?.startsWith('Yes');
                         else if (row.Key === 'Has Penthouse') buildingData['hasPenthouse'] = row.Value === 'Yes';
                         else if (row.Key === 'Has Rooftop') buildingData['hasRooftop'] = row.Value === 'Yes';
                         
                         if (row.Value?.toString().includes('level/s')) {
                            const count = parseInt(row.Value.toString().match(/\((\d+)/)?.[1] || '1', 10);
                            if (row.Key === 'Has Basement') buildingData['basementCount'] = count;
                            if (row.Key === 'Has Mezzanine') buildingData['mezzanineCount'] = count;
                         }
                    });
                    
                    const excelOwners = ownersSheet ? XLSX.utils.sheet_to_json(ownersSheet) : [];
                    const excelLevels = levelsSheet ? XLSX.utils.sheet_to_json(levelsSheet) : [];
                    const excelUnits = unitsSheet ? XLSX.utils.sheet_to_json(unitsSheet) : [];


                    data = {
                        ...buildingData,
                        owners: excelOwners.map((o: any) => ({
                            id: o['ID'],
                            name: o['Name'],
                            email: o['Email'],
                            phoneNumber: o['Phone'],
                            contactPerson: o['Contact Person'],
                        })),
                        levels: excelLevels.map((l: any) => {
                            const level: Partial<Level> & { id?: string } = {
                                id: l['ID'],
                                name: l['Level Name'],
                                levelType: l['Type'],
                            };
                            if (l['Type'] === 'Typical Floor' && l['Floor Number'] !== 'N/A' && !isNaN(Number(l['Floor Number']))) {
                                level.floorNumber = Number(l['Floor Number']);
                            }
                            return level;
                        }),
                        units: excelUnits.map((u: any) => ({
                             unitNumber: u['Unit #'],
                             levelName: u['Level'], // Use name for mapping
                             unitType: u['Type'],
                             sqm: u['Size (sqm)'],
                             ownerName: u['Owner'], // Use name for mapping
                             quarterlyMaintenanceFees: u['Quarterly Maintenance'],
                        }))
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
            const importFormat = importSessionData.format;

            if (!importedData) {
                throw new Error("Imported file appears to be empty or corrupted.");
            }

            const { levels: importedLevels, units: importedUnits, owners: importedOwners, id, ownerId, createdAt, floors, units, ...buildingCore } = importedData;
            
            let finalBuildingName = buildingCore.name;

            if (!finalBuildingName) {
                throw new Error("Could not find 'name' in the imported file.");
            }
            
            const existingNames = new Set((existingBuildings || []).map(b => b.name));
            if (existingNames.has(finalBuildingName)) {
                const date = new Date().toISOString().split('T')[0];
                finalBuildingName = `${finalBuildingName} (Imported ${date})`;
            }

            // --- IMPORT BUILDING ---
            const newBuildingDocData = { ...buildingCore, name: finalBuildingName, ownerId: user.uid, createdAt: serverTimestamp() };
            const newBuildingRef = await addDoc(collection(firestore, 'buildings'), newBuildingDocData);
            const newBuildingId = newBuildingRef.id;
            toast({ title: 'Import Step 1/4 Complete', description: `Building "${finalBuildingName}" created.` });

            const oldIdOrNameToNewIdMap = new Map<string, string>();

            // --- IMPORT OWNERS ---
            const originalOwners = importedOwners as any[] || [];
            if (originalOwners.length > 0) {
                const ownerBatch = writeBatch(firestore);
                originalOwners.forEach(owner => {
                    const { id: oldOwnerId, ...ownerData } = owner;
                    const newOwnerRef = doc(collection(firestore, 'buildings', newBuildingId, 'owners'));
                    ownerBatch.set(newOwnerRef, { ...ownerData, createdAt: serverTimestamp() });
                    if (oldOwnerId) oldIdOrNameToNewIdMap.set(oldOwnerId, newOwnerRef.id);
                    if (owner.name) oldIdOrNameToNewIdMap.set(owner.name, newOwnerRef.id);
                });
                await ownerBatch.commit();
                toast({ title: 'Import Step 2/4 Complete', description: `${originalOwners.length} owners imported.` });
            }

            // --- IMPORT LEVELS ---
            const originalLevels = importedLevels as any[] || [];
            if (originalLevels.length > 0) {
                const levelBatch = writeBatch(firestore);
                originalLevels.forEach(level => {
                    const { id: oldLevelId, ...levelData } = level;
                    const newLevelRef = doc(collection(firestore, 'buildings', newBuildingId, 'levels'));
                    levelBatch.set(newLevelRef, { ...levelData, createdAt: serverTimestamp() });
                    if (oldLevelId) oldIdOrNameToNewIdMap.set(oldLevelId, newLevelRef.id);
                    if (level.name) oldIdOrNameToNewIdMap.set(level.name, newLevelRef.id);
                });
                await levelBatch.commit();
                toast({ title: 'Import Step 3/4 Complete', description: `${originalLevels.length} levels imported.` });
            }

            // --- IMPORT UNITS ---
            const originalUnits = importedUnits as any[] || [];
            if (originalUnits.length > 0) {
                 const unitBatch = writeBatch(firestore);
                 originalUnits.forEach(unit => {
                     const { id: oldUnitId, levelId: oldLevelId, ownerId: oldOwnerId, levelName, ownerName, ...unitData } = unit;
                     
                     let newLevelId: string | undefined;
                     let newOwnerId: string | undefined;

                     if (importFormat === 'json') {
                         newLevelId = oldIdOrNameToNewIdMap.get(oldLevelId);
                         newOwnerId = oldIdOrNameToNewIdMap.get(oldOwnerId);
                     } else if (importFormat === 'xlsx') {
                         newLevelId = oldIdOrNameToNewIdMap.get(levelName);
                         newOwnerId = oldIdOrNameToNewIdMap.get(ownerName);
                     }

                     if (newLevelId && newOwnerId) {
                         const newUnitRef = doc(collection(firestore, 'buildings', newBuildingId, 'units'));
                         unitBatch.set(newUnitRef, { ...unitData, levelId: newLevelId, ownerId: newOwnerId, createdAt: serverTimestamp() });
                     }
                 });

                 await unitBatch.commit();
                 toast({ title: 'Import Step 4/4 Complete', description: `${originalUnits.length} units imported successfully.` });
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
