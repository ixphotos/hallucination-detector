import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Profile, Attempt } from '@/types';

export async function createProfile(userId: string, name: string, email: string): Promise<void> {
  await setDoc(doc(db(), 'profiles', userId), {
    name,
    email,
    role: 'teacher',
    createdAt: serverTimestamp(),
  });
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db(), 'profiles', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    email: data.email,
    role: data.role,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export async function saveAttempt(attempt: Omit<Attempt, 'id' | 'completedAt'>): Promise<string> {
  const ref = await addDoc(collection(db(), 'attempts'), {
    ...attempt,
    completedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  const snap = await getDoc(doc(db(), 'attempts', attemptId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    completedAt: data.completedAt?.toDate() ?? new Date(),
  } as Attempt;
}

export async function getTeacherAttempts(teacherId: string): Promise<Attempt[]> {
  const q = query(
    collection(db(), 'attempts'),
    where('teacherId', '==', teacherId),
    orderBy('completedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    completedAt: d.data().completedAt?.toDate() ?? new Date(),
  })) as Attempt[];
}

export async function getAllAttempts(): Promise<Attempt[]> {
  const q = query(collection(db(), 'attempts'), orderBy('completedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    completedAt: d.data().completedAt?.toDate() ?? new Date(),
  })) as Attempt[];
}

export async function getAllProfiles(): Promise<Profile[]> {
  const snap = await getDocs(collection(db(), 'profiles'));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  })) as Profile[];
}
