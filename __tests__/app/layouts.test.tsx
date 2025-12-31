import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as any;

jest.mock('expo-status-bar', () => ({
    StatusBar: 'StatusBar',
}));

jest.mock('expo-router', () => {
    const StackScreen = jest.fn(() => null);
    const Stack = ({ children }: any) => children;
    (Stack as any).Screen = StackScreen;
    return { Stack, __StackScreen: StackScreen };
});

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('expo-asset', () => ({
    Asset: { loadAsync: jest.fn(async () => undefined) },
}));

const mockRegisterGlobals = jest.fn();
jest.mock('@livekit/react-native', () => ({
    registerGlobals: () => mockRegisterGlobals(),
}));

const mockInstallLiveKitWorkarounds = jest.fn();
jest.mock('../../lib/livekitWorkarounds', () => ({
    installLiveKitWorkarounds: () => mockInstallLiveKitWorkarounds(),
}));

jest.mock('../../components/AppProviders', () => ({
    AppProviders: ({ children }: any) => children,
}));

const mockGetAllPersonaAssets = jest.fn(() => []);
jest.mock('../../lib/assetMapper', () => ({
    getAllPersonaAssets: () => mockGetAllPersonaAssets(),
}));

let mockAuthState: any = { user: null, loading: true };
jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockAuthState,
}));

const mockCrashlyticsLogError = jest.fn();
jest.mock('../../services/crashlytics', () => ({
    CrashlyticsService: {
        logError: (...args: any[]) => mockCrashlyticsLogError(...args),
    },
}));

jest.mock('expo-router/html', () => ({
    ScrollViewStyleReset: () => null,
}));

jest.mock('../../lib/shareLinks', () => ({
    getWebBaseUrlFromEnv: () => 'https://example.com',
}));

describe('app layouts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthState = { user: null, loading: true };
        delete (global as any).ErrorUtils;
    });

    it('renders the native RootLayout loading state', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const RootLayoutNative = require('../../app/_layout.native.tsx').default as typeof import('../../app/_layout.native').default;
        render(<RootLayoutNative />);
        expect(mockRegisterGlobals).toHaveBeenCalled();
        expect(mockInstallLiveKitWorkarounds).toHaveBeenCalled();
    });

    it('renders the native RootLayout after assets load', async () => {
        mockAuthState = { user: { uid: 'u1' }, loading: false };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const RootLayoutNative = require('../../app/_layout.native.tsx').default as typeof import('../../app/_layout.native').default;
        const { __StackScreen } = require('expo-router') as any;

        render(<RootLayoutNative />);

        await waitFor(() => expect(__StackScreen).toHaveBeenCalled());
    });

    it('registers a global error handler on web RootLayout', () => {
        let installedHandler: any = null;
        const defaultHandler = jest.fn();
        (global as any).ErrorUtils = {
            getGlobalHandler: () => defaultHandler,
            setGlobalHandler: (handler: any) => {
                installedHandler = handler;
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const RootLayoutWeb = require('../../app/_layout.tsx').default as typeof import('../../app/_layout').default;
        render(<RootLayoutWeb />);

        expect(typeof installedHandler).toBe('function');
        const err = new Error('boom');
        installedHandler(err, true);
        expect(mockCrashlyticsLogError).toHaveBeenCalledWith(err, 'GlobalHandler: Fatal');
        expect(defaultHandler).toHaveBeenCalledWith(err, true);
    });

    it('renders RootHtml for web exports', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const RootHtml = require('../../app/+html.tsx').default as typeof import('../../app/+html').default;
        expect(() => {
            renderer.create(
                <RootHtml>
                    {React.createElement('div', null, 'child')}
                </RootHtml>
            );
        }).not.toThrow();
    });
});
