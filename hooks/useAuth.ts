import { useCallback, useEffect, useMemo, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AppleAuthProvider, onAuthStateChanged, FirebaseAuthTypes, GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { auth } from '../lib/firebase';
import { AnalyticsService } from '../services/analytics';

GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export function useAuth() {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
            void AnalyticsService.setUserId(user?.uid || null);
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = useCallback(async () => {
        void AnalyticsService.trackLoginAttempt('google');
        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            if (response?.type !== 'success') {
                return;
            }

            let idToken = typeof response.data?.idToken === 'string' ? response.data.idToken.trim() : '';
            let accessToken = '';

            if (typeof GoogleSignin.getTokens === 'function') {
                try {
                    const tokens = await GoogleSignin.getTokens();
                    if (!idToken && typeof tokens?.idToken === 'string') {
                        idToken = tokens.idToken.trim();
                    }
                    if (typeof tokens?.accessToken === 'string') {
                        accessToken = tokens.accessToken.trim();
                    }
                } catch {
                    // ignore
                }
            }

            if (!idToken) {
                throw new Error('Google Sign-In did not return an ID token. Check EXPO_PUBLIC_GOOGLE_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.');
            }

            const googleCredential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
            const credential = await signInWithCredential(auth, googleCredential);
            const isNewUser = Boolean((credential as any)?.additionalUserInfo?.isNewUser);
            void AnalyticsService.trackLogin('google', { isNewUser });
            return credential;
        } catch (error) {
            const code = typeof (error as any)?.code === 'string' ? (error as any).code : undefined;
            const isCancelled = code === 'SIGN_IN_CANCELLED' || code === '12501';
            if (!isCancelled) {
                void AnalyticsService.trackLoginError('google', { code });
            }
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    }, []);

    const signInWithApple = useCallback(async () => {
        void AnalyticsService.trackLoginAttempt('apple');
        try {
            const csrf = Math.random().toString(36).substring(2, 10);
            const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, csrf);

            const appleCredential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce,
            });

            const { identityToken } = appleCredential;
            if (!identityToken) throw new Error('No identity token found');

            const credential = AppleAuthProvider.credential(identityToken, csrf);

            const result = await signInWithCredential(auth, credential);
            const isNewUser = Boolean((result as any)?.additionalUserInfo?.isNewUser);
            void AnalyticsService.trackLogin('apple', { isNewUser });
            return result;
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                return;
            }
            const code = typeof error?.code === 'string' ? error.code : undefined;
            void AnalyticsService.trackLoginError('apple', { code });
            console.error('Apple Sign-In Error:', error);
            throw error;
        }
    }, []);

    const signOut = useCallback(async () => {
        try {
            await GoogleSignin.signOut();
            await firebaseSignOut(auth);
            void AnalyticsService.trackLogout();
        } catch (error) {
            console.error('Sign-Out Error:', error);
        }
    }, []);

    return useMemo(() => ({ user, loading, signInWithGoogle, signInWithApple, signOut }), [user, loading, signInWithGoogle, signInWithApple, signOut]);
}
