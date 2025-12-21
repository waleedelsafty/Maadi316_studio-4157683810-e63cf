"use client";

import React, { createContext, useState } from 'react';

export type UserRole = "Super Admin" | "Board Member" | "Owner" | "Tenant";

interface AuthContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  can: (requiredRole: UserRole) => boolean;
}

const roleHierarchy: { [key in UserRole]: number } = {
  "Super Admin": 4,
  "Board Member": 3,
  "Owner": 2,
  "Tenant": 1,
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("Super Admin");

  const can = (requiredRole: UserRole) => {
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  return (
    <AuthContext.Provider value={{ role, setRole, can }}>
      {children}
    </AuthContext.Provider>
  );
}
