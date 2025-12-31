import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppProviders } from '../AppProviders';

const mockUseStoreSync = jest.fn();
jest.mock('../../hooks/useStore', () => ({
    useStoreSync: () => mockUseStoreSync(),
}));

jest.mock('../../hooks/offline/useOfflineFavoritesAutoDownload', () => ({
    useOfflineFavoritesAutoDownload: () => undefined,
}));

jest.mock('expo-updates', () => ({
    useUpdates: () => ({ isUpdateAvailable: false, isUpdatePending: false }),
}));

jest.mock('../../lib/elevenlabs', () => ({
    ElevenLabsProvider: ({ children }: any) => children,
}));

jest.mock('../AudioProvider', () => ({
    AudioProvider: ({ children }: any) => children,
}));

jest.mock('../ElevenLabsConversationProvider', () => ({
    ElevenLabsConversationProvider: ({ children }: any) => children,
}));

jest.mock('../ConnectivityBanner', () => () => null);
jest.mock('../EnvValidator', () => () => null);
jest.mock('../ErrorProvider', () => ({
    ErrorProvider: ({ children }: any) => children,
    useError: () => ({ showToast: jest.fn() }),
}));

describe('components/AppProviders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders children and runs store sync', () => {
        const { getByText } = render(
            <AppProviders>
                <Text>Hello</Text>
            </AppProviders>
        );

        expect(getByText('Hello')).toBeTruthy();
        expect(mockUseStoreSync).toHaveBeenCalled();
    });
});
