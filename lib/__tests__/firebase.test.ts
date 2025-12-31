const mockInitializeApp = jest.fn();
const mockGetApps = jest.fn();
const mockGetApp = jest.fn();
jest.mock('@react-native-firebase/app', () => ({
    initializeApp: (...args: any[]) => mockInitializeApp(...args),
    getApps: () => mockGetApps(),
    getApp: () => mockGetApp(),
}));

const mockGetAuth = jest.fn();
const mockGetIdToken = jest.fn();
jest.mock('@react-native-firebase/auth', () => ({
    getAuth: (...args: any[]) => mockGetAuth(...args),
    getIdToken: (...args: any[]) => mockGetIdToken(...args),
}));

const mockGetFirestore = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
    getFirestore: (...args: any[]) => mockGetFirestore(...args),
}));

jest.mock('../debugLogger', () => ({
    isDebugLoggingEnabled: () => false,
    isVerboseDebugLoggingEnabled: () => false,
}));

describe('lib/firebase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        mockGetApps.mockReturnValue([]);
    });

    it('initializes an app when none exist', () => {
        const mockApp = { name: 'app' };
        const mockAuthInstance = { currentUser: null };
        const mockFirestoreInstance = { name: 'firestore' };
        mockInitializeApp.mockReturnValueOnce(mockApp);
        mockGetAuth.mockReturnValueOnce(mockAuthInstance);
        mockGetFirestore.mockReturnValueOnce(mockFirestoreInstance);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const firebase = require('../firebase') as typeof import('../firebase');

        expect(mockInitializeApp).toHaveBeenCalled();
        expect(firebase.app).toBe(mockApp);
        expect(firebase.auth).toBe(mockAuthInstance);
        expect(firebase.firestore).toBe(mockFirestoreInstance);
    });

    it('uses the existing app when present', () => {
        const existingApp = { name: 'existing' };
        mockGetApps.mockReturnValueOnce([existingApp]);
        mockGetApp.mockReturnValueOnce(existingApp);
        mockGetAuth.mockReturnValueOnce({ currentUser: null });
        mockGetFirestore.mockReturnValueOnce({});

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const firebase = require('../firebase') as typeof import('../firebase');

        expect(firebase.app).toBe(existingApp);
        expect(mockGetApp).toHaveBeenCalled();
        expect(mockInitializeApp).not.toHaveBeenCalled();
    });

    it('throws when requesting an id token while signed out', async () => {
        mockInitializeApp.mockReturnValueOnce({ name: 'app' });
        mockGetAuth.mockReturnValueOnce({ currentUser: null });
        mockGetFirestore.mockReturnValueOnce({});

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const firebase = require('../firebase') as typeof import('../firebase');

        await expect(firebase.getFirebaseIdToken()).rejects.toThrow('Not signed in');
    });

    it('returns a firebase id token when signed in', async () => {
        const user = { uid: 'user-1' };
        mockInitializeApp.mockReturnValueOnce({ name: 'app' });
        mockGetAuth.mockReturnValueOnce({ currentUser: user });
        mockGetFirestore.mockReturnValueOnce({});
        mockGetIdToken.mockResolvedValueOnce('token-123');

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const firebase = require('../firebase') as typeof import('../firebase');

        await expect(firebase.getFirebaseIdToken()).resolves.toBe('token-123');
        expect(mockGetIdToken).toHaveBeenCalledWith(user);
    });
});
