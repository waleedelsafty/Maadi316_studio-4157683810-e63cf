"use client";

import { AppProvider } from "@/components/app-provider";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/toaster";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </AppProvider>
  );
}
