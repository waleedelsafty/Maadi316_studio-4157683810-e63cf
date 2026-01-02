
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings,
  User,
  Palette,
  LayoutGrid,
  Zap,
  Banknote,
  DollarSign,
  Trash2,
  TestTube2,
} from 'lucide-react';

const settingsNav = [
  {
    title: 'General',
    items: [
      {
        title: 'Profile',
        href: '/settings/general',
        icon: User,
      },
      {
        title: 'Theme',
        href: '/settings/general/theme',
        icon: Palette,
      },
    ],
  },
  {
    title: 'Global',
    items: [
      {
        title: 'Unit Types',
        href: '/settings/global/unit-types',
        icon: LayoutGrid,
      },
      {
        title: 'Utility Types',
        href: '/settings/global/utility-types',
        icon: Zap,
      },
      {
        title: 'Payment Methods',
        href: '/settings/global/payment-methods',
        icon: Banknote,
      },
      {
        title: 'Payable Categories',
        href: '/settings/global/payable-categories',
        icon: DollarSign,
      },
    ],
  },
  {
    title: 'Developer',
    items: [
      {
        title: 'Display',
        href: '/settings/developer/display',
        icon: Settings,
      },
      {
        title: 'Recycle Bin',
        href: '/settings/developer/recycle-bin',
        icon: Trash2,
      },
      {
        title: 'Test Form',
        href: '/settings/developer/test-form',
        icon: TestTube2,
      },
      {
        title: 'Datepicker Test',
        href: '/settings/developer/datepicker-test',
        icon: TestTube2,
      },
       {
        title: 'Owner Selector',
        href: '/settings/developer/owner-selector-test',
        icon: TestTube2,
      },
       {
        title: 'Unit Inspector',
        href: '/settings/developer/unit-inspector',
        icon: TestTube2,
      },
      {
        title: 'Unit Inspector 2',
        href: '/settings/developer/unit-inspector-2',
        icon: TestTube2,
      },
      {
        title: 'Test Expenses',
        href: '/settings/developer/test-expenses',
        icon: TestTube2,
      },
    ],
  },
];


function SettingsSidebar() {
    const pathname = usePathname();

    return (
        <div className="h-full">
             <ScrollArea className="h-full p-1">
                 <h2 className="mb-4 px-2 text-lg font-semibold tracking-tight">
                    Settings
                </h2>
                <div className="space-y-4">
                    {settingsNav.map((group) => (
                        <div key={group.title}>
                            <h3 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">{group.title}</h3>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <Button
                                        key={item.href}
                                        asChild
                                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                                        className="w-full justify-start"
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="mr-2 h-4 w-4" />
                                            {item.title}
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <aside className="hidden md:block">
            <SettingsSidebar />
        </aside>
        <div className="col-span-1">
            {children}
        </div>
    </div>
  );
}
