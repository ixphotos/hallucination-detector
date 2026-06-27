'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { createProfile, getProfile } from './firestore';
import type { Profile } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (u) => {
      setUser(u);
      if (u) {
        let p = await getProfile(u.uid);
        // Auto-create profile if it was never saved (e.g. blocked by Firestore rules at registration)
        if (!p) {
          await createProfile(u.uid, u.displayName ?? u.email?.split('@')[0] ?? 'Teacher', u.email ?? '');
          p = await getProfile(u.uid);
        }
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth(), email, password);
    const p = await getProfile(cred.user.uid);
    setProfile(p);
  }

  async function register(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth(), email, password);
    await createProfile(cred.user.uid, name, email);
    const p = await getProfile(cred.user.uid);
    setProfile(p);
  }

  async function logOut() {
    await signOut(auth());
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, register, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
