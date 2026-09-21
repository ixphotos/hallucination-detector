'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  // Name supplied at registration, consumed by the auth listener when it
  // creates the profile. Profile creation lives in exactly one place (the
  // listener) so a registration and the listener's auto-create can never race
  // and overwrite the user's real name with a fallback.
  const pendingNameRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (u) => {
      setUser(u);
      if (u) {
        try {
          let p = await getProfile(u.uid);
          // Auto-create the profile if it was never saved.
          if (!p) {
            const name =
              pendingNameRef.current ?? u.displayName ?? u.email?.split('@')[0] ?? 'Teacher';
            await createProfile(u.uid, name, u.email ?? '');
            p = await getProfile(u.uid);
          }
          setProfile(p);
        } catch (err) {
          console.error('Failed to load profile:', err);
          setProfile(null);
        } finally {
          pendingNameRef.current = null;
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    // The profile is loaded by the onAuthStateChanged listener.
    await signInWithEmailAndPassword(auth(), email, password);
  }

  async function register(name: string, email: string, password: string) {
    pendingNameRef.current = name;
    try {
      await createUserWithEmailAndPassword(auth(), email, password);
    } catch (err) {
      pendingNameRef.current = null;
      throw err;
    }
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
