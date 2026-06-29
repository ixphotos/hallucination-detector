export interface Hallucination {
  start: number;
  end: number;
  text: string;
  explanation: string;
}

export interface Question {
  id: string;
  subject: string;
  level: 'GCSE' | 'A-Level' | 'Both' | 'General Knowledge';
  title: string;
  passage: string;
  hallucinations: Hallucination[];
}

export interface Highlight {
  start: number;
  end: number;
  text: string;
}

export interface Attempt {
  id?: string;
  teacherId: string;
  teacherName: string;
  questionId: string;
  subject: string;
  highlights: Highlight[];
  score: number;
  tp: number;
  fp: number;
  fn: number;
  timeTaken: number;
  completedAt: Date;
}

export interface QuizSession {
  id?: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  questionIds: string[];
  attemptIds: string[];
  totalScore: number | null;
  startedAt: Date;
  completedAt?: Date;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'admin';
  createdAt: Date;
}

export interface ScoreResult {
  score: number;
  tp: number;
  fp: number;
  fn: number;
  matchedHallucinations: number[];
  falsePositiveHighlights: number[];
}

// ── Image module ─────────────────────────────────────────────────────────────

export interface ImageFlaw {
  id: string;
  label: string;
  x: number;       // normalised 0–1
  y: number;
  radius: number;  // normalised hit-test radius
}

export interface ImageQuestion {
  id: string;
  mode: 'flaw-finder' | 'spot-the-fake';
  subject: string;
  level: 'GCSE' | 'A-Level';
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  hint?: string;
  active: boolean;
  licensingEnabled: boolean;
  copyright: {
    owner: string;
    source: string;
    status: 'cleared' | 'pending' | 'restricted';
    notes?: string;
  };
  // Flaw Finder
  imagePath?: string;
  imageAspectRatio?: number;
  flaws?: ImageFlaw[];
  // Spot the Fake
  realImagePath?: string;
  fakeImagePath?: string;
}

export interface ImageSession {
  id?: string;
  userId: string;
  mode: 'flaw-finder' | 'spot-the-fake' | 'mixed';
  questionIds: string[];
  attemptIds: string[];
  totalScore: number | null;
  startedAt: Date;
  completedAt?: Date;
  subjectFilter?: string;
}

export interface ClickMark {
  x: number;
  y: number;
  hitFlawId?: string;
}

export interface ImageAttempt {
  id?: string;
  sessionId: string;
  userId: string;
  questionId: string;
  mode: 'flaw-finder' | 'spot-the-fake';
  clicks?: ClickMark[];
  flawsHit?: string[];
  flawsMissed?: string[];
  chosenImage?: 'real' | 'fake';
  correct?: boolean;
  pointsEarned: number;
  timeSpentSeconds: number;
}
