
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { Building, UserProfile } from '@/types';
import {
  LogOut,
  Settings,
  Building as BuildingIcon,
  LayoutDashboard,
  Landmark,
  ToyBrick,
  Users,
  Wrench,
  PanelLeft,
  PenSquare,
  Box,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getYear } from 'date-fns';
import { useApp } from '@/components/app-provider';
import { Label } from '@/components/ui/label';

import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- Sidebar Framework Code ---
const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-card",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "icon",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-[--sidebar-width] flex-col bg-card text-card-foreground",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-card p-0 text-card-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-card-foreground"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
      >
        <div
          className={cn(
            "duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]"
          )}
        />
        <div
          className={cn(
            "duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-card group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-border group-data-[variant=floating]:shadow"
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"


const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="body"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarBody.displayName = "SidebarBody"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1 px-2", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-ring transition-[width,height,padding] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground data-[state=open]:hover:bg-accent data-[state=open]:hover:text-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate group-data-[collapsible=icon]:[&>span:last-child]:hidden [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-accent hover:text-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--border))] hover:bg-accent hover:text-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--accent))]",
      },
      size: {
        default: "h-9 text-sm",
        sm: "h-8 text-xs",
        lg: "h-12 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state } = useSidebar()

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Comp>
    )

    if (!tooltip) {
      return button
    }
    
    if (typeof tooltip === 'string') {
        tooltip = {
            children: tooltip,
        }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

// --- Global Financial Period Filter Component ---
function GlobalPeriodFilter({ building }: { building: Building | null }) {
    const { quarterRange, setQuarterRange } = useApp();

    const yearFilterOptions = React.useMemo(() => {
        if (!building?.financialStartDate) return [];
        const startYear = getYear(building.financialStartDate.toDate());
        const currentYear = getYear(new Date());
        const years: number[] = [];
        for (let y = startYear; y <= currentYear; y++) {
            years.push(y);
        }
        return years.reverse();
    }, [building]);

    if (!building?.financialStartDate) {
        return (
            <div className="p-4 text-sm text-muted-foreground hidden md:block">
                Set a financial start date for this building to enable period filtering.
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <Label className="hidden lg:inline-block text-xs text-muted-foreground">Period:</Label>
            <Select onValueChange={(value) => setQuarterRange(value as any)} value={quarterRange}>
                <SelectTrigger className="w-auto h-8 text-xs lg:w-[180px] lg:text-sm">
                    <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="year_to_date">Year to Date</SelectItem>
                    <SelectItem value="all_since_start">All (Since Start)</SelectItem>
                    {yearFilterOptions.map(year => (
                        <SelectItem key={year} value={`year_${year}`}>Year ({year})</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

// --- MainNav Component ---

export function MainNav({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  
  const userProfileRef = React.useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

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
  
  const buildingIdInUrl = pathname.includes('/building/') ? pathname.split('/')[2] : null;
  const activeBuildingId = buildingIdInUrl || userProfile?.defaultBuildingId;

  const activeBuildingRef = React.useMemo(() => {
    if (!firestore || !activeBuildingId) return null;
    return doc(firestore, 'buildings', activeBuildingId);
  }, [firestore, activeBuildingId]);
  const { data: activeBuilding } = useDoc<Building>(activeBuildingRef);


  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return <>{children}</>;
  }

  const getPageTitle = () => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathname.startsWith('/settings')) return 'Settings';

    if (pathParts.length === 0) return 'Dashboard';
    if (pathParts[0] === 'buildings') {
        if (pathParts[1] === 'new') return 'Add New Building';
        return 'My Buildings';
    }

    if (pathParts[0] === 'building' && pathParts.length > 1) {
        if (pathParts.length === 2) return 'Building Info';
        if (pathParts[2] === 'edit') return 'Edit Building';
        if (pathParts[2] === 'structure') return 'Building Structure';
        if (pathParts[2] === 'units') return 'All Units';
        if (pathParts[2] === 'financials') return 'Building Financials';
        if (pathParts[2] === 'employees') return 'Building Employees';
        if (pathParts[2] === 'owners') return 'Building Owners';
        if (pathParts[2] === 'providers') return 'Service Providers';
        if (pathParts[2] === 'level') return 'Level Details';
        if (pathParts[2] === 'unit') {
            if (pathParts[4] === 'edit') return 'Edit Unit';
            if (pathParts[4] === 'payments') return 'Unit Payments';
        }
        return 'Building Info';
    }
    return 'Dashboard';
  }
  
  const isSettingsPage = pathname.startsWith('/settings');

  return (
    <SidebarProvider>
        <Sidebar>
            <SidebarHeader>
            <div className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-10 w-10">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold text-foreground truncate">
                    {user?.displayName}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                    {user?.email}
                </span>
                </div>
            </div>
            </SidebarHeader>
            <SidebarBody>
            <div className="flex-1 overflow-y-auto">
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
                                <BuildingIcon />
                                <span>My Buildings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    {activeBuildingId && !isSettingsPage && (
                        <>
                        <Separator className="my-2" />
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname === `/building/${activeBuildingId}`}
                            tooltip="Building Info"
                            >
                                <Link href={`/building/${activeBuildingId}`}>
                                    <PenSquare />
                                    <span>Building Info</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/structure')}
                            tooltip="Structure"
                            >
                                <Link href={`/building/${activeBuildingId}/structure`}>
                                    <ToyBrick />
                                    <span>Structure</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/units')}
                            tooltip="All Units"
                            >
                                <Link href={`/building/${activeBuildingId}/units`}>
                                    <Box />
                                    <span>All Units</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/owners')}
                            tooltip="Owners"
                            >
                                <Link href={`/building/${activeBuildingId}/owners`}>
                                    <Users />
                                    <span>Owners</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/providers')}
                            tooltip="Service Providers"
                            >
                                <Link href={`/building/${activeBuildingId}/providers`}>
                                    <Wrench />
                                    <span>Service Providers</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/financials')}
                            tooltip="Financials"
                            >
                                <Link href={`/building/${activeBuildingId}/financials`}>
                                    <Landmark />
                                    <span>Financials</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                            asChild
                            isActive={pathname.includes('/employees')}
                            tooltip="Employees"
                            >
                                <Link href={`/building/${activeBuildingId}/employees`}>
                                    <Users />
                                    <span>Employees</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        </>
                    )}
                </SidebarMenu>
            </div>
            <div className="mt-auto">
                    <Separator />
                    <SidebarMenu>
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
                        <SidebarMenuItem>
                        <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
                            <LogOut />
                            <span>Sign Out</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
            </div>
            </SidebarBody>
        </Sidebar>
        <SidebarInset>
            <header className={cn("flex items-center justify-between gap-2 border-b p-2 h-14")}>
                <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <h2 className="text-lg font-semibold">
                        {getPageTitle()}
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    {pathname.includes('/financials') && (
                    <GlobalPeriodFilter building={activeBuilding} />
                    )}
                    <ThemeToggle />
                </div>
            </header>
            <div className={cn("p-2 sm:p-4")}>
                {children}
            </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
