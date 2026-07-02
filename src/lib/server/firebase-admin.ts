import 'server-only';
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/** Thrown when the Admin SDK cannot be configured — the message is safe to
 *  return to the client to make misconfiguration obvious during setup. */
export class AdminConfigError extends Error {}

export const CREDENTIALS_HINT =
  'Server is missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY in ' +
  '.env.local (see .env.local.example) to the single-line JSON of a service account key, ' +
  'then restart the server.';

let app: App | undefined;

function getAdminApp(): App {
  if (!app) {
    const existing = getApps();
    if (existing.length > 0) {
      app = existing[0];
    } else {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountKey) {
        let parsed: object;
        try {
          parsed = JSON.parse(serviceAccountKey);
        } catch {
          throw new AdminConfigError(
            'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the service account key ' +
              'as a single line, e.g. run: ' +
              'node -e "console.log(JSON.stringify(require(\'./serviceAccountKey.json\')))"'
          );
        }
        app = initializeApp({
          credential: cert(parsed),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else if (
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.FUNCTIONS_EMULATOR ||
        process.env.K_SERVICE ||
        process.env.GOOGLE_CLOUD_PROJECT
      ) {
        // Application Default Credentials are available (explicit key file or
        // a Google Cloud runtime).
        app = initializeApp({
          credential: applicationDefault(),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        throw new AdminConfigError(CREDENTIALS_HINT);
      }
    }
  }
  return app;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
