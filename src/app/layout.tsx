
"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { FirebaseClientProvider, initializeFirebase } from "@/firebase";

const inter = Inter({ subsets: ["latin"] });
const firebaseApp = initializeFirebase();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProvider>
          <FirebaseClientProvider firebaseApp={firebaseApp}>
            {children}
          </FirebaseClientProvider>
        </AppProvider>
      </body>
    </html>
  );
}
