import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { act, renderHook } from '@testing-library/react-native';
import { useAuth } from '../useAuth';

const mockAnalyticsSetUserId = jest.fn();
const mockTrackLoginAttempt = jest.fn();
const mockTrackLogin = jest.fn();
const mockTrackLoginError = jest.fn();
const mockTrackLogout = jest.fn();
const mockAppleSignInAsync = jest.fn();
const mockDigestStringAsync = jest.fn();

// Mock Firebase Auth
const mockFirebaseSignOut = jest.fn(async (..._args: any[]) => undefined);
jest.mock('@react-native-firebase/auth', () => ({
    onAuthStateChanged: jest.fn(),
    AppleAuthProvider: { credential: jest.fn(() => ({})) },
    GoogleAuthProvider: { credential: jest.fn(() => ({})) },
    OAuthProvider: jest.fn((_providerId: string) => ({ credential: jest.fn(() => ({})) })),
    signInWithCredential: jest.fn(),
    signOut: (...args: any[]) => mockFirebaseSignOut(...args),
}));

jest.mock('expo-apple-authentication', () => ({
    AppleAuthenticationScope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
    signInAsync: (...args: any[]) => mockAppleSignInAsync(...args),
}));

jest.mock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: (...args: any[]) => mockDigestStringAsync(...args),
}));

// Mock Google Sign-In
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(),
        signIn: jest.fn(),
        getTokens: jest.fn(),
        signOut: jest.fn(),
    },
}));

// Mock lib/firebase
jest.mock('../../lib/firebase', () => ({
    auth: {},
}));

jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        setUserId: (...args: any[]) => mockAnalyticsSetUserId(...args),
        trackLoginAttempt: (...args: any[]) => mockTrackLoginAttempt(...args),
        trackLogin: (...args: any[]) => mockTrackLogin(...args),
        trackLoginError: (...args: any[]) => mockTrackLoginError(...args),
        trackLogout: (...args: any[]) => mockTrackLogout(...args),
    },
}));

describe('useAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAppleSignInAsync.mockReset();
        mockDigestStringAsync.mockReset();
    });

    it('should initialize with loading state', () => {
        (onAuthStateChanged as jest.Mock).mockReturnValue(jest.fn());
        const { result } = renderHook(() => useAuth());
        expect(result.current.loading).toBe(true);
        expect(result.current.user).toBe(null);
    });

    it('should set user when auth state changes', async () => {
        let callback: any;
        (onAuthStateChanged as jest.Mock).mockImplementation((auth, cb) => {
            callback = cb;
            return jest.fn();
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            callback({ uid: 'test-uid', email: 'test@example.com' });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual({ uid: 'test-uid', email: 'test@example.com' });
        expect(mockAnalyticsSetUserId).toHaveBeenCalledWith('test-uid');
    });

    it('should sign in with Google on success', async () => {
        (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValueOnce(true);
        (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'success', data: { idToken: 'id-token' } });
        (signInWithCredential as jest.Mock).mockResolvedValueOnce({ additionalUserInfo: { isNewUser: true } });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.signInWithGoogle();
        });

        expect(mockTrackLoginAttempt).toHaveBeenCalledWith('google');
        expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('id-token', undefined);
        expect(signInWithCredential).toHaveBeenCalled();
        expect(mockTrackLogin).toHaveBeenCalledWith('google', { isNewUser: true });
    });

    it('does not track login error when Google sign-in is cancelled', async () => {
        (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValueOnce(true);
        (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'cancelled', data: null });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();
        });

        expect(mockTrackLoginAttempt).toHaveBeenCalledWith('google');
        expect(mockTrackLoginError).not.toHaveBeenCalled();
    });

    it('should sign in with Apple on success', async () => {
        mockDigestStringAsync.mockResolvedValueOnce('nonce-hash');
        mockAppleSignInAsync.mockResolvedValueOnce({ identityToken: 'apple-token' });
        (signInWithCredential as jest.Mock).mockResolvedValueOnce({ additionalUserInfo: { isNewUser: false } });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.signInWithApple();
        });

        expect(mockTrackLoginAttempt).toHaveBeenCalledWith('apple');
        expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA256', expect.any(String));
        expect(mockAppleSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'nonce-hash' }));
        expect(signInWithCredential).toHaveBeenCalled();
        expect(mockTrackLogin).toHaveBeenCalledWith('apple', { isNewUser: false });
    });

    it('does not throw when Apple sign-in is cancelled', async () => {
        mockDigestStringAsync.mockResolvedValueOnce('nonce-hash');
        mockAppleSignInAsync.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await expect(result.current.signInWithApple()).resolves.toBeUndefined();
        });

        expect(mockTrackLoginAttempt).toHaveBeenCalledWith('apple');
        expect(mockTrackLoginError).not.toHaveBeenCalled();
    });

    it('should handle sign out', async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.signOut();
        });

        expect(GoogleSignin.signOut).toHaveBeenCalled();
        expect(mockFirebaseSignOut).toHaveBeenCalled();
        expect(mockTrackLogout).toHaveBeenCalled();
    });

    it('should handle sign in error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValueOnce(new Error('Play Services Error'));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await expect(result.current.signInWithGoogle()).rejects.toThrow('Play Services Error');
        });

        expect(mockTrackLoginAttempt).toHaveBeenCalledWith('google');
        expect(mockTrackLoginError).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('should handle sign out error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(new Error('Sign-Out Error'));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.signOut();
        });

        expect(mockTrackLogout).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
