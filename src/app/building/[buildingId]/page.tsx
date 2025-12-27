

'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit, Payment } from '@/types';
import { ArrowLeft, Edit, Download, ChevronDown, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { BuildingLevelsTab } from '@/components/building-levels-tab';
import { BuildingUnitsTab } from '@/components/building-units-tab';
import { BuildingPaymentsTab } from '@/components/building-payments-tab';


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

export default function BuildingPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // State for common UI
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

    const paymentsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'payments'));
    }, [firestore, buildingId]);
    const { data: payments } = useCollection(paymentsQuery);


    const handleUpdateBuilding = async (field: keyof Building, value: string | boolean | number) => {
        if (!buildingRef) return;

        let updateData: { [key: string]: any } = { [field]: value };
        
        if (field === 'Building_name') {
            updateData = { Building_name: value };
        }

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
        if (checked) {
            handleUpdateBuilding(field, true);
            return;
        }

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
            handleUpdateBuilding(field, false);
        }
    };
        
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

        const buildingInfoData = [
            { Key: 'Building Name', Value: buildingName },
            { Key: 'Address', Value: building.address },
            { Key: 'Has Basement', Value: building.hasBasement ? `Yes (${building.basementCount || 1} level/s)`: 'No' },
            { Key: 'Has Mezzanine', Value: building.hasMezzanine ? `Yes (${building.mezzanineCount || 1} level/s)`: 'No' },
            { Key: 'Has Penthouse', Value: building.hasPenthouse ? 'Yes' : 'No' },
            { Key: 'Has Rooftop', Value: building.hasRooftop ? 'Yes' : 'No' },
        ];

        const levelsData = (levels || []).map(level => ({
            'Level Name': level.name,
            'Type': level.type,
            'Floor Number': level.type === 'Typical Floor' ? level.floorNumber : 'N/A',
        }));

        const levelsMap = new Map((levels || []).map(l => [l.id, l.name]));
        const unitsData = (units || []).map(unit => ({
            'Unit #': unit.unitNumber,
            'Level': levelsMap.get(unit.levelId) || 'Unknown',
            'Type': unit.type,
            'Size (sqm)': unit.sqm,
            'Owner': unit.ownerName,
            'Quarterly Maintenance': unit.quarterlyMaintenanceFees,
        }));
        
        const wb = XLSX.utils.book_new();
        const wsBuilding = XLSX.utils.json_to_sheet(buildingInfoData);
        const wsLevels = XLSX.utils.json_to_sheet(levelsData);
        const wsUnits = XLSX.utils.json_to_sheet(unitsData);

        XLSX.utils.book_append_sheet(wb, wsBuilding, "Building Info");
        XLSX.utils.book_append_sheet(wb, wsLevels, "Levels");
        XLSX.utils.book_append_sheet(wb, wsUnits, "Units");

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
            levels: levels,
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
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
            </div>

            <Card>
                <CardHeader className="p-4">
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
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/building/${buildingId}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Building
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                     {building ? (
                        <>
                           <div className="space-y-2">
                                <InlineEditField label="Building Name" value={buildingName} onSave={(value) => handleUpdateBuilding('Building_name', value)} />
                                <InlineEditField label="Address" value={building.address} onSave={(value) => handleUpdateBuilding('address', value)} />
                                 {building.financialStartDate && (
                                    <div className="flex items-center justify-between min-h-[40px] border-b">
                                        <label className="text-sm font-medium text-muted-foreground w-1/3">Financial Start Date</label>
                                        <div className="w-2/3 text-right">
                                            <p className="text-sm font-semibold">{format(building.financialStartDate.toDate(), 'PPP')}</p>
                                        </div>
                                    </div>
                                )}
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
                            <Skeleton className="h-8 w-1/2 bg-muted rounded animate-pulse" />
                            <Skeleton className="h-8 w-2/3 bg-muted rounded animate-pulse" />
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

            <Tabs defaultValue="levels" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="levels">Levels</TabsTrigger>
                    <TabsTrigger value="units">All Units</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
                
                <TabsContent value="levels">
                   <BuildingLevelsTab building={building} levels={levels} units={units} />
                </TabsContent>
                
                <TabsContent value="units">
                    <BuildingUnitsTab building={building} levels={levels} units={units} payments={payments} />
                </TabsContent>

                <TabsContent value="payments">
                   <BuildingPaymentsTab building={building} units={units} payments={payments} />
                </TabsContent>
            </Tabs>

            <Card className="border-destructive">
                <CardHeader className="p-4">
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>
                        This action is irreversible. Once deleted, the building will be moved to the recycle bin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
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
