
'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Owner, Unit } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronsUpDown, Check, UserPlus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- Create Owner Dialog ---
function CreateOwnerDialog({
  isOpen,
  onOpenChange,
  onCreate,
  initialName = '',
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (newOwner: Omit<Owner, 'id' | 'createdAt'>) => Promise<void>;
  initialName?: string;
}) {
  const [name, setName] = React.useState(initialName);
  const [email, setEmail] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
        setName(initialName);
        setEmail('');
        setPhoneNumber('');
        setContactPerson('');
    }
  }, [isOpen, initialName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    await onCreate({ name, email, phoneNumber, contactPerson });
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Create New Owner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div>
              <Label htmlFor="name">Full Name or Company</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
             <div>
              <Label htmlFor="contact">Contact Person</Label>
              <Input id="contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Owner'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Combobox Component (New Implementation) ---
interface OwnerComboboxProps {
  buildingId: string;
  owners: (Owner | Unit)[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function OwnerCombobox({
  buildingId,
  owners,
  value,
  onChange,
  disabled = false,
}: OwnerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleCreateOwner = async (newOwnerData: Omit<Owner, 'id' | 'createdAt'>) => {
    if (!firestore) return;
    const ownersCollectionRef = collection(firestore, 'buildings', buildingId, 'owners');
    try {
        const docRef = await addDoc(ownersCollectionRef, {
            ...newOwnerData,
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Owner Created', description: `"${newOwnerData.name}" has been added.` });
        onChange(docRef.id); // Automatically select the new owner
        setSearch(''); // Clear search
    } catch (error) {
        console.error("Error creating owner:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create owner.' });
    }
  };
  
  const ownersMap = React.useMemo(() => new Map(owners.map(o => [o.id, 'name' in o ? o.name : `Unit ${o.unitNumber}`])), [owners]);
  
  const filteredOwners = React.useMemo(() => {
    if (!owners) return [];
    const lowerSearch = search.toLowerCase();
    return owners.filter(o => {
        if ('name' in o) { // It's an Owner
            return o.name.toLowerCase().includes(lowerSearch);
        }
        if ('unitNumber' in o) { // It's a Unit
            return String(o.unitNumber).toLowerCase().includes(lowerSearch);
        }
        return false;
    });
  }, [owners, search]);

  const showCreateNew = search.length > 0 && !filteredOwners.some(o => 'name' in o && o.name.toLowerCase() === search.toLowerCase());

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {value ? ownersMap.get(value) : 'Select an owner or unit...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <div className="p-2">
                <Input
                    placeholder="Search or create owner..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                {filteredOwners.length === 0 && !showCreateNew ? (
                     <p className="p-2 text-center text-sm text-muted-foreground">No results found.</p>
                ) : (
                    filteredOwners.map((item) => {
                        const isOwner = 'name' in item;
                        const label = isOwner ? item.name : `Unit ${item.unitNumber}`;

                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    onChange(item.id);
                                    setOpen(false);
                                }}
                                className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
                            >
                                <span>{label}</span>
                                {value === item.id && <Check className="h-4 w-4" />}
                            </div>
                        )
                    })
                )}
                {showCreateNew && (
                     <div
                        onClick={() => {
                            setOpen(false);
                            setIsCreateDialogOpen(true);
                        }}
                        className="p-2 hover:bg-accent cursor-pointer flex items-center text-sm"
                     >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create new owner: "{search}"
                    </div>
                )}
            </div>
        </PopoverContent>
      </Popover>

      <CreateOwnerDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateOwner}
        initialName={search}
      />
    </>
  );
}
