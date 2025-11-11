import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK using environment variables if provided.
// Falls back to Application Default Credentials (ADC) if private key/envs are not set.
function initAdminApp() {
	const alreadyInitialized = getApps().length > 0;
	if (alreadyInitialized) return;

	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
	const privateKey = rawPrivateKey?.replace(/\\n/g, '\n');
	const fallbackProjectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || 'bms-pro-e3125';

	if (projectId && clientEmail && privateKey) {
		initializeApp({
			credential: cert({
				projectId,
				clientEmail,
				privateKey,
			}),
			projectId: projectId,
		});
	} else {
		// Use ADC if available; ensure projectId is provided for local dev
		if (!process.env.GOOGLE_CLOUD_PROJECT) {
			process.env.GOOGLE_CLOUD_PROJECT = fallbackProjectId;
			process.env.GCLOUD_PROJECT = fallbackProjectId;
		}
		initializeApp({
			projectId: fallbackProjectId,
		});
	}
}

initAdminApp();

export const adminDb = getFirestore();
export { FieldValue };


