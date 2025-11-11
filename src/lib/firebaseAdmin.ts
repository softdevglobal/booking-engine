import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Determine if Admin SDK is properly configured (service account or ADC)
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawPrivateKey?.replace(/\\n/g, '\n');

export const isAdminConfigured =
	Boolean((projectId && clientEmail && privateKey) || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_APPLICATION_CREDENTIALS);

if (isAdminConfigured && getApps().length === 0) {
	initializeApp({
		credential: cert({
			projectId: projectId as string,
			clientEmail: clientEmail as string,
			privateKey: privateKey as string,
		}),
		projectId: projectId as string,
	});
}

// Only valid when isAdminConfigured === true; routes should guard before using
export const adminDb = isAdminConfigured ? getFirestore() : (undefined as unknown as FirebaseFirestore.Firestore);
export { FieldValue };


