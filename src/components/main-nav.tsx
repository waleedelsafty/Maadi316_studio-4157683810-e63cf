
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
import { Home, LogOut, Settings, Building } from 'lucide-react';
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
      // The redirect is handled by the AuthRedirect component in the provider
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
                  tooltip="Home"
                >
                    <Link href="/">
                        <Home />
                        <span>Home</span>
                    </Link>
                </SidebarMenuButton>
             </SidebarMenuItem>
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
        <header className="flex items-center gap-2 border-b p-2 h-14">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">
                {pathname === '/' ? 'Home' : 'Settings'}
            </h2>
        </header>
        <div className="p-4 sm:p-6">
            {children}
        </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
