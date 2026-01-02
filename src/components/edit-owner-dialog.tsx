
'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Owner } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface EditOwnerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  owner: Owner;
  buildingId: string;
}

export function EditOwnerDialog({ isOpen, onOpenChange, owner, buildingId }: EditOwnerDialogProps) {
  const [name, setName] = React.useState(owner.name);
  const [email, setEmail] = React.useState(owner.email || '');
  const [phoneNumber, setPhoneNumber] = React.useState(owner.phoneNumber || '');
  const [contactPerson, setContactPerson] = React.useState(owner.contactPerson || '');
  const [isSaving, setIsSaving] = React.useState(false);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  React.useEffect(() => {
    if (owner) {
      setName(owner.name);
      setEmail(owner.email || '');
      setPhoneNumber(owner.phoneNumber || '');
      setContactPerson(owner.contactPerson || '');
    }
  }, [owner, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !firestore) return;
    
    setIsSaving(true);
    const ownerRef = doc(firestore, 'buildings', buildingId, 'owners', owner.id);
    const updatedData = { name, email, phoneNumber, contactPerson };

    updateDoc(ownerRef, updatedData)
        .then(() => {
            toast({ title: 'Owner Updated', description: 'The owner information has been saved.' });
            onOpenChange(false);
        })
        .catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: ownerRef.path, operation: 'update', requestResourceData: updatedData
            }));
        })
        .finally(() => {
            setIsSaving(false);
        });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit Owner</DialogTitle>
            <DialogDescription>Update the contact information for {owner.name}.</DialogDescription>
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
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
