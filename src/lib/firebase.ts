import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// A previous `firebase emulators:start` session plants a `__FIREBASE_DEFAULTS__`
// cookie (and/or global) on localhost. The Firebase SDK reads it and silently
// auto-connects Auth/Firestore to the emulator (e.g. 127.0.0.1:9099) with no
// connectAuthEmulator() call in our code — so once the emulator is stopped,
// login fails with auth/network-request-failed. This app does not use the
// emulator suite, so clear any stale emulator defaults on the client before the
// SDK initialises (opt back in with NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true).
if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true'
) {
  try {
    const g = globalThis as { __FIREBASE_DEFAULTS__?: { emulatorHosts?: unknown } };
    if (g.__FIREBASE_DEFAULTS__?.emulatorHosts) {
      delete g.__FIREBASE_DEFAULTS__;
    }
    if (document.cookie.includes('__FIREBASE_DEFAULTS__')) {
      document.cookie =
        '__FIREBASE_DEFAULTS__=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  } catch {
    // best-effort; safe to ignore
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const missing = Object.entries(firebaseConfig)
      .filter(([, value]) => !value)
      .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    if (missing.length > 0) {
      throw new Error(
        `Missing Firebase environment variables: ${missing.join(', ')}. ` +
          'Copy .env.local.example to .env.local and fill in your Firebase project config.'
      );
    }
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

function getFirebaseDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export { getFirebaseAuth as auth, getFirebaseDb as db };
