# AI Hallucination Detector

A [Next.js](https://nextjs.org) + Firebase app where teachers test their ability to spot AI-fabricated details in subject passages. Teachers take 3-question sessions, highlighting the text they believe is hallucinated; the server scores each attempt and tracks accuracy over time. Admins manage the question bank and see aggregate stats.

## Architecture

- **Client** (`src/app`): React pages using the Firebase client SDK for auth, profile reads, the dashboard, and admin question CRUD.
- **API routes** (`src/app/api`): quiz-taking goes through these. They use the Firebase **Admin SDK**, verify the caller's ID token, and:
  - serve questions **without** the answer key (`GET /api/questions/[id]`),
  - create sessions with server-picked questions (`POST /api/sessions`),
  - score attempts **server-side** and update the session atomically and idempotently (`POST /api/attempts`),
  - reveal answers only after the session is complete (`GET /api/sessions/[id]/results`).
- **Scoring** (`src/lib/scoring.ts`): character-level F1 — both missed hallucinations and over-highlighting reduce the score, so highlighting the whole passage scores near zero.
- **Security rules** (`firestore.rules`): teachers can only read their own data; questions are admin-only via the client SDK; attempts and sessions are server-write-only. Deploy with `firebase deploy --only firestore:rules`.

## Getting Started

1. Copy `.env.local.example` to `.env.local` and fill in:
   - the `NEXT_PUBLIC_FIREBASE_*` web app config, and
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — the JSON of a service account key, used by the API routes.
2. Deploy the security rules: `firebase deploy --only firestore:rules`.
3. Seed the question bank (requires an admin account):

   ```bash
   node scripts/seed-questions.mjs your@email.com
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

To make a user an admin, set `role: "admin"` on their document in the `profiles` collection (Firebase console or Admin SDK) — self-service role changes are blocked by the rules.

## Development

```bash
npm run lint   # ESLint
npm test       # unit tests (vitest)
npm run build  # production build
```

CI runs all of the above on every push and pull request (`.github/workflows/ci.yml`).
