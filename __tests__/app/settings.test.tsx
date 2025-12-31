import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('expo-constants', () => ({
    expoConfig: { version: '1.2.3' },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

jest.mock('../../components/TabHeader', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return {
        TabHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    };
});

const mockSignOut = jest.fn(async () => undefined);
let mockUser: any = { displayName: 'Michael C', photoURL: null };
jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: mockUser, signOut: () => mockSignOut() }),
}));

const mockSetOfflineFavoritesEnabled = jest.fn();
jest.mock('../../hooks/offline/useOfflineFavoritesDownloadsEnabled', () => ({
    useOfflineFavoritesDownloadsEnabled: () => ({
        enabled: false,
        loading: false,
        setEnabled: (next: boolean) => mockSetOfflineFavoritesEnabled(next),
    }),
}));

jest.mock('../../hooks/offline/useOfflineFavoritesDownloadsStats', () => ({
    useOfflineFavoritesDownloadsStats: () => ({
        summary: '2 eligible • 1 cached • ~10MB est. • 5MB on device',
    }),
}));

jest.mock('../../hooks/useDailyCreateCap', () => ({
    useDailyCreateCap: () => ({
        timeZone: 'UTC',
        countToday: 0,
        limit: 1,
        remaining: 1,
    }),
}));

jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        myStories: [
            { id: '1', playCount: 5, remixCount: 2, favoritedCount: 7 },
        ],
    }),
}));

let mockDebugEnabled = false;
jest.mock('../../lib/debugLogger', () => ({
    isDebugLoggingEnabled: () => mockDebugEnabled,
}));

const mockCrashlyticsLogNonFatal = jest.fn();
const mockCrashlyticsCrash = jest.fn();
jest.mock('../../services/crashlytics', () => ({
    CrashlyticsService: {
        logNonFatal: (...args: any[]) => mockCrashlyticsLogNonFatal(...args),
        crash: () => mockCrashlyticsCrash(),
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SettingsScreen = require('../../app/(tabs)/settings.native').default as typeof import('../../app/(tabs)/settings.native').default;

describe('app/(tabs)/settings.native', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDebugEnabled = false;
        mockUser = { displayName: 'Michael C', photoURL: null };
    });

    it('renders settings sections and toggles offline downloads', () => {
        const { getByTestId, getByText } = render(<SettingsScreen />);

        expect(getByText('Settings')).toBeTruthy();
        expect(getByText('Daily creates')).toBeTruthy();

        fireEvent(getByTestId('settings-offline-favorites-toggle'), 'valueChange', true);
        expect(mockSetOfflineFavoritesEnabled).toHaveBeenCalledWith(true);
    });

    it('logs out and optionally shows diagnostics', async () => {
        mockDebugEnabled = true;
        const { getByText } = render(<SettingsScreen />);

        await act(async () => {
            fireEvent.press((getByText('Log Out') as any).parent);
        });
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/auth/login');

        fireEvent.press((getByText('Send Test Error') as any).parent);
        expect(mockCrashlyticsLogNonFatal).toHaveBeenCalledWith('Test Non-Fatal Error');

        fireEvent.press((getByText('Test Crash') as any).parent);
        expect(mockCrashlyticsCrash).toHaveBeenCalled();
    });
});
