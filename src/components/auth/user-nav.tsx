"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, UserRole } from "@/hooks/use-auth";

export function UserNav() {
  const { role, setRole } = useAuth();

  const getInitials = (role: UserRole) => {
    const roleMap = {
      "Super Admin": "SA",
      "Board Member": "BM",
      "Owner": "OW",
      "Tenant": "TN",
    };
    return roleMap[role];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src="#" alt="User Avatar" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(role)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Current Role</p>
            <p className="text-xs leading-none text-muted-foreground">
              {role}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(value) => setRole(value as UserRole)}
        >
          <DropdownMenuRadioItem value="Super Admin">Super Admin</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Board Member">Board Member</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Owner">Owner</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="Tenant">Tenant</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
