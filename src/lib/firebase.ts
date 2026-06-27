import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';

let _app: FirebaseApp;
let _auth: Auth;
let _db: Firestore;
let _storage: FirebaseStorage;

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
    if (USE_EMULATOR) {
      connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return _auth;
}

function getFirebaseDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
    if (USE_EMULATOR) {
      connectFirestoreEmulator(_db, '127.0.0.1', 8080);
    }
  }
  return _db;
}

function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) {
    _storage = getStorage(getFirebaseApp());
    if (USE_EMULATOR) {
      connectStorageEmulator(_storage, '127.0.0.1', 9199);
    }
  }
  return _storage;
}

export { getFirebaseAuth as auth, getFirebaseDb as db, getFirebaseStorage as storage };
