import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
	apiKey: "AIzaSyAXkJB5pymjqwcTDc5DtH_CbDtXPIslsao",
	authDomain: "bms-pro-e3125.firebaseapp.com",
	projectId: "bms-pro-e3125",
	storageBucket: "bms-pro-e3125.firebasestorage.app",
	messagingSenderId: "95517764192",
	appId: "1:95517764192:web:a674c4c1aa55c314b23105"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const auth = getAuth(app);
// Ensure auth persists across tabs/sessions
setPersistence(auth, browserLocalPersistence).catch(() => {});
export default app;


