'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase/firestore';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  onSnapshot,
  orderBy,
  where,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Custom hook to fetch a collection from Firestore
function useCollection<T>(q: Query<T, DocumentData> | null) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);

  useEffect(() => {
    if (!q) return;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setData(docs);
    });

    return unsubscribe;
  }, [q]);

  return { data };
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [noteText, setNoteText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const notesQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(db, 'users', user.uid, 'notes'),
      orderBy('createdAt', 'desc')
    );
  }, [user]);

  const { data: notes } = useCollection(notesQuery);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !user) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'notes'), {
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

  if (!user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-24">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">My Notes</h1>
          <Button
            variant="outline"
            onClick={() => {
              // This is a placeholder for a real sign-out function
              router.push('/login');
            }}
          >
            Sign Out
          </Button>
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
