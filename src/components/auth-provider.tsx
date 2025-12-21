'use client';

import { app } from '@/lib/firebase/config';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const AuthContext = createContext<{ user: User | null }>({
  user: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    // onAuthStateChanged is the recommended way to get the current user.
    // It automatically handles the result of a redirect login when the page loads.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  const value = useMemo(() => ({ user }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
