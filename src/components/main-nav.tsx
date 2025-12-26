
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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Home, LogOut, Settings, Building, User as UserIcon, LayoutDashboard, Trash2, Palette } from 'lucide-react';
import { Separator } from './ui/separator';

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
    if (pathname === '/') return 'Dashboard';
    if (pathname.startsWith('/building/')) {
        if (pathname.includes('/level/')) {
            return 'Level Details';
        }
        return 'Building Details';
    }
    if (pathname === '/settings/general') return 'General Settings';
    if (pathname === '/settings/buildings') return 'My Buildings';
    if (pathname === '/settings/recycle-bin') return 'Recycle Bin';
    if (pathname === '/settings/theme') return 'Theme Editor';
    return 'Dashboard';
  }


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
                  isActive={pathname === '/settings/buildings'}
                  tooltip="My Buildings"
                >
                    <Link href="/settings/buildings">
                        <Building />
                        <span>My Buildings</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname === '/settings/recycle-bin'}
                  tooltip="Recycle Bin"
                >
                    <Link href="/settings/recycle-bin">
                        <Trash2 />
                        <span>Recycle Bin</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname.startsWith('/settings/theme')}
                  tooltip="Theme"
                >
                    <Link href="/settings/theme">
                        <Palette />
                        <span>Theme</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={pathname.startsWith('/settings/general')}
                  tooltip="Settings"
                >
                    <Link href="/settings/general">
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
        <header className="flex items-center gap-2 border-b p-2 h-14">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">
                {getPageTitle()}
            </h2>
        </header>
        <div className="p-4 sm:p-6">
            {children}
        </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
