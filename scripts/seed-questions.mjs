/**
 * Seed questions from src/data/questions.json into Firestore.
 * Usage: node scripts/seed-questions.mjs your@email.com yourpassword
 */

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/seed-questions.mjs <email> <password>');
  process.exit(1);
}

// Read env vars from .env.local
const envFile = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

console.log('Signing in...');
await signInWithEmailAndPassword(auth, email, password);
console.log('Signed in. Seeding questions...');

const questions = JSON.parse(readFileSync('./src/data/questions.json', 'utf8'));
console.log(`Found ${questions.length} questions.`);

let count = 0;
for (const q of questions) {
  const { id, ...data } = q;
  await setDoc(doc(db, 'questions', id), data);
  count++;
  process.stdout.write(`\r${count}/${questions.length}`);
}

console.log(`\nDone. ${count} questions written to Firestore.`);
process.exit(0);
