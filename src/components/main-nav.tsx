
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
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Home, LogOut, Settings, Building, User as UserIcon, ChevronDown } from 'lucide-react';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export function MainNav({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(pathname.startsWith('/settings'));

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
  
  React.useEffect(() => {
    setIsSettingsOpen(pathname.startsWith('/settings'));
  }, [pathname]);

  if (!user) {
    return <>{children}</>;
  }

  const getPageTitle = () => {
    if (pathname === '/') return 'Home';
    if (pathname.startsWith('/building/')) {
        if (pathname.includes('/level/')) {
            return 'Level Details';
        }
        return 'Building Details';
    }
    if (pathname === '/settings/general') return 'General Settings';
    if (pathname === '/settings/buildings') return 'Manage Buildings';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'Home';
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
             <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="w-full">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={pathname.startsWith('/settings')}
                        tooltip="Settings"
                        className="justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Settings />
                          <span>Settings</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} />
                      </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/settings/general'}>
                                <Link href="/settings/general"><UserIcon /> General</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/settings/buildings'}>
                                <Link href="/settings/buildings"><Building /> Buildings</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    </SidebarMenuSub>
                </CollapsibleContent>
             </Collapsible>
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

    