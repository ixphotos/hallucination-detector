/**
 * Seed questions from data/questions.json into Firestore.
 * Usage: node scripts/seed-questions.mjs your@email.com
 * The password is prompted (or read from FIREBASE_SEED_PASSWORD) so it never
 * lands in shell history. The account must be an admin (see firestore.rules).
 */

import { readFileSync } from 'fs';
import { createInterface } from 'node:readline';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const [, , email] = process.argv;
if (!email) {
  console.error('Usage: node scripts/seed-questions.mjs <email>');
  process.exit(1);
}

async function promptPassword() {
  if (process.env.FIREBASE_SEED_PASSWORD) return process.env.FIREBASE_SEED_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Mute echo while the password is typed.
  const write = rl._writeToOutput?.bind(rl);
  rl._writeToOutput = (s) => { if (!rl.muted && write) write(s); };
  const answer = await new Promise((resolve) => {
    rl.question('Password: ', resolve);
    rl.muted = true;
  });
  rl.close();
  process.stdout.write('\n');
  return answer;
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

const password = await promptPassword();
console.log('Signing in...');
await signInWithEmailAndPassword(auth, email, password);
console.log('Signed in. Seeding questions...');

const questions = JSON.parse(readFileSync('./data/questions.json', 'utf8'));
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
