"use client";

import { useState, useEffect } from "react";
import { AppProvider } from "@/components/app-provider";
import { AuthProvider } from "@/components/auth-provider";

export function ClientProvider({ children }: { children: React.ReactNode }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Render nothing on the server and on the initial client render.
    // This prevents any hydration mismatch errors.
    if (!isClient) {
        return null;
    }

    return (
        <AuthProvider>
            <AppProvider>
                {children}
            </AppProvider>
        </AuthProvider>
    );
}
