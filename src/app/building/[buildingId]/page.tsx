
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, query, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Owner, GlobalUnitType } from '@/types';
import { ArrowLeft, Edit, Download, ChevronDown, Trash2, ToyBrick, Landmark, Users, Wrench, Box } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';


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

export default function BuildingDashboardPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    const [validationError, setValidationError] = useState<{ title: string, description: string} | null>(null);
    
    const buildingRef = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return doc(firestore, 'buildings', buildingId);
    }, [firestore, buildingId]);

    const { data: building } = useDoc<Building>(buildingRef);

    const levelsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'levels'));
    }, [firestore, buildingId]);

    const { data: levels } = useCollection<Level>(levelsQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection(unitsQuery);

    const ownersQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'owners'));
    }, [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);
    
    const globalUnitTypesQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'globalUnitTypes'));
    }, [firestore]);
    const { data: globalUnitTypes } = useCollection<GlobalUnitType>(globalUnitTypesQuery);


    const handleUpdateBuilding = async (field: keyof Building, value: any) => {
        if (!buildingRef) return;

        let updateData: { [key: string]: any } = { [field]: value };
        
        if (field === 'name') {
            updateData = { name: value };
        }

        if (field === 'hasBasement' && value === true && !building?.basementCount) {
             updateData.basementCount = 1;
        }
        if (field === 'hasMezzanine' && value === true && !building?.mezzanineCount) {
            updateData.mezzanineCount = 1;
        }

        setDoc(buildingRef, updateData, { merge: true }).then(() => {
             toast({ title: 'Building Updated', description: `The building has been updated.` });
        }).catch((serverError) => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: buildingRef.path, operation: 'update', requestResourceData: updateData,
            }));
        });
    };

    const handleStructureChange = (field: 'hasBasement' | 'hasMezzanine' | 'hasPenthouse' | 'hasRooftop', checked: boolean) => {
        if (checked) {
            handleUpdateBuilding(field, true);
            return;
        }

        const levelTypeMap = {
            hasBasement: 'Basement', hasMezzanine: 'Mezzanine', hasPenthouse: 'Penthouse', hasRooftop: 'Rooftop',
        };
        const typeToCheck = levelTypeMap[field] as Level['levelType'];
        const existingLevelsOfType = levels?.filter(level => level.levelType === typeToCheck) || [];

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
        if (!building || !levels || !units || !owners) {
            toast({ variant: 'destructive', title: 'Could not export', description: 'Data is not fully loaded yet.' });
            return false;
        }
        return true;
    }

    const handleExportExcel = () => {
        if (!checkDataForExport() || !building) return;

        const buildingName = building.name;
        if (!buildingName) {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Building name is missing.' });
            return;
        }

        const buildingInfoData = [
            { Key: 'Building Name', Value: buildingName }, { Key: 'Address', Value: building.address },
            { Key: 'Has Basement', Value: building.hasBasement ? `Yes (${building.basementCount || 1} level/s)`: 'No' },
            { Key: 'Has Mezzanine', Value: building.hasMezzanine ? `Yes (${building.mezzanineCount || 1} level/s)`: 'No' },
            { Key: 'Has Penthouse', Value: building.hasPenthouse ? 'Yes' : 'No' },
            { Key: 'Has Rooftop', Value: building.hasRooftop ? 'Yes' : 'No' },
        ];

        const ownersData = (owners || []).map(owner => ({
            'ID': owner.id,
            'Name': owner.name,
            'Email': owner.email,
            'Phone': owner.phoneNumber,
            'Contact Person': owner.contactPerson,
        }));

        const levelsData = (levels || []).map(level => ({
            'ID': level.id,
            'Level Name': level.name,
            'Type': level.levelType,
            'Floor Number': level.levelType === 'Typical Floor' ? level.floorNumber : 'N/A',
        }));

        const levelsMap = new Map((levels || []).map(l => [l.id, l.name]));
        const ownersMap = new Map((owners || []).map(o => [o.id, o.name]));
        const unitsData = (units || []).map(unit => ({
            'Unit #': unit.unitNumber,
            'Level': levelsMap.get(unit.levelId) || 'Unknown',
            'UnitType': unit.unitTypeId,
            'Size (sqm)': unit.sqm,
            'Owner': ownersMap.get(unit.ownerId) || 'Unknown',
            'Quarterly Maintenance': unit.quarterlyMaintenanceFees,
        }));
        
        const wb = XLSX.utils.book_new();
        const wsBuilding = XLSX.utils.json_to_sheet(buildingInfoData);
        const wsOwners = XLSX.utils.json_to_sheet(ownersData);
        const wsLevels = XLSX.utils.json_to_sheet(levelsData);
        const wsUnits = XLSX.utils.json_to_sheet(unitsData);

        XLSX.utils.book_append_sheet(wb, wsBuilding, "Building Info");
        XLSX.utils.book_append_sheet(wb, wsOwners, "Owners");
        XLSX.utils.book_append_sheet(wb, wsLevels, "Levels");
        XLSX.utils.book_append_sheet(wb, wsUnits, "Units");

        const fileName = `${buildingName.replace(/\s+/g, '_')}_Export.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast({ title: 'Export Complete', description: `Building data saved to ${fileName}.` });
    };
    
    const handleExportJson = () => {
        if (!checkDataForExport() || !building) return;
        const buildingName = building.name;
        if (!buildingName) {
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Building name is missing.' });
            return;
        }

        const exportData = { ...building, name: buildingName, levels: levels, units: units, owners: owners };
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const fileName = `${buildingName.replace(/\s+/g, '_')}_Export.json`;
        saveAs(blob, fileName);
        toast({ title: 'Export Complete', description: `Building data saved to ${fileName}.` });
    }

    const handleSoftDelete = async () => {
        if (!buildingRef) return;
        await setDoc(buildingRef, { isDeleted: true }, { merge: true });
        toast({ title: "Building Deleted", description: "The building has been moved to the recycle bin." });
        router.push('/');
    };

    const handleUnitTypeToggle = (typeId: string, checked: boolean) => {
        if (!building) return;
        const currentTypes = building.enabledUnitTypeIds || [];
        const newTypes = checked
            ? [...currentTypes, typeId]
            : currentTypes.filter(id => id !== typeId);
        
        handleUpdateBuilding('enabledUnitTypeIds', newTypes);
    };
    
    const buildingName = building?.name;

    if (building && user && building.ownerId !== user.uid) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Access Denied</p>
                <p>You do not have permission to view this building.</p>
                <Button asChild className="mt-4"><Link href="/">Go to Homepage</Link></Button>
            </div>
        )
    }

    if (building?.isDeleted) {
        return (
            <div className="text-center py-10">
                <p className="text-2xl font-bold">Building Deleted</p>
                <p>This building is in the recycle bin. You can restore it from the settings page.</p>
                 <Button asChild className="mt-4"><Link href="/settings/recycle-bin">Go to Recycle Bin</Link></Button>
            </div>
        )
    }

    return (
        <main className="w-full space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push('/buildings')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to My Buildings
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ToyBrick className="text-primary"/> Structure</CardTitle>
                        <CardDescription>Manage levels and units.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">Define the physical layout of your property, from basement levels to individual apartments or offices.</p>
                    </CardContent>
                    <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/structure`}>Manage Structure</Link></Button></div>
                </Card>
                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="text-primary"/> Owners</CardTitle>
                        <CardDescription>Manage unit owners.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">Keep a central directory of all property owners in this building.</p>
                    </CardContent>
                     <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/owners`}>Manage Owners</Link></Button></div>
                </Card>
                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Box className="text-primary"/> All Units</CardTitle>
                        <CardDescription>View a list of all units.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">Get a bird's-eye view of every unit, and quickly edit details as needed.</p>
                    </CardContent>
                     <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/units`}>Manage All Units</Link></Button></div>
                </Card>
                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Landmark className="text-primary" /> Financials</CardTitle>
                        <CardDescription>Track the financial status.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">View payment histories, record new transactions, and monitor outstanding balances.</p>
                    </CardContent>
                     <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/financials`}>Manage Financials</Link></Button></div>
                </Card>
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="text-primary" /> Employees</CardTitle>
                        <CardDescription>Manage staff and salaries.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">Keep track of all building personnel, their roles, and payment details.</p>
                    </CardContent>
                     <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/employees`}>Manage Employees</Link></Button></div>
                </Card>
                 <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Wrench className="text-primary"/> Service Providers</CardTitle>
                        <CardDescription>Manage vendors and contacts.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground">Maintain a list of preferred vendors for all maintenance needs.</p>
                    </CardContent>
                     <div className="p-4 pt-0"><Button asChild><Link href={`/building/${buildingId}/providers`}>Manage Providers</Link></Button></div>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Building Information</CardTitle>
                            <CardDescription>General details and structure of your building.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={!building || !levels || !units}>
                                        <Download className="mr-2 h-4 w-4" /> Export <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={handleExportExcel}>Export as Excel (.xlsx)</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportJson}>Export as JSON (.json)</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/building/${buildingId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Building</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     {building ? (
                        <>
                           <div className="space-y-2">
                                <InlineEditField label="Building Name" value={buildingName} onSave={(value) => handleUpdateBuilding('name', value)} />
                                <InlineEditField label="Address" value={building.address} onSave={(value) => handleUpdateBuilding('address', value)} />
                                 {building.financialStartDate && (
                                    <div className="flex items-center justify-between min-h-[40px] border-b">
                                        <label className="text-sm font-medium text-muted-foreground w-1/3">Financial Start Date</label>
                                        <div className="w-2/3 text-right"><p className="text-sm font-semibold">{format(building.financialStartDate.toDate(), 'PPP')}</p></div>
                                    </div>
                                )}
                           </div>
                            <Separator className="my-4" />
                            <div className="space-y-2">
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
                            <Separator className="my-4" />
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm">Available Unit Types</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                                    {globalUnitTypes ? globalUnitTypes.map(type => (
                                        <div key={type.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`type-${type.id}`}
                                                checked={building.enabledUnitTypeIds?.includes(type.id)}
                                                onCheckedChange={(checked) => handleUnitTypeToggle(type.id, Boolean(checked))}
                                            />
                                            <Label htmlFor={`type-${type.id}`} className="font-normal cursor-pointer">{type.name}</Label>
                                        </div>
                                    )) : (
                                        [...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-24" />)
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Skeleton className="h-8 w-1/2 bg-muted rounded animate-pulse" />
                            <Skeleton className="h-8 w-2/3 bg-muted rounded animate-pulse" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                <div className="h-12 bg-muted rounded animate-pulse" /><div className="h-12 bg-muted rounded animate-pulse" />
                                <div className="h-12 bg-muted rounded animate-pulse" /><div className="h-12 bg-muted rounded animate-pulse" />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!validationError} onOpenChange={() => setValidationError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{validationError?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{validationError?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogAction onClick={() => setValidationError(null)}>OK</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
