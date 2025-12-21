
'use client';

import { useAuth } from './provider';

export function useUser() {
  const { user } = useAuth();
  return user;
}
