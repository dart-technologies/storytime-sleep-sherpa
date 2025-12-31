
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

// Mocks
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-audio', () => ({
    setAudioModeAsync: jest.fn(),
}));

const mockReplace = jest.fn();
let mockSearchParams: any = { storyId: 's1', coverUri: 'http://cover.png' };
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ replace: mockReplace }),
    Stack: { Screen: () => null },
}));

const mockTrackPlaybackStart = jest.fn();
const mockTrackShare = jest.fn();
const mockTrackFavorite = jest.fn();
const mockTrackPlaybackComplete = jest.fn();
const mockTrackStoryDeleted = jest.fn();
jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackPlaybackStart: mockTrackPlaybackStart,
        trackShare: mockTrackShare,
        trackFavorite: mockTrackFavorite,
        trackPlaybackComplete: mockTrackPlaybackComplete,
        trackStoryDeleted: mockTrackStoryDeleted,
    },
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: mockImpactAsync,
    ImpactFeedbackStyle: {
        Light: 'Light',
    },
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
    LinearGradient: 'LinearGradient',
}));

jest.mock('expo-keep-awake', () => ({
    useKeepAwake: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

const mockStories: any[] = [];
const mockDeleteStory = jest.fn(() => Promise.resolve());
jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        myStories: mockStories,
        featuredStories: [],
        deleteStory: mockDeleteStory,
        toggleFavorite: jest.fn(),
    }),
}));

const mockPlayStory = jest.fn();
const mockTogglePlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockResumePlayback = jest.fn();
const mockSetAmbientSound = jest.fn();
const mockPause = jest.fn();
let mockPlaybackReturn: any = {
    playStory: mockPlayStory,
    pausePlayback: mockPausePlayback,
    resumePlayback: mockResumePlayback,
    togglePlayback: mockTogglePlayback,
    isPlaying: false,
    storyPlayer: { playing: false, pause: mockPause },
    setAmbientSound: mockSetAmbientSound,
    didJustFinish: false,
    atmosphereType: 'luna',
};

jest.mock('../../hooks/usePlayback', () => ({
    usePlayback: () => mockPlaybackReturn,
}));

jest.mock('../../components/AudioProvider', () => ({
    useAudioSettings: () => ({ chaosMode: false, isLowEnergyMode: false, toggleChaosMode: jest.fn() }),
}));

jest.mock('../../hooks/offline/useOfflineFavoritesDownloadsEnabled', () => ({
    useOfflineFavoritesDownloadsEnabled: () => ({ enabled: false, loading: false, setEnabled: jest.fn() }),
}));

jest.mock('../../lib/firebase', () => ({
    firestore: {},
    auth: { currentUser: { uid: 'test-user-id' } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PlaybackScreen = require('../../app/library/[storyId]').default;

describe('PlaybackScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStories.length = 0;
        mockSearchParams = { storyId: 's1', coverUri: 'http://cover.png' };
        mockPlaybackReturn = {
            playStory: mockPlayStory,
            pausePlayback: mockPausePlayback,
            resumePlayback: mockResumePlayback,
            togglePlayback: mockTogglePlayback,
            isPlaying: false,
            storyPlayer: { playing: false, pause: mockPause },
            setAmbientSound: mockSetAmbientSound,
            didJustFinish: false,
            atmosphereType: 'luna',
        };
    });

    it('renders correctly for existing story', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            audioUrl: 'http://audio.mp3',
            personaName: 'Luna',
            summary: 'Summary',
            isFavorite: false,
        });

        const { getAllByText } = render(<PlaybackScreen />);
        expect(getAllByText('Moon Journey').length).toBeGreaterThan(0);
    });

    it('plays the story when pressing play', async () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            audioUrl: 'http://audio.mp3',
            personaName: 'Luna',
            summary: 'Summary',
            isFavorite: false,
        });

        const { getByTestId } = render(<PlaybackScreen />);
        await act(async () => {
            fireEvent.press(getByTestId('playback-toggle-play'));
            await new Promise(process.nextTick);
        });
        expect(mockPlayStory).toHaveBeenCalledWith('http://audio.mp3');
        expect(mockTrackPlaybackStart).toHaveBeenCalledWith('s1', 'luna');
        expect(mockImpactAsync).toHaveBeenCalled();
    });

    it('navigates back to the library', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            audioUrl: 'http://audio.mp3',
            personaName: 'Luna',
            summary: 'Summary',
            isFavorite: false,
        });

        const { getByTestId } = render(<PlaybackScreen />);
        fireEvent.press(getByTestId('playback-back'));
        expect(mockPause).toHaveBeenCalled();
        expect(mockSetAmbientSound).toHaveBeenCalledWith(null);
        expect(mockReplace).toHaveBeenCalledWith('/library');
    });

    it('shows delete confirmation', () => {
        mockStories.push({
            id: 's1',
            title: 'Moon Journey',
            personaId: 'luna',
            audioUrl: 'http://audio.mp3',
            personaName: 'Luna',
            summary: 'Summary',
            isFavorite: false,
        });

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const { getByTestId } = render(<PlaybackScreen />);
        fireEvent.press(getByTestId('playback-more'));
        fireEvent.press(getByTestId('playback-action-delete'));
        expect(alertSpy).toHaveBeenCalled();

        const deleteConfirmCall = alertSpy.mock.calls.find((call) => call[0] === 'Delete Story?');
        expect(deleteConfirmCall).toBeTruthy();

        const buttons = deleteConfirmCall?.[2] as any[];
        const deleteButton = buttons.find((button) => button?.text === 'Delete');
        act(() => deleteButton.onPress());
        expect(mockReplace).toHaveBeenCalledWith('/library');
        expect(mockDeleteStory).toHaveBeenCalledWith('s1');
        alertSpy.mockRestore();
    });

    it('renders generic message if story not found', () => {
        const { getByText } = render(<PlaybackScreen />);
        // Usually renders "Story not found" based on my view earlier
        expect(getByText('Story not found')).toBeTruthy();
    });
});
