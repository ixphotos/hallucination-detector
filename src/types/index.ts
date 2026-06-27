export interface Hallucination {
  start: number;
  end: number;
  text: string;
  explanation: string;
}

export interface Question {
  id: string;
  subject: string;
  level: 'GCSE' | 'A-Level' | 'Both';
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
