
'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Button } from './ui/button';

export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (e: FirestorePermissionError) => {
        console.error("Caught Firestore Permission Error:", e.message);
        setError(e);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (!error || process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const isIndexError = error.message.includes("requires an index");

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 p-4 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-3xl w-full">
            <Terminal className="h-4 w-4" />
            <AlertTitle>{isIndexError ? "Firestore Index Required" : "Firestore Permission Denied"}</AlertTitle>
            <AlertDescription>
                <p className="mb-4">
                    The last Firestore operation was blocked. This is not a bug in the app, but a missing piece of backend configuration.
                </p>
                <div className="font-mono text-xs bg-black/50 p-4 rounded-md overflow-x-auto">
                    <pre><code>{error.message}</code></pre>
                </div>
                 {isIndexError && (
                    <div className="mt-4">
                        <p className="font-bold">How to fix this:</p>
                        <p className="text-sm">The query needs a composite index. The error message contains a link to the Firebase Console to create it. Click the link, review the details, and click "Create Index". The index will take a few minutes to build.</p>
                    </div>
                )}
                <div className="mt-6 text-right">
                     <Button onClick={() => setError(null)} variant="secondary">
                        Dismiss
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    </div>
  );
}
