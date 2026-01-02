
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Owner, Unit } from '@/types';
import { ArrowLeft, Trash2, Edit, Search, ChevronsUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const OWNERS_PER_PAGE = 10;

export default function OwnersPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // Form State for adding new owners
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [contactPerson, setContactPerson] = useState('');

    // Table State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<'name' | 'units'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);

    // Firestore Hooks
    const ownersQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'owners'));
    }, [firestore, buildingId]);
    const { data: owners } = useCollection<Owner>(ownersQuery);

    const unitsQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'units'));
    }, [firestore, buildingId]);
    const { data: units } = useCollection<Unit>(unitsQuery);

    const unitCountsByOwner = useMemo(() => {
        if (!units) return new Map<string, number>();
        return units.reduce((acc, unit) => {
            if (unit.ownerId) {
                acc.set(unit.ownerId, (acc.get(unit.ownerId) || 0) + 1);
            }
            return acc;
        }, new Map<string, number>());
    }, [units]);

    const sortedAndFilteredOwners = useMemo(() => {
        if (!owners) return null;
        
        const filtered = owners.filter(owner => 
            owner.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.sort((a, b) => {
            const dir = sortDirection === 'asc' ? 1 : -1;
            if (sortKey === 'name') {
                return a.name.localeCompare(b.name) * dir;
            } else {
                const countA = unitCountsByOwner.get(a.id) || 0;
                const countB = unitCountsByOwner.get(b.id) || 0;
                return (countA - countB) * dir;
            }
        });
    }, [owners, searchQuery, sortKey, sortDirection, unitCountsByOwner]);

    const paginatedOwners = useMemo(() => {
        if (!sortedAndFilteredOwners) return null;
        const startIndex = (currentPage - 1) * OWNERS_PER_PAGE;
        return sortedAndFilteredOwners.slice(startIndex, startIndex + OWNERS_PER_PAGE);
    }, [sortedAndFilteredOwners, currentPage]);
    
    const totalPages = sortedAndFilteredOwners ? Math.ceil(sortedAndFilteredOwners.length / OWNERS_PER_PAGE) : 0;
    
    const openForm = () => {
        setName('');
        setEmail('');
        setPhoneNumber('');
        setContactPerson('');
        setIsFormOpen(true);
    };
    
    const closeForm = () => {
        setIsFormOpen(false);
    };

    const handleSaveOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !firestore || !user) return;

        const ownerData = { name, email, phoneNumber, contactPerson };

        try {
            const ownersCollectionRef = collection(firestore, 'buildings', buildingId, 'owners');
            await addDoc(ownersCollectionRef, { ...ownerData, createdAt: serverTimestamp() });
            toast({ title: 'Owner Added', description: `${name} has been added.` });
            closeForm();
        } catch (error) {
            console.error("Error saving owner:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `/buildings/${buildingId}/owners`, operation: 'create', requestResourceData: ownerData,
            }));
        }
    };
    
    const handleDeleteOwner = (owner: Owner) => {
        if (!firestore || !buildingId) return;

        if ((unitCountsByOwner.get(owner.id) || 0) > 0) {
            toast({ variant: 'destructive', title: 'Cannot Delete Owner', description: 'This owner is still linked to one or more units. Please reassign the units first.'});
            return;
        }

        const ownerRef = doc(firestore, 'buildings', buildingId, 'owners', owner.id);
        deleteDoc(ownerRef)
            .then(() => {
                toast({ title: "Owner Removed", description: `${owner.name} has been removed from the records.` });
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ownerRef.path, operation: 'delete' }));
            });
    };

     const handleSort = (key: 'name' | 'units') => {
        if (key === sortKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (key: 'name' | 'units') => {
        if (sortKey !== key) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    const isLoading = owners === null || units === undefined;

    return (
        <main className="w-full max-w-6xl space-y-4">
            <div className="mb-2">
                <Button variant="ghost" onClick={() => router.push(`/building/${buildingId}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pl-0">
                    <ArrowLeft className="h-4 w-4" /> Back to Building Dashboard
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Owner Management</CardTitle>
                            <CardDescription>Add, view, and manage your building's unit owners.</CardDescription>
                        </div>
                        {!isFormOpen && <Button onClick={() => openForm()}>Add New Owner</Button>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isFormOpen && (
                        <form onSubmit={handleSaveOwner} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">Add a New Owner</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="Full Name or Company Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                <Input placeholder="Primary Contact Person (if company)" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
                                <Input placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit">Save Owner</Button>
                                <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
                            </div>
                        </form>
                    )}

                    <div className="flex justify-end">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by owner name..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="px-0">Name {renderSortIcon('name')}</Button></TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('units')} className="px-0">Units {renderSortIcon('units')}</Button></TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : paginatedOwners && paginatedOwners.length > 0 ? (
                                    paginatedOwners.map((owner) => (
                                        <TableRow key={owner.id}>
                                            <TableCell className="font-semibold">{owner.name}</TableCell>
                                            <TableCell>{owner.contactPerson || '—'}</TableCell>
                                            <TableCell>{owner.email || '—'}</TableCell>
                                            <TableCell>{owner.phoneNumber || '—'}</TableCell>
                                            <TableCell>{unitCountsByOwner.get(owner.id) || 0}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                     <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/building/${buildingId}/owners/${owner.id}`}>
                                                            <Eye className="h-4 w-4 mr-2" /> View
                                                        </Link>
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently remove {owner.name} from the records.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteOwner(owner)}>Continue</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            {searchQuery ? `No owners found matching "${searchQuery}".` : 'No owners have been added yet.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

    
