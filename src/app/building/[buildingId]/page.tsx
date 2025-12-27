

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, updateDoc, deleteDoc, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Building, Level, Unit, Payment } from '@/types';
import { ArrowLeft, ArrowUp, ArrowDown, Edit, Download, ChevronDown, ChevronsUpDown, Trash2, DollarSign, Search, CalendarIcon, Check, X } from 'lucide-react';
import Link from 'next/link';
import { InlineEditField } from '@/components/inline-edit-field';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useLocalStorage from '@/hooks/use-local-storage';
import { defaultColumnVisibility, type UnitColumnVisibility } from '@/app/settings/display/page';
import { getQuartersForRange, formatQuarter, getCurrentQuarter } from '@/lib/calculations';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';


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
type UnitSortKey = 'unitNumber' | 'type' | 'levelId' | 'ownerName' | 'balance';
type SortDirection = 'asc' | 'desc';
type QuarterRangeOption = 'current_quarter' | 'year_to_date' | 'all_since_start';

const paymentTypes: Payment['paymentType'][] = ['Cash', 'Bank Transfer', 'Instapay Transfer'];

const generateQuarterOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear + 1; year >= currentYear - 5; year--) {
        for (let q = 4; q >= 1; q--) {
            options.push(`Q${q} ${year}`);
        }
    }
    return options;
};
const quarterOptions = generateQuarterOptions();

const paymentFormSchema = z.object({
  unitId: z.string().min(1, "Please select a unit."),
  quarter: z.string().min(1, 'Quarter is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.date({ required_error: 'Payment date is required' }),
  paymentType: z.enum(paymentTypes),
  receiptUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});


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

    // State for Sorting and Filtering
    const [sortKey, setSortKey] = useState<SortKey>('type');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [unitSortKey, setUnitSortKey] = useState<UnitSortKey>('balance');
    const [unitSortDirection, setUnitSortDirection] = useState<SortDirection>('asc');
    const [unitSearchQuery, setUnitSearchQuery] = useState('');
    const [columnVisibility] = useLocalStorage<UnitColumnVisibility>('unit-column-visibility', defaultColumnVisibility);
    const [quarterRange, setQuarterRange] = useState<QuarterRangeOption>('all_since_start');
    const [paymentFilter, setPaymentFilter] = useState({ query: '', quarter: '' });

    // State for common UI
    const [validationError, setValidationError] = useState<{ title: string, description: string} | null>(null);
    const [isAddingPayment, setIsAddingPayment] = useState(false);

    // State for payment combobox
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState("");
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    
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
    
    const levelsMap = useMemo(() => {
        if (!levels) return new Map();
        return new Map(levels.map(l => [l.id, l.name]));
    }, [levels]);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection(unitsQuery);

    const unitsMap = useMemo(() => {
        if (!units) return new Map();
        return new Map(units.map(u => [u.id, u]));
    }, [units]);

    const paymentsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'payments'));
    }, [firestore, buildingId]);
    const { data: payments } = useCollection(paymentsQuery);

    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        return payments.filter(p => {
            const unit = unitsMap.get(p.unitId);
            const queryLower = paymentFilter.query.toLowerCase();
            const quarterMatch = !paymentFilter.quarter || p.quarter === paymentFilter.quarter;
            const textMatch = !queryLower || 
                p.notes?.toLowerCase().includes(queryLower) ||
                unit?.unitNumber.toLowerCase().includes(queryLower) ||
                unit?.ownerName.toLowerCase().includes(queryLower);
            return quarterMatch && textMatch;
        });
    }, [payments, unitsMap, paymentFilter]);


    const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: {
            unitId: '',
            quarter: quarterOptions[0],
            paymentType: 'Cash',
            notes: '',
            receiptUrl: '',
        }
    });

    const comboboxFilteredUnits = useMemo(() => {
        if (!units) return [];
        if (!comboboxSearch) return units;
        const lowerQuery = comboboxSearch.toLowerCase();
        return units.filter(u => 
            String(u.unitNumber).toLowerCase().includes(lowerQuery) || 
            String(u.ownerName).toLowerCase().includes(lowerQuery)
        );
    }, [units, comboboxSearch]);

    useEffect(() => {
        if (selectedUnit) {
            paymentForm.setValue('unitId', selectedUnit.id);
            paymentForm.setValue('amount', selectedUnit.quarterlyMaintenanceFees);
        } else {
             paymentForm.resetField('unitId');
             paymentForm.resetField('amount');
        }
    }, [selectedUnit, paymentForm]);


    const handleAddPayment = async (data: z.infer<typeof paymentFormSchema>) => {
        if (!firestore || !buildingId) return;

        const paymentCollectionRef = collection(firestore, 'buildings', buildingId, 'payments');
        const newPaymentData = {
            ...data,
            paymentDate: Timestamp.fromDate(data.paymentDate),
            createdAt: serverTimestamp(),
        };

        addDoc(paymentCollectionRef, newPaymentData)
          .then(() => {
            toast({
              title: 'Payment Recorded',
              description: `Payment for ${data.quarter} has been successfully recorded.`,
            });
            paymentForm.reset();
            setIsAddingPayment(false);
            setSelectedUnit(null);
            setComboboxSearch("");
          })
          .catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: paymentCollectionRef.path,
                operation: 'create',
                requestResourceData: newPaymentData,
            }));
          });
    };


    const financialDataByUnit = useMemo(() => {
        const results = new Map<string, { totalDue: number; totalPaid: number; balance: number }>();
        if (!units || !building || !building.financialStartDate) return results;

        const financialStartDate = building.financialStartDate?.toDate();
        if (!financialStartDate) return results;

        const quarterStringsInRange = getQuartersForRange(financialStartDate, quarterRange);

        units.forEach(unit => {
            const totalDue = (unit.quarterlyMaintenanceFees || 0) * quarterStringsInRange.length;
            
            const totalPaid = (payments || [])
                .filter(p => p.unitId === unit.id && quarterStringsInRange.includes(p.quarter))
                .reduce((sum, p) => sum + p.amount, 0);

            const balance = totalPaid - totalDue;
            
            results.set(unit.id, { totalDue, totalPaid, balance });
        });

        return results;

    }, [units, payments, building, quarterRange]);


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

    const sortedAndFilteredUnits = useMemo(() => {
        if (!units) return [];
    
        const filteredUnits = units.filter(unit => {
            if (!unitSearchQuery) return true;
            const query = unitSearchQuery.toLowerCase();
            const unitNumber = String(unit.unitNumber || '').toLowerCase();
            const ownerName = String(unit.ownerName || '').toLowerCase();
            return unitNumber.includes(query) || ownerName.includes(query);
        });

        return [...filteredUnits].sort((a, b) => {
            const dir = unitSortDirection === 'asc' ? 1 : -1;
            
            switch (unitSortKey) {
                case 'unitNumber':
                    return String(a.unitNumber || '').localeCompare(String(b.unitNumber || ''), undefined, { numeric: true }) * dir;
                case 'type':
                    return (a.type || '').localeCompare(b.type || '') * dir;
                case 'ownerName':
                    return (a.ownerName || '').localeCompare(b.ownerName || '') * dir;
                case 'levelId':
                    const levelNameA = levelsMap.get(a.levelId) || '';
                    const levelNameB = levelsMap.get(b.levelId) || '';
                    return levelNameA.localeCompare(levelNameB) * dir;
                case 'balance':
                    const balanceA = financialDataByUnit.get(a.id)?.balance || 0;
                    const balanceB = financialDataByUnit.get(b.id)?.balance || 0;
                    return (balanceA - balanceB) * dir;
                default:
                    return 0;
            }
        });
    }, [units, unitSortKey, unitSortDirection, levelsMap, unitSearchQuery, financialDataByUnit]);

    const unitTableColSpan = useMemo(() => {
        return (
            5 + // Unit #, Due, Paid, Balance, Actions are always visible
            (columnVisibility.type ? 1 : 0) +
            (columnVisibility.level ? 1 : 0) +
            (columnVisibility.owner ? 1 : 0)
        );
    }, [columnVisibility]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleUnitSort = (key: UnitSortKey) => {
        if (unitSortKey === key) {
            setUnitSortDirection(unitSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setUnitSortKey(key);
            setUnitSortDirection('asc');
        }
    };

    const renderSortIcon = (key: SortKey | UnitSortKey, forUnits: boolean = false) => {
        const currentKey = forUnits ? unitSortKey : sortKey;
        const currentDirection = forUnits ? unitSortDirection : sortDirection;

        if (currentKey !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return currentDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

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
    
    const handleDelete = (collectionName: 'levels' | 'units', id: string) => {
        if (!firestore || !buildingId) return;
        const itemRef = doc(firestore, 'buildings', buildingId, collectionName, id);
        const itemName = collectionName === 'levels' ? 'Level' : 'Unit';

        deleteDoc(itemRef).then(() => {
            toast({ title: `${itemName} Deleted`, description: `The ${itemName.toLowerCase()} has been successfully removed.` })
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: itemRef.path, operation: 'delete' }));
        })
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

    const currentQuarter = getCurrentQuarter();

    return (
        <main className="w-full space-y-4">
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
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/building/${buildingId}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Building
                                </Link>
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

            <Tabs defaultValue="levels">
                <div className="flex justify-between items-end">
                    <TabsList>
                        <TabsTrigger value="levels">Levels</TabsTrigger>
                        <TabsTrigger value="units">All Units</TabsTrigger>
                        <TabsTrigger value="payments">Payments</TabsTrigger>
                    </TabsList>
                    <div className="pb-2">
                        {!isAddingLevel && <Button onClick={() => setIsAddingLevel(true)}>Add New Level</Button>}
                    </div>
                </div>
                <TabsContent value="levels">
                    <Card>
                        <CardHeader>
                            <CardTitle>Building Levels</CardTitle>
                            <CardDescription>Define the structure of your building by adding and managing its levels.</CardDescription>
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
                                                    <LevelRow key={level.id} level={level} buildingId={buildingId} onDelete={(id) => handleDelete('levels', id)} unitCount={unitCountsByLevel.get(level.id) || 0} />
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : ( <div className="text-center py-12 rounded-lg border border-dashed"><p className="text-muted-foreground">No levels have been added yet.</p></div> )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="units">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>All Units</CardTitle>
                                    <CardDescription>A complete list of every unit in "{buildingName}".</CardDescription>
                                </div>
                                <div className="relative w-full max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by unit # or owner name..."
                                        className="pl-8"
                                        value={unitSearchQuery}
                                        onChange={(e) => setUnitSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pt-4">
                                <span className="text-sm font-medium">Current Quarter: <span className="font-semibold">{formatQuarter(currentQuarter)}</span></span>
                                <Select onValueChange={(value) => setQuarterRange(value as QuarterRangeOption)} value={quarterRange}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select Range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="current_quarter">Current Quarter</SelectItem>
                                        <SelectItem value="year_to_date">Year to Date</SelectItem>
                                        <SelectItem value="all_since_start">All (Since Start)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleUnitSort('unitNumber')} className="px-0">
                                                    Unit #
                                                    {renderSortIcon('unitNumber', true)}
                                                </Button>
                                            </TableHead>
                                            {columnVisibility.type && (
                                                <TableHead>
                                                    <Button variant="ghost" onClick={() => handleUnitSort('type')} className="px-0">
                                                        Type
                                                        {renderSortIcon('type', true)}
                                                    </Button>
                                                </TableHead>
                                            )}
                                            {columnVisibility.level && (
                                                <TableHead>
                                                    <Button variant="ghost" onClick={() => handleUnitSort('levelId')} className="px-0">
                                                        Level
                                                        {renderSortIcon('levelId', true)}
                                                    </Button>
                                                </TableHead>
                                            )}
                                            {columnVisibility.owner && (
                                                <TableHead>
                                                    <Button variant="ghost" onClick={() => handleUnitSort('ownerName')} className="px-0">
                                                        Owner
                                                        {renderSortIcon('ownerName', true)}
                                                    </Button>
                                                </TableHead>
                                            )}
                                            <TableHead>Total Due</TableHead>
                                            <TableHead>Total Paid</TableHead>
                                            <TableHead>
                                                 <Button variant="ghost" onClick={() => handleUnitSort('balance')} className="px-0">
                                                    Balance
                                                    {renderSortIcon('balance', true)}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedAndFilteredUnits && sortedAndFilteredUnits.length > 0 ? sortedAndFilteredUnits.map((unit) => {
                                            const financials = financialDataByUnit.get(unit.id) || { totalDue: 0, totalPaid: 0, balance: 0 };
                                            return (
                                                <TableRow key={unit.id}>
                                                    <TableCell className="font-semibold">{unit.unitNumber}</TableCell>
                                                    {columnVisibility.type && <TableCell>{unit.type}</TableCell>}
                                                    {columnVisibility.level && <TableCell>{levelsMap.get(unit.levelId) || 'N/A'}</TableCell>}
                                                    {columnVisibility.owner && <TableCell>{unit.ownerName}</TableCell>}
                                                     <TableCell>
                                                        {financials.totalDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {financials.totalPaid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                                    </TableCell>
                                                    <TableCell className={financials.balance < 0 ? 'text-destructive' : ''}>
                                                        {financials.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/building/${buildingId}/unit/${unit.id}/payments`}>
                                                                    <DollarSign className="mr-2 h-4 w-4" /> Payments
                                                                </Link>
                                                            </Button>
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/building/${buildingId}/unit/${unit.id}/edit`}>Edit</Link>
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete unit "{unit.unitNumber}".</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete('units', unit.id)}>Continue</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={unitTableColSpan} className="text-center h-24">
                                                    {unitSearchQuery ? `No units found for "${unitSearchQuery}".` : (building?.financialStartDate ? "No units found in this building." : "Set a Financial Start Date for the building to see unit balances.")}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="payments">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Payments</CardTitle>
                                    <CardDescription>Record and view all payments for this building.</CardDescription>
                                </div>
                                {!isAddingPayment && <Button onClick={() => setIsAddingPayment(true)}>Record New Payment</Button>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             {isAddingPayment && (
                                <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-6 p-4 border rounded-lg bg-muted/50">
                                    <h3 className="font-medium">Record a New Payment</h3>
                                    
                                    <div>
                                        <Label>Unit</Label>
                                        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full justify-between">
                                                    {selectedUnit ? `Unit ${selectedUnit.unitNumber} (${selectedUnit.ownerName})` : "Select unit..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <div className="p-2">
                                                     <Input
                                                        placeholder="Search by unit or owner..."
                                                        value={comboboxSearch}
                                                        onChange={(e) => setComboboxSearch(e.target.value)}
                                                    />
                                                </div>
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    {comboboxFilteredUnits.length > 0 ? comboboxFilteredUnits.map(unit => (
                                                        <div key={unit.id} onClick={() => {
                                                            setSelectedUnit(unit);
                                                            setIsComboboxOpen(false);
                                                        }} className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center">
                                                            <span>Unit {unit.unitNumber} ({unit.ownerName})</span>
                                                            {selectedUnit?.id === unit.id && <Check className="h-4 w-4" />}
                                                        </div>
                                                    )) : (
                                                        <p className="p-2 text-center text-sm text-muted-foreground">No units found.</p>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        {paymentForm.formState.errors.unitId && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.unitId.message}</p>}
                                        
                                        {selectedUnit && (
                                            <div className="mt-2 text-xs text-muted-foreground border rounded-lg p-2 bg-background">
                                                <p><b>Owner:</b> {selectedUnit.ownerName}</p>
                                                <p><b>Size:</b> {selectedUnit.sqm} sqm</p>
                                                <p><b>Quarterly Fee:</b> {selectedUnit.quarterlyMaintenanceFees.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Quarter</Label>
                                            <Controller
                                                name="quarter"
                                                control={paymentForm.control}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            {paymentForm.formState.errors.quarter && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.quarter.message}</p>}
                                        </div>
                                        <div>
                                            <Label>Amount Paid</Label>
                                            <Input type="number" step="0.01" {...paymentForm.register('amount')} />
                                            {paymentForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>}
                                        </div>
                                         <div>
                                            <Label>Payment Date</Label>
                                             <Controller
                                                name="paymentDate"
                                                control={paymentForm.control}
                                                render={({ field }) => (
                                                   <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            />
                                            {paymentForm.formState.errors.paymentDate && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentDate.message}</p>}
                                        </div>
                                         <div>
                                            <Label>Payment Type</Label>
                                             <Controller
                                                name="paymentType"
                                                control={paymentForm.control}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                            {paymentForm.formState.errors.paymentType && <p className="text-red-500 text-xs mt-1">{paymentForm.formState.errors.paymentType.message}</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Textarea placeholder="e.g., Paid in two installments." {...paymentForm.register('notes')} />
                                    </div>

                                     <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => {
                                            setIsAddingPayment(false);
                                            setSelectedUnit(null);
                                            setComboboxSearch("");
                                            paymentForm.reset();
                                        }}>Cancel</Button>
                                        <Button type="submit" disabled={paymentForm.formState.isSubmitting}>
                                            {paymentForm.formState.isSubmitting ? 'Recording...' : 'Record Payment'}
                                        </Button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-medium">Payment History</h3>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Filter by unit #, owner, notes..."
                                            className="w-64"
                                            value={paymentFilter.query}
                                            onChange={(e) => setPaymentFilter(prev => ({ ...prev, query: e.target.value }))}
                                        />
                                        <Select
                                            value={paymentFilter.quarter}
                                            onValueChange={(value) => setPaymentFilter(prev => ({ ...prev, quarter: value === 'all' ? '' : value }))}
                                        >
                                            <SelectTrigger className="w-48">
                                                <SelectValue placeholder="Filter by quarter..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Quarters</SelectItem>
                                                {quarterOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Owner</TableHead>
                                                <TableHead>Quarter</TableHead>
                                                <TableHead>Date Paid</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Notes</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPayments.length > 0 ? filteredPayments
                                                .sort((a,b) => b.paymentDate.toMillis() - a.paymentDate.toMillis())
                                                .map((payment) => {
                                                    const unit = unitsMap.get(payment.unitId);
                                                    return (
                                                        <TableRow key={payment.id}>
                                                            <TableCell className="font-semibold">{unit?.unitNumber || 'N/A'}</TableCell>
                                                            <TableCell>{unit?.ownerName || 'N/A'}</TableCell>
                                                            <TableCell>{payment.quarter}</TableCell>
                                                            <TableCell>{format(payment.paymentDate.toDate(), 'PPP')}</TableCell>
                                                            <TableCell>{payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                                                            <TableCell>{payment.paymentType}</TableCell>
                                                            <TableCell className="max-w-xs truncate">{payment.notes || '—'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" disabled>
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                }) : (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="h-24 text-center">
                                                            {paymentFilter.query || paymentFilter.quarter ? "No payments match your filter." : "No payments recorded yet."}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            }
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

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
