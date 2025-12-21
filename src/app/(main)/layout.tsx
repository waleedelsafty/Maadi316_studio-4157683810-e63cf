"use client";

import { AppProvider } from "@/components/app-provider";
import { AuthProvider } from "@/components/auth-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppProvider>
  );
}
