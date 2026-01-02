
"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { FirebaseClientProvider, initializeFirebase } from "@/firebase";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { MainNav } from "@/app/main-nav";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });
const firebaseApp = initializeFirebase();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProvider>
            <FirebaseClientProvider firebaseApp={firebaseApp}>
                <MainNav>{children}</MainNav>
                <Toaster />
            </FirebaseClientProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
