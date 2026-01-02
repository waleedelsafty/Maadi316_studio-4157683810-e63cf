
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { ServiceProvider } from '@/types';
import { ArrowLeft, Trash2, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const serviceTypes: ServiceProvider['serviceType'][] = ['Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Security', 'Landscaping', 'Pest Control', 'Other'];

export default function ServiceProvidersPage() {
    const { buildingId } = useParams() as { buildingId: string };
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
    const [name, setName] = useState('');
    const [serviceType, setServiceType] = useState<ServiceProvider['serviceType'] | ''>('');
    const [contactPerson, setContactPerson] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [hasMonthlyPayment, setHasMonthlyPayment] = useState(false);
    const [monthlyPaymentAmount, setMonthlyPaymentAmount] = useState<number | ''>('');

    // Firestore Hooks
    const providersQuery = useMemo(() => {
        if (!firestore || !buildingId) return null;
        return query(collection(firestore, 'buildings', buildingId, 'serviceProviders'));
    }, [firestore, buildingId]);
    const { data: providers } = useCollection<ServiceProvider>(providersQuery);
    
    const openForm = (provider: ServiceProvider | null = null) => {
        setEditingProvider(provider);
        setName(provider?.name || '');
        setServiceType(provider?.serviceType || '');
        setContactPerson(provider?.contactPerson || '');
        setPhoneNumber(provider?.phoneNumber || '');
        setEmail(provider?.email || '');
        setNotes(provider?.notes || '');
        setHasMonthlyPayment(provider?.hasMonthlyPayment || false);
        setMonthlyPaymentAmount(provider?.monthlyPaymentAmount || '');
        setIsFormOpen(true);
    };
    
    const closeForm = () => {
        setIsFormOpen(false);
        setEditingProvider(null);
        // Reset all form fields to default
        setName(''); setServiceType(''); setContactPerson(''); 
        setPhoneNumber(''); setEmail(''); setNotes(''); setHasMonthlyPayment(false);
        setMonthlyPaymentAmount('');
    };

    const handleSaveProvider = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !serviceType || !firestore) return;

        let providerData: Partial<ServiceProvider> = { 
            name, 
            serviceType, 
            contactPerson, 
            phoneNumber, 
            email, 
            notes,
            hasMonthlyPayment,
            monthlyPaymentAmount: hasMonthlyPayment ? Number(monthlyPaymentAmount) : null,
        };
        
        try {
            if (editingProvider) {
                const providerRef = doc(firestore, 'buildings', buildingId, 'serviceProviders', editingProvider.id);
                await updateDoc(providerRef, providerData);
                toast({ title: 'Provider Updated', description: `${name} has been updated.` });
            } else {
                await addDoc(collection(firestore, 'buildings', buildingId, 'serviceProviders'), { ...providerData, createdAt: serverTimestamp() });
                toast({ title: 'Provider Added', description: `${name} has been added.` });
            }
            closeForm();
        } catch (error) {
            console.error("Error saving provider:", error);
            const path = editingProvider ? `/buildings/${buildingId}/serviceProviders/${editingProvider.id}` : `/buildings/${buildingId}/serviceProviders`;
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path, operation: editingProvider ? 'update' : 'create', requestResourceData: providerData,
            }));
        }
    };
    
    const handleDeleteProvider = (provider: ServiceProvider) => {
        if (!firestore || !buildingId) return;

        const providerRef = doc(firestore, 'buildings', buildingId, 'serviceProviders', provider.id);
        deleteDoc(providerRef)
            .then(() => {
                toast({ title: "Provider Removed", description: `${provider.name} has been removed from the records.` });
            })
            .catch(() => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: providerRef.path, operation: 'delete' }));
            });
    };

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
                            <CardTitle>Service Provider Management</CardTitle>
                            <CardDescription>Add, view, and manage your building's vendors and service providers.</CardDescription>
                        </div>
                        {!isFormOpen && <Button onClick={() => openForm()}>Add New Provider</Button>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isFormOpen && (
                        <form onSubmit={handleSaveProvider} className="space-y-6 p-4 border rounded-lg bg-muted/50">
                            <h3 className="font-medium">{editingProvider ? 'Edit Provider' : 'Add a New Provider'}</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="Provider Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                <Select onValueChange={(value) => setServiceType(value as ServiceProvider['serviceType'])} value={serviceType} required>
                                    <SelectTrigger><SelectValue placeholder="Select Service Type" /></SelectTrigger>
                                    <SelectContent>{serviceTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                             <div className="grid sm:grid-cols-2 gap-4">
                                <Input placeholder="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                                <Input placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                            </div>
                             <Input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
                             <Textarea placeholder="Notes (e.g., account number, general info)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                             
                             <div className="flex items-center space-x-4 rounded-lg border p-4">
                                <Switch id="has-monthly-payment" checked={hasMonthlyPayment} onCheckedChange={setHasMonthlyPayment} />
                                <Label htmlFor="has-monthly-payment">Has Monthly Payment</Label>
                                {hasMonthlyPayment && (
                                    <Input
                                        type="number"
                                        placeholder="Monthly Amount"
                                        value={monthlyPaymentAmount}
                                        onChange={(e) => setMonthlyPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                        required
                                        className="w-48"
                                    />
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit">Save Provider</Button>
                                <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
                            </div>
                        </form>
                    )}

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Monthly Payment</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {providers ? (
                                    providers.length > 0 ? (
                                        providers.map((provider) => (
                                            <TableRow key={provider.id}>
                                                <TableCell className="font-semibold">{provider.name}</TableCell>
                                                <TableCell>{provider.serviceType}</TableCell>
                                                <TableCell>
                                                    {provider.hasMonthlyPayment && provider.monthlyPaymentAmount
                                                        ? provider.monthlyPaymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div>{provider.contactPerson}</div>
                                                    <div className="text-xs text-muted-foreground">{provider.phoneNumber}</div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button variant="outline" size="sm" onClick={() => openForm(provider)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>This will permanently remove {provider.name} from the records.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteProvider(provider)}>Continue</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                No service providers have been added yet.
                                            </TableCell>
                                        </TableRow>
                                    )
                                ) : (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
