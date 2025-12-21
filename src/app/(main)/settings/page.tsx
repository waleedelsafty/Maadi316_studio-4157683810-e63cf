"use client";

import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function SettingsPage() {
    const { can } = useAuth();

    if (!can("Super Admin")) {
        return (
            <div>
                 <PageHeader
                    title="Settings"
                    description="Manage global building settings and financial calculations."
                />
                <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view or modify these settings. This page is for Super Admins only.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <>
            <PageHeader
                title="Settings"
                description="Manage global building settings and financial calculations."
            />
            <SettingsForm />
        </>
    )
}
