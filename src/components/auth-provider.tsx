"use client";

import { app } from "@/lib/firebase/config";
import { getAuth, onAuthStateChanged, User, getRedirectResult } from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext<{ user: User | null }>({
  user: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    // This handles the result from the redirect
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // This is the signed-in user
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error("Error getting redirect result", error);
      });

    // This listens for any future auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, [auth]);

  const value = useMemo(() => ({ user }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
