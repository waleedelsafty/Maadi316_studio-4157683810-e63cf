
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EditBuildingSheet } from '@/components/edit-building-sheet';
import type { Building } from '@/types';
import Link from 'next/link';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();
  const [noteText, setNoteText] = useState('');
  const { toast } = useToast();
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);


  const notesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notes'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: notes } = useCollection(notesQuery);

  const buildingsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'buildings'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: buildings } = useCollection(buildingsQuery);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !user || !firestore) return;

    const newNote = {
      text: noteText,
      createdAt: serverTimestamp(),
    };

    addDoc(collection(firestore, 'users', user.uid, 'notes'), newNote)
      .then(() => {
        setNoteText('');
        toast({
          title: 'Note added!',
          description: 'Your new note has been saved.',
        });
      })
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `/users/${user.uid}/notes`,
          operation: 'create',
          requestResourceData: newNote,
        }));
      });
  };

  if (!user || !firestore) {
    // AuthProvider handles the redirect, so we can just show a loader or null
    return null;
  }

  return (
    <main className="w-full max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Buildings</h2>
          <div className="space-y-4">
            {buildings && buildings.length > 0 ? (
              buildings.map((building) => (
                <Card key={building.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{building.name}</h3>
                      <p className="text-muted-foreground text-sm">{building.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingBuilding(building as Building)}>Edit</Button>
                      <Button size="sm" asChild>
                        <Link href={`/building/${building.id}`}>Open</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 rounded-lg border border-dashed">
                <p className="text-muted-foreground">
                  You haven't added any buildings yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                    Add a building in the Settings page.
                </p>
              </div>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add a New Note</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNote} className="flex gap-4">
              <Input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-grow"
              />
              <Button type="submit">Add Note</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Your Notes</h2>
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="p-6">
                  <p>{note.text}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                You haven't added any notes yet.
              </p>
            </div>
          )}
        </div>
        {editingBuilding && (
            <EditBuildingSheet
                building={editingBuilding}
                isOpen={!!editingBuilding}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setEditingBuilding(null);
                    }
                }}
            />
        )}
    </main>
  );
}
