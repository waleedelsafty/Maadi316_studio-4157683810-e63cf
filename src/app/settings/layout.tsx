
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


const tabs = [
    { name: 'General', href: '/settings/general' },
    { name: 'Theme', href: '/settings/theme' },
    { name: 'Display', href: '/settings/display' },
    { name: 'Recycle Bin', href: '/settings/recycle-bin' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="w-full space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and application settings.</p>
        </div>
        <Tabs value={pathname} className="w-full">
            <TabsList>
                {tabs.map((tab) => (
                    <Link href={tab.href} key={tab.href}>
                        <TabsTrigger value={tab.href}>{tab.name}</TabsTrigger>
                    </Link>
                ))}
            </TabsList>
        </Tabs>
        <div>
             {children}
        </div>
    </main>
  );
}
