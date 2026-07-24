import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length 
  ? getApp() 
  : (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? initializeApp(firebaseConfig) : null as any);
const auth = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? getAuth(app) : null as any;
const googleProvider = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? new GoogleAuthProvider() : null as any;
const db = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? getFirestore(app, '(default)') : null as any;

export { app, auth, googleProvider, db };
