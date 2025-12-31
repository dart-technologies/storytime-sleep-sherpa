
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mocks
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    // Work around missing `call` in some environments.
    Reanimated.default.call = () => {};
    return Reanimated;
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    Tabs: { Screen: ({ options }: any) => null },
}));

const mockTrackFavorite = jest.fn();
jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackFavorite: mockTrackFavorite,
    },
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: mockImpactAsync,
    notificationAsync: mockNotificationAsync,
    ImpactFeedbackStyle: {
        Light: 'Light',
        Medium: 'Medium',
    },
    NotificationFeedbackType: {
        Success: 'Success',
    },
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

const mockStartVoiceSearch = jest.fn();
const mockStopVoiceSearch = jest.fn();
jest.mock('../../hooks/useVoiceNavigation', () => ({
    useVoiceNavigation: () => ({
        searchQuery: '',
        isListening: false,
        startVoiceSearch: mockStartVoiceSearch,
        stopVoiceSearch: mockStopVoiceSearch,
        status: 'disconnected',
    }),
}));

const mockStories: any[] = [];
const mockToggleFavorite = jest.fn();
const mockRefresh = jest.fn();
jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        myStories: mockStories,
        featuredStories: [],
        loading: false,
        refresh: mockRefresh,
        deleteStory: jest.fn(),
        toggleFavorite: mockToggleFavorite,
    }),
}));

const mockPlayStory = jest.fn();
jest.mock('../../components/AudioProvider', () => ({
    useAudioPlayback: () => ({
        playStory: mockPlayStory,
        currentUrl: null,
        isPlaying: false,
    }),
    useAudioSettings: () => ({ chaosMode: false, toggleChaosMode: jest.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LibraryScreen = require('../../app/(tabs)/library').default;

// StoryCard is internal to LibraryScreen.

describe('LibraryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStories.length = 0;
    });

    it('renders empty state and can start creating', () => {
        const { getByText } = render(<LibraryScreen />);
        expect(getByText('No dreams found')).toBeTruthy();
        fireEvent.press(getByText('Create Your First Dream').parent as any);
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/create');
    });

    it('navigates to playback when a story card is pressed', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            personaName: 'Luna',
            summary: 'A journey to the moon',
            duration: 120,
            createdAt: Date.now(),
            isPublic: false,
            isFavorite: false,
        });

        const { getByTestId, getByText } = render(<LibraryScreen />);
        expect(getByText('Moon Journey')).toBeTruthy();

        fireEvent.press(getByTestId('library-story-card-s1'));
        expect(mockPush).toHaveBeenCalledWith({ pathname: '/library/[storyId]', params: { storyId: 's1' } });
        expect(mockImpactAsync).toHaveBeenCalled();
    });

    it('navigates to remix with narrative context', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            personaName: 'Luna',
            summary: 'A journey to the moon',
            narrative: 'The rocket sings through starlight.',
            duration: 120,
            createdAt: Date.now(),
            isPublic: false,
            isFavorite: false,
        });

        const { getByTestId } = render(<LibraryScreen />);
        fireEvent.press(getByTestId('library-story-remix-s1'));
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/(tabs)/create',
            params: { remixId: 's1', remixTitle: 'Moon Journey', remixContext: 'The rocket sings through starlight.' },
        });
    });

    it('toggles favorite and tracks analytics', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            personaName: 'Luna',
            summary: 'A journey to the moon',
            duration: 120,
            createdAt: Date.now(),
            isPublic: false,
            isFavorite: false,
        });

        const { getByTestId } = render(<LibraryScreen />);
        fireEvent.press(getByTestId('library-story-favorite-s1'));
        expect(mockToggleFavorite).toHaveBeenCalledWith('s1', false);
        expect(mockTrackFavorite).toHaveBeenCalledWith('s1', true);
        expect(mockNotificationAsync).toHaveBeenCalled();
    });
});
