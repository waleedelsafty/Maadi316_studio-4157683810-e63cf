"use client";

import { AppProvider } from "@/components/app-provider";
import { FirebaseClientProvider, initializeFirebase } from "@/firebase";

const firebaseApp = initializeFirebase();

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <FirebaseClientProvider firebaseApp={firebaseApp}>
        {children}
      </FirebaseClientProvider>
    </AppProvider>
  );
}
