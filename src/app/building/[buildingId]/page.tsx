
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit } from '@/types';
import { ArrowLeft, ArrowUp, ArrowDown, Edit, Download, ChevronDown, ChevronsUpDown, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';
import { BuildingFormSheet } from '@/components/building-form-sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LevelFormSheet } from '@/components/level-form-sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const levelTypes: Level['type'][] = ['Basement', 'Ground', 'Mezzanine', 'Typical Floor', 'Penthouse', 'Rooftop'];
const uniqueLevelTypes: Level['type'][] = ['Ground', 'Penthouse', 'Rooftop'];

const levelTypeOrder: Record<Level['type'], number> = {
    'Rooftop': 6,
    'Penthouse': 5,
    'Typical Floor': 4,
    'Mezzanine': 3,
    'Ground': 2,
    'Basement': 1,
};


function LevelRow({ level, buildingId, onDelete, unitCount }: { level: Level; buildingId: string; onDelete: (levelId: string) => void; unitCount: number | null }) {
    return (
        <TableRow>
            <TableCell className="font-semibold">{level.name}</TableCell>
            <TableCell>{level.type}{level.type === 'Typical Floor' && ` - Floor ${level.floorNumber}`}</TableCell>
            <TableCell className="text-center">
                {unitCount !== null ? unitCount : <Skeleton className="h-5 w-5 mx-auto" />}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/building/${buildingId}/level/${level.id}`}>Edit</Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete the level "{level.name}". All units on this level will also be deleted.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(level.id)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>
        </TableRow>
    );
}

function SoftDeleteDialog({ onConfirm, buildingName }: { onConfirm: () => void, buildingName: string }) {
    const [inputValue, setInputValue] = useState("");
    const isMatch = inputValue === "delete";

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will move the building "{buildingName}" to the recycle bin. It will not be visible in the main app but can be restored later.
                    <br/><br/>
                    To confirm, please type **delete** in the box below.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder='delete'
            />
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} disabled={!isMatch}>
                    Delete Building
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}


type SortKey = 'name' | 'type' | 'units';
type SortDirection = 'asc' | 'desc';

export default function BuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // State for Levels
    const [isAddingLevel, setIsAddingLevel] = useState(false);
    const [levelName, setLevelName] = useState('');
    const [levelType, setLevelType] = useState<Level['type'] | ''>('');
    const [floorNumber, setFloorNumber] = useState<number | ''>('');
    const [isLevelSheetOpen, setIsLevelSheetOpen] = useState(false);
    const [editingLevel, setEditingLevel] = useState<Level | null>(null);

    // State for Sorting
    const [sortKey, setSortKey] = useState<SortKey>('type');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // State for common UI
    const [isBuildingSheetOpen, setIsBuildingSheetOpen] = useState(false);
    const [validationError, setValidationError] = useState<{ title: string, description: string} | null>(null);
    
    // Firestore Hooks
    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);

    const { data: levels } = useCollection(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection(unitsQuery);

    const unitCountsByLevel = useMemo(() => {
        if (!units) return new Map<string, number>();
        const counts = new Map<string, number>();
        for (const unit of units) {
            counts.set(unit.levelId, (counts.get(unit.levelId) || 0) + 1);
        }
        return counts;
    }, [units]);


    const availableLevelTypes = useMemo(() => {
        if (!levels || !building) return levelTypes;
    
        let filteredTypes = [...levelTypes];
        const existingUniqueTypes = new Set(levels.filter(level => uniqueLevelTypes.includes(level.type)).map(level => level.type));
        filteredTypes = filteredTypes.filter(type => !existingUniqueTypes.has(type));
    
        if (building.hasBasement) {
            const basementCount = levels.filter(level => level.type === 'Basement').length;
            if (basementCount >= (building.basementCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Basement');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Basement');
        }
    
        if (building.hasMezzanine) {
            const mezzanineCount = levels.filter(level => level.type === 'Mezzanine').length;
            if (mezzanineCount >= (building.mezzanineCount || 0)) {
                filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
            }
        } else {
            filteredTypes = filteredTypes.filter(type => type !== 'Mezzanine');
        }

        if (!building.hasPenthouse) {
             filteredTypes = filteredTypes.filter(type => type !== 'Penthouse');
        }

        if (!building.hasRooftop) {
             filteredTypes = filteredTypes.filter(type => type !== 'Rooftop');
        }

        return filteredTypes;
    }, [levels, building]);
    
    const sortedLevels = useMemo(() => {
        if (!levels) return [];
        return [...levels].sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            const aName = a.name || '';
            const bName = b.name || '';

            switch (sortKey) {
                case 'name':
                    return aName.localeCompare(bName) * dir;
                case 'units':
                    const aUnits = unitCountsByLevel.get(a.id) || 0;
                    const bUnits = unitCountsByLevel.get(b.id) || 0;
                    return (aUnits - bUnits) * dir;
                case 'type':
                default:
                    const typeA = levelTypeOrder[a.type];
                    const typeB = levelTypeOrder[b.type];
                    if (typeA !== typeB) return (typeA - typeB) * dir;

                    // Fallback sorting for items with the same type
                    if (a.type === 'Typical Floor') {
                        return ((a.floorNumber || 0) - (b.floorNumber || 0)) * dir;
                    }
                    if (a.type === 'Basement') {
                        return aName.localeCompare(bName) * (dir * -1); // Higher basement numbers first
                    }
                    return aName.localeCompare(bName) * dir;
            }
        });
    }, [levels, sortKey, sortDirection, unitCountsByLevel]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleUpdateBuilding = async (field: keyof Building, value: string | boolean | number) => {
        if (!buildingRef) return;

        let updateData: { [key: string]: any } = { [field]: value };
        
        // When renaming, ensure we use the new field
        if (field === 'Building_name') {
            updateData = { Building_name: value };
        }


        // Auto-set counts when enabling a feature for the first time
        if (field === 'hasBasement' && value === true && !building?.basementCount) {
             updateData.basementCount = 1;
        }
        if (field === 'hasMezzanine' && value === true && !building?.mezzanineCount) {
            updateData.mezzanineCount = 1;
        }

        try {
            await updateDoc(buildingRef, updateData);
            toast({ title: 'Building Updated', description: `The building has been updated.` });
        } catch (serverError) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: buildingRef.path, operation: 'update', requestResourceData: updateData,
            }));
        }
    };

    const handleStructureChange = (field: 'hasBasement' | 'hasMezzanine' | 'hasPenthouse' | 'hasRooftop', checked: boolean) => {
        // If user is enabling the feature, just update it.
        if (checked) {
            handleUpdateBuilding(field, true);
            return;
        }

        // If user is disabling, check for existing levels of that type.
        const levelTypeMap = {
            hasBasement: 'Basement',
            hasMezzanine: 'Mezzanine',
            hasPenthouse: 'Penthouse',
            hasRooftop: 'Rooftop',
        };
        const typeToCheck = levelTypeMap[field] as Level['type'];
        const existingLevelsOfType = levels?.filter(level => level.type === typeToCheck) || [];

        if (existingLevelsOfType.length > 0) {
            setValidationError({
                title: `Cannot Disable "${typeToCheck}"`,
                description: `You must first delete all levels of type "${typeToCheck}" before you can disable this option.`,
            });
        } else {
            // No conflict, proceed with update
            handleUpdateBuilding(field, false);
        }
    };
    
    const handleAddLevel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!levelName.trim() || !levelType || !user || !firestore || !buildingId || !levels) return;
        
        if (levelType === 'Typical Floor') {
            const numFloor = Number(floorNumber);
            if (floorNumber === '' || isNaN(numFloor) || levels.some(level => level.type === 'Typical Floor' && level.floorNumber === numFloor)) {
                toast({ variant: 'destructive', title: 'Invalid Floor Number', description: 'Please provide a unique, valid number for the typical floor.'});
                return;
            }
        }

        const newLevelData: Omit<Level, 'id' | 'createdAt'> & { createdAt: any } = {
            name: levelName, type: levelType, createdAt: serverTimestamp(),
            ...(levelType === 'Typical Floor' && { floorNumber: Number(floorNumber) }),
        };

        const levelsCollectionRef = collection(firestore, 'buildings', buildingId, 'levels');
        
        addDoc(levelsCollectionRef, newLevelData)
            .then(() => {
                setLevelName(''); setLevelType(''); setFloorNumber(''); setIsAddingLevel(false);
                toast({ title: 'Level Added', description: `The level "${levelName}" has been added.` });
            })
            .catch((serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: levelsCollectionRef.path, operation: 'create', requestResourceData: newLevelData,
                }));
            });
    };
    
    const handleDeleteLevel = (levelId: string) => {
        if (!firestore || !buildingId) return;
        const levelRef = doc(firestore, 'buildings', buildingId, 'levels', levelId);
        deleteDoc(levelRef).then(() => {
            toast({ title: "Level Deleted", description: "The level has been successfully removed." })
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: levelRef.path, operation: 'delete' }));
        })
    }
    
    const handleLevelSheetOpenChange = (isOpen: boolean) => {
        setIsLevelSheetOpen(isOpen);
        if (!isOpen) setEditingLevel(null);
    }

    const checkDataForExport = () => {
        if (!building || !levels || !units) {
            toast({ variant: 'destructive', title: 'Could not export', description: 'Data is not fully loaded yet.' });
            return false;
        }
        return true;
    }

    const handleExportExcel = () => {
        if (!checkDataForExport() || !building) return;

        const buildingName = (building as any).Building_name || (building as any).name;
        if (!buildingName) {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Building name is missing.' });
            return;
        }


        // 1. Prepare data for sheets
        const buildingInfoData = [
            { Key: 'Building Name', Value: buildingName },
            { Key: 'Address', Value: building.address },
            { Key: 'Has Basement', Value: building.hasBasement ? `Yes (${building.basementCount || 1} level/s)`: 'No' },
            { Key: 'Has Mezzanine', Value: building.hasMezzanine ? `Yes (${building.mezzanineCount || 1} level/s)`: 'No' },
            { Key: 'Has Penthouse', Value: building.hasPenthouse ? 'Yes' : 'No' },
            { Key: 'Has Rooftop', Value: building.hasRooftop ? 'Yes' : 'No' },
        ];

        const levelsData = sortedLevels.map(level => ({
            'Level Name': level.name,
            'Type': level.type,
            'Floor Number': level.type === 'Typical Floor' ? level.floorNumber : 'N/A',
        }));

        const levelsMap = new Map(levels.map(l => [l.id, l.name]));
        const unitsData = (units || []).map(unit => ({
            'Unit #': unit.unitNumber,
            'Level': levelsMap.get(unit.levelId) || 'Unknown',
            'Type': unit.type,
            'Size (sqm)': unit.sqm,
            'Owner': unit.ownerName,
            'Quarterly Maintenance': unit.quarterlyMaintenanceFees,
        }));
        
        // 2. Create worksheets
        const wb = XLSX.utils.book_new();
        const wsBuilding = XLSX.utils.json_to_sheet(buildingInfoData);
        const wsLevels = XLSX.utils.json_to_sheet(levelsData);
        const wsUnits = XLSX.utils.json_to_sheet(unitsData);

        // 3. Append worksheets to workbook
        XLSX.utils.book_append_sheet(wb, wsBuilding, "Building Info");
        XLSX.utils.book_append_sheet(wb, wsLevels, "Levels");
        XLSX.utils.book_append_sheet(wb, wsUnits, "Units");

        // 4. Write workbook and trigger download
        const fileName = `${buildingName.replace(/\s+/g, '_')}_Export.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast({ title: 'Export Complete', description: `Building data saved to ${fileName}.` });
    };
    
    const handleExportJson = () => {
        if (!checkDataForExport() || !building) return;
        const buildingName = (building as any).Building_name || (building as any).name;
        if (!buildingName) {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Building name is missing.' });
            return;
        }

        const exportData = {
            ...building,
            Building_name: buildingName,
            levels: sortedLevels,
            units: units,
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const fileName = `${buildingName.replace(/\s+/g, '_')}_Export.json`;
        saveAs(blob, fileName);

        toast({ title: 'Export Complete', description: `Building data saved to ${fileName}.` });
    }

    const handleSoftDelete = async () => {
        if (!buildingRef) return;
        await updateDoc(buildingRef, { isDeleted: true });
        toast({
            title: "Building Deleted",
            description: "The building has been moved to the recycle bin."
        });
        router.push('/');
    };
    
    const buildingName = (building as any)?.Building_name || (building as any)?.name;

    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this building.</p>
                <Button asChild className="mt-4">
                    <Link href="/">Go to Homepage</Link>
                </Button>
            </div>
        )
    }

    if (building?.isDeleted) {
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">Building Deleted</p>
                <p>This building is in the recycle bin. You can restore it from the settings page.</p>
                 <Button asChild className="mt-4">
                    <Link href="/settings/recycle-bin">Go to Recycle Bin</Link>
                </Button>
            </div>
        )
    }

    return (
        <main className="w-full max-w-5xl mx-auto space-y-6">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Building Information</CardTitle>
                            <CardDescription>View and manage the general details and structure of your building.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={!building || !levels || !units}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export Data
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={handleExportExcel}>Export as Excel (.xlsx)</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportJson}>Export as JSON (.json)</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" onClick={() => setIsBuildingSheetOpen(true)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Building
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                     {building ? (
                        <>
                           <div className="space-y-2">
                                <InlineEditField label="Building Name" value={buildingName} onSave={(value) => handleUpdateBuilding('Building_name', value)} />
                                <InlineEditField label="Address" value={building.address} onSave={(value) => handleUpdateBuilding('address', value)} />
                           </div>
                            <div className="space-y-2 pt-2">
                                <h4 className="font-medium text-sm">Building Structure</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <Label htmlFor="hasBasement" className="text-sm font-medium text-muted-foreground">Has Basement</Label>
                                        <div className="flex items-center gap-4">
                                            {building.hasBasement && (
                                                <Select value={String(building.basementCount || '1')} onValueChange={(value) => handleUpdateBuilding('basementCount', Number(value))}>
                                                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{[1, 2, 3].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )}
                                            <Switch id="hasBasement" checked={building.hasBasement} onCheckedChange={(checked) => handleStructureChange('hasBasement', checked)} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <Label htmlFor="hasMezzanine" className="text-sm font-medium text-muted-foreground">Has Mezzanine</Label>
                                         <div className="flex items-center gap-4">
                                            {building.hasMezzanine && (
                                                <Select value={String(building.mezzanineCount || '1')} onValueChange={(value) => handleUpdateBuilding('mezzanineCount', Number(value))}>
                                                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{[1, 2, 3, 4].map(num => <SelectItem key={num} value={String(num)}>{num}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )}
                                            <Switch id="hasMezzanine" checked={building.hasMezzanine} onCheckedChange={(checked) => handleStructureChange('hasMezzanine', checked)} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <Label htmlFor="hasPenthouse" className="text-sm font-medium text-muted-foreground">Has Penthouse</Label>
                                        <Switch id="hasPenthouse" checked={building.hasPenthouse} onCheckedChange={(checked) => handleStructureChange('hasPenthouse', checked)} />
                                    </div>
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <Label htmlFor="hasRooftop" className="text-sm font-medium text-muted-foreground">Has Usable Rooftop</Label>
                                        <Switch id="hasRooftop" checked={building.hasRooftop} onCheckedChange={(checked) => handleStructureChange('hasRooftop', checked)} />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="h-8 w-1/2 bg-muted rounded animate-pulse" />
                            <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                <div className="h-12 bg-muted rounded animate-pulse" />
                                <div className="h-12 bg-muted rounded animate-pulse" />
                                <div className="h-12 bg-muted rounded animate-pulse" />
                                <div className="h-12 bg-muted rounded animate-pulse" />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Building Levels</CardTitle>
                            <CardDescription>Define the structure of your building by adding and managing its levels.</CardDescription>
                        </div>
                         {!isAddingLevel && ( <Button onClick={() => setIsAddingLevel(true)}>Add New Level</Button> )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isAddingLevel && (
                        <form onSubmit={handleAddLevel} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Add a New Level</h3>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <Input placeholder="Level Name (e.g., 'Lobby')" value={levelName} onChange={(e) => setLevelName(e.target.value)} required className="sm:col-span-2"/>
                                <Select onValueChange={(value) => setLevelType(value as Level['type'])} value={levelType}>
                                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                    <SelectContent>{availableLevelTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            {levelType === 'Typical Floor' && (
                                <Input type="number" placeholder="Floor Number (e.g., 1, 2, 3...)" value={floorNumber} onChange={(e) => setFloorNumber(Number(e.target.value))} required />
                            )}
                            <div className="flex gap-2">
                                <Button type="submit">Save Level</Button>
                                <Button variant="outline" onClick={() => setIsAddingLevel(false)}>Cancel</Button>
                            </div>
                        </form>
                    )}
                    <div className="space-y-4">
                        {sortedLevels && sortedLevels.length > 0 ? (
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                 <Button variant="ghost" onClick={() => handleSort('name')} className="px-0">
                                                    Level Name
                                                    {renderSortIcon('name')}
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleSort('type')} className="px-0">
                                                    Type
                                                    {renderSortIcon('type')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-center">
                                                <Button variant="ghost" onClick={() => handleSort('units')} className="px-0 mx-auto">
                                                    Units
                                                    {renderSortIcon('units')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedLevels.map((level) => (
                                            <LevelRow key={level.id} level={level} buildingId={buildingId} onDelete={handleDeleteLevel} unitCount={unitCountsByLevel.get(level.id) || 0} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : ( <div className="text-center py-12 rounded-lg border border-dashed"><p className="text-muted-foreground">No levels have been added yet.</p></div> )}
                     </div>
                </CardContent>
            </Card>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>
                        This action is irreversible. Once deleted, the building will be moved to the recycle bin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={!building}>
                                <Trash2 className="mr-2" />
                                Delete Building
                            </Button>
                        </AlertDialogTrigger>
                         {building && <SoftDeleteDialog onConfirm={handleSoftDelete} buildingName={buildingName} />}
                     </AlertDialog>
                </CardContent>
            </Card>


            <BuildingFormSheet building={building} isOpen={isBuildingSheetOpen} onOpenChange={setIsBuildingSheetOpen} />

            {editingLevel && (
                <LevelFormSheet level={editingLevel} buildingId={buildingId} isOpen={isLevelSheetOpen} onOpen-change={handleLevelSheetOpenChange} existingLevels={levels || []} />
            )}

            <AlertDialog open={!!validationError} onOpenChange={() => setValidationError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{validationError?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{validationError?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setValidationError(null)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}

    

    