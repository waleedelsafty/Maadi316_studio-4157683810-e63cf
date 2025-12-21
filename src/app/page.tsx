
'use client';

import { useUser, useFirestore, useAuth, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function HomePage() {
  const user = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const [noteText, setNoteText] = useState('');
  const { toast } = useToast();

  const notesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notes'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: notes } = useCollection(notesQuery);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !user || !firestore) return;

    try {
      await addDoc(collection(firestore, 'users', user.uid, 'notes'), {
        text: noteText,
        createdAt: serverTimestamp(),
      });
      setNoteText('');
      toast({
        title: 'Note added!',
        description: 'Your new note has been saved.',
      });
    } catch (error) {
      console.error('Error adding note: ', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: 'Could not save your note. Please try again.',
      });
    }
  };

  if (!user || !firestore) {
    // AuthProvider handles the redirect, so we can just show a loader or null
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">My Notes</h1>
        </div>

        <Card className="mb-8">
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
      </div>
    </main>
  );
}
