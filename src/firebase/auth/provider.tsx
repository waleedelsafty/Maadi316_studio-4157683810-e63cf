
'use client';

import {
  Auth,
  User,
  onAuthStateChanged,
} from 'firebase/auth';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextValue {
  user: User | null | undefined;
  auth: Auth;
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  auth: undefined as any,
});

export function AuthProvider({
  children,
  auth,
}: React.PropsWithChildren<{ auth: Auth }>) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <AuthContext.Provider value={{ user, auth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
