
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  Sidebar,
  SidebarBody,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Home, LogOut, Settings, Building, User as UserIcon, LayoutDashboard, Trash2, Palette, Code, DollarSign, PenSquare, Landmark, ToyBrick } from 'lucide-react';
import { Separator } from './ui/separator';
import { ThemeToggle } from './theme-toggle';

export function MainNav({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };
  

  if (!user) {
    return <>{children}</>;
  }

  const getPageTitle = () => {
    const pathParts = pathname.split('/').filter(Boolean);

    if (pathParts.length === 0) return 'Dashboard';
    if (pathParts[0] === 'buildings') {
        if (pathParts[1] === 'new') return 'Add New Building';
        return 'My Buildings';
    }
    if (pathParts[0] === 'settings') return 'Settings';

    if (pathParts[0] === 'building' && pathParts.length > 1) {
        const buildingId = pathParts[1];
        if (pathParts[2] === 'edit') return 'Edit Building';
        if (pathParts[2] === 'structure') return 'Building Structure';
        if (pathParts[2] === 'financials') return 'Building Financials';
        if (pathParts[2] === 'level') return 'Level Details';
        if (pathParts[2] === 'unit') {
            if (pathParts[4] === 'edit') return 'Edit Unit';
            if (pathParts[4] === 'payments') return 'Unit Payments';
        }
        return 'Building Dashboard';
    }
    return 'Dashboard';
  }
  
  const buildingId = pathname.includes('/building/') ? pathname.split('/')[2] : null;


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {user?.displayName}
              </span>
              <span className="text-xs text-muted-foreground">
                {user?.email}
              </span>
            </div>
          </div>
        </SidebarHeader>
        <Separator />
        <SidebarContent>
           <SidebarMenu>
             <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname === '/'}
                  tooltip="Dashboard"
                >
                    <Link href="/">
                        <LayoutDashboard />
                        <span>Dashboard</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname === '/buildings' || pathname === '/buildings/new'}
                  tooltip="My Buildings"
                >
                    <Link href="/buildings">
                        <Building />
                        <span>My Buildings</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
             {buildingId && (
                <>
                <Separator className="my-2" />
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      isActive={pathname === `/building/${buildingId}`}
                      tooltip="Building Dashboard"
                    >
                        <Link href={`/building/${buildingId}`}>
                            <PenSquare />
                            <span>Dashboard</span>
                        </Link>
                    </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      isActive={pathname.includes('/structure')}
                      tooltip="Structure"
                    >
                        <Link href={`/building/${buildingId}/structure`}>
                            <ToyBrick />
                            <span>Structure</span>
                        </Link>
                    </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      isActive={pathname.includes('/financials')}
                      tooltip="Financials"
                    >
                        <Link href={`/building/${buildingId}/financials`}>
                            <Landmark />
                            <span>Financials</span>
                        </Link>
                    </SidebarMenuButton>
                 </SidebarMenuItem>
                <Separator className="my-2" />
                </>
             )}
             <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname.startsWith('/settings')}
                  tooltip="Settings"
                >
                    <Link href="/settings">
                        <Settings />
                        <span>Settings</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
           </SidebarMenu>
        </SidebarContent>
        <Separator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
                <LogOut />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between gap-2 border-b p-4 h-14">
            <div className="flex items-center gap-2">
                <SidebarTrigger />
                <h2 className="text-lg font-semibold">
                    {getPageTitle()}
                </h2>
            </div>
            <ThemeToggle />
        </header>
        <div className="p-2 sm:p-4">
            {children}
        </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
