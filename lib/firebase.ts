import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { initializeApp, getApp, getApps } from '@react-native-firebase/app';
import { isVerboseDebugLoggingEnabled } from './debugLogger';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Initialize Firebase
const app = (!getApps().length ? initializeApp(firebaseConfig) : getApp()) as any;

const auth = getAuth(app);
const firestore = getFirestore(app);

export async function getFirebaseIdToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const startMs = Date.now();
    const token = await getIdToken(user);
    if (isVerboseDebugLoggingEnabled()) {
        // eslint-disable-next-line no-console
        console.log('[Auth] getFirebaseIdToken', {
            uid: user.uid,
            ms: Date.now() - startMs,
            tokenLength: token.length,
        });
    }
    return token;
}

export { app, auth, firestore };
