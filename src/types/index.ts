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
  sessionId?: string;
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

// ── API payloads ─────────────────────────────────────────────────────────────

/** Question as served to quiz takers — answers stripped. */
export type QuizQuestion = Omit<Question, 'hallucinations'>;

export interface SubjectCount {
  subject: string;
  count: number;
}

export interface SessionMeta {
  id: string;
  subject: string;
  questionIds: string[];
  attemptedQuestionIds: string[];
  completed: boolean;
}

export interface SubmitAttemptResult {
  attemptId: string;
  score: number;
  tp: number;
  fp: number;
  fn: number;
  sessionComplete: boolean;
  totalScore: number | null;
}

export interface SessionResultsPayload {
  session: { id: string; subject: string; questionIds: string[]; totalScore: number | null };
  attempts: Array<
    Pick<Attempt, 'id' | 'questionId' | 'highlights' | 'score' | 'tp' | 'fp' | 'fn' | 'timeTaken'>
  >;
  questions: Question[];
}
