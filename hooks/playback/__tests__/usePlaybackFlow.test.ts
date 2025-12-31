import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSetAudioModeAsync = jest.fn();
jest.mock('expo-audio', () => ({
    setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
}));

const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: (...args: any[]) => mockImpactAsync(...args),
    notificationAsync: (...args: any[]) => mockNotificationAsync(...args),
    ImpactFeedbackStyle: { Light: 'Light' },
    NotificationFeedbackType: { Success: 'Success' },
}));

const mockTrackPlaybackStart = jest.fn();
const mockTrackShare = jest.fn();
const mockTrackFavorite = jest.fn();
const mockTrackPlaybackComplete = jest.fn();
const mockTrackStoryDeleted = jest.fn();
jest.mock('../../../services/analytics', () => ({
    AnalyticsService: {
        trackPlaybackStart: (...args: any[]) => mockTrackPlaybackStart(...args),
        trackShare: (...args: any[]) => mockTrackShare(...args),
        trackFavorite: (...args: any[]) => mockTrackFavorite(...args),
        trackPlaybackComplete: (...args: any[]) => mockTrackPlaybackComplete(...args),
        trackStoryDeleted: (...args: any[]) => mockTrackStoryDeleted(...args),
    },
}));

jest.mock('../../../lib/shareLinks', () => ({
    getStoryShareUrl: (storyId: string) => `https://example.com/s/${encodeURIComponent(storyId)}`,
}));

const mockGetCachedAudioPath = jest.fn(async (_fileName: string): Promise<string | null> => null);
const mockCacheAudio = jest.fn(async (_url: string, fileName: string) => `file:///cache/${fileName}`);
jest.mock('../../../lib/audioCache', () => ({
    cacheAudio: (url: string, fileName: string) => mockCacheAudio(url, fileName),
    getCachedAudioPath: (fileName: string) => mockGetCachedAudioPath(fileName),
}));

jest.mock('../../../lib/assetMapper', () => ({
    getPersonaAvatar: (id: string) => `avatar:${id}`,
    getSoundscapeAsset: (id: string) => `soundscape:${id}`,
    SOUNDSCAPE_OPTIONS: [{ id: 'falling-snow', emoji: '❄️', label: 'Falling Snow' }],
}));

jest.mock('../useCoverTransition', () => ({
    useCoverTransition: () => ({
        artworkRef: { current: null },
        handleArtworkLayout: jest.fn(),
        isCoverTransitionActive: false,
        overlayStyle: {},
    }),
}));

let mockMyStories: any[] = [];
let mockFeaturedStories: any[] = [];
const mockDeleteStory = jest.fn(async (_id: string) => undefined);
const mockToggleFavorite = jest.fn(async (_id: string, _isFavorite: boolean) => undefined);
jest.mock('../../useStories', () => ({
    useStories: () => ({
        myStories: mockMyStories,
        featuredStories: mockFeaturedStories,
        deleteStory: (id: string) => mockDeleteStory(id),
        toggleFavorite: (id: string, isFavorite: boolean) => mockToggleFavorite(id, isFavorite),
    }),
}));

const mockPlayStory = jest.fn();
const mockTogglePlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockResumePlayback = jest.fn();
const mockSetAmbientSound = jest.fn();
const mockStoryPlayerPause = jest.fn();

let mockIsPlaying = false;
let mockDidJustFinish = false;

jest.mock('../../usePlayback', () => ({
    usePlayback: (_persona: any) => ({
        playStory: (...args: any[]) => mockPlayStory(...args),
        pausePlayback: (...args: any[]) => mockPausePlayback(...args),
        resumePlayback: (...args: any[]) => mockResumePlayback(...args),
        togglePlayback: (...args: any[]) => mockTogglePlayback(...args),
        isPlaying: mockIsPlaying,
        storyPlayer: { playing: mockIsPlaying, pause: mockStoryPlayerPause },
        setAmbientSound: (...args: any[]) => mockSetAmbientSound(...args),
        didJustFinish: mockDidJustFinish,
        atmosphereType: 'cosmic',
    }),
}));

jest.mock('../../offline/useOfflineFavoritesDownloadsEnabled', () => ({
    useOfflineFavoritesDownloadsEnabled: () => ({ enabled: false, loading: false, setEnabled: jest.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { usePlaybackFlow } = require('../usePlaybackFlow') as typeof import('../usePlaybackFlow');

describe('hooks/playback/usePlaybackFlow', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => { });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const dimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 390, height: 844 });

    beforeEach(() => {
        jest.clearAllMocks();
        mockMyStories = [];
        mockFeaturedStories = [];
        mockIsPlaying = false;
        mockDidJustFinish = false;
        mockGetCachedAudioPath.mockImplementation(async () => null);
        mockCacheAudio.mockImplementation(async (_url: string, fileName: string) => `file:///cache/${fileName}`);
    });

    afterAll(() => {
        alertSpy.mockRestore();
        shareSpy.mockRestore();
        dimensionsSpy.mockRestore();
    });

    function render(params: Partial<Parameters<typeof usePlaybackFlow>[0]> = {}) {
        const baseParams = {
            storyId: 'story-1',
            autoplay: undefined,
            personaId: undefined,
            coverUri: undefined,
            coverX: undefined,
            coverY: undefined,
            coverW: undefined,
            coverH: undefined,
        };
        return renderHook(() => usePlaybackFlow({ ...baseParams, ...params }));
    }

    it('plays a story when toggling play for the first time', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        const { result } = render();

        act(() => {
            result.current.handleTogglePlay();
        });

        await waitFor(() => expect(mockPlayStory).toHaveBeenCalledWith('https://example.com/audio.mp3'));
        expect(mockTrackPlaybackStart).toHaveBeenCalledWith('story-1', 'luna');
    });

    it('alerts when audioUrl is missing', () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            createdAt: 0,
            isPublic: false,
        }];

        const { result } = render();

        act(() => {
            result.current.handleTogglePlay();
        });

        expect(Alert.alert).toHaveBeenCalledWith('Narration Not Ready', expect.any(String));
        expect(mockPlayStory).not.toHaveBeenCalled();
    });

    it('toggles playback when already playing', () => {
        mockIsPlaying = true;
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        const { result } = render();

        act(() => {
            result.current.handleTogglePlay();
        });

        expect(mockPausePlayback).toHaveBeenCalled();
        expect(mockPlayStory).not.toHaveBeenCalled();
    });

    it('autoplays when the autoplay param is set', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        render({ autoplay: '1' });

        await waitFor(() => expect(mockPlayStory).toHaveBeenCalledWith('https://example.com/audio.mp3'));
        expect(mockTrackPlaybackStart).toHaveBeenCalled();
    });

    it('configures ambient sound based on story soundscapeId', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            soundscapeId: 'falling-snow',
            createdAt: 0,
            isPublic: false,
        }];

        render();

        await waitFor(() => expect(mockSetAmbientSound).toHaveBeenCalledWith('soundscape:falling-snow'));
    });

    it('builds and shares a message with a share link', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            duration: 300,
            isPublic: false,
        }];

        const { result } = render();

        await act(async () => {
            await result.current.handleShare();
        });

        expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Title',
            message: expect.stringContaining('https://example.com/s/story-1'),
        }));
        expect(mockTrackShare).toHaveBeenCalledWith('story-1', { shareKind: 'share_link' });
    });

    it('exports audio for owned stories', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        const { result } = render();

        await act(async () => {
            await result.current.handleSaveAudio();
        });

        expect(mockCacheAudio).toHaveBeenCalledWith('https://example.com/audio.mp3', 'Storytime-Sleep-Sherpa_Luna_Title_story-1.mp3');
        expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Title',
            url: 'file:///cache/Storytime-Sleep-Sherpa_Luna_Title_story-1.mp3',
        }));
    });

    it('uses cached audio when exporting owned stories', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        mockGetCachedAudioPath.mockResolvedValueOnce('file:///cache/existing.mp3');

        const { result } = render();

        await act(async () => {
            await result.current.handleSaveAudio();
        });

        expect(mockCacheAudio).not.toHaveBeenCalled();
        expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
            url: 'file:///cache/existing.mp3',
        }));
    });

    it('does not export audio for featured stories', async () => {
        mockFeaturedStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: true,
        }];

        const { result } = render();

        await act(async () => {
            await result.current.handleSaveAudio();
        });

        expect(mockCacheAudio).not.toHaveBeenCalled();
        expect(Share.share).not.toHaveBeenCalled();
    });

    it('allows favoriting public stories', () => {
        mockFeaturedStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: true,
        }];

        const { result } = render();

        act(() => {
            result.current.handleToggleFavorite();
        });

        expect(Alert.alert).not.toHaveBeenCalled();
        expect(mockToggleFavorite).toHaveBeenCalledWith('story-1', false);
    });

    it('deletes an owned story when confirming the alert', async () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        alertSpy.mockImplementationOnce((_title, _message, buttons) => {
            const deleteButton = buttons?.find((b: any) => b.text === 'Delete');
            deleteButton?.onPress?.();
        });

        const { result } = render();

        act(() => {
            result.current.handleDelete();
        });

        await waitFor(() => expect(mockDeleteStory).toHaveBeenCalledWith('story-1'));
        expect(mockRouter.replace).toHaveBeenCalledWith('/library');
        expect(mockSetAmbientSound).toHaveBeenCalledWith(null);
    });

    it('handles back navigation by pausing and clearing ambient', () => {
        mockMyStories = [{
            id: 'story-1',
            personaId: 'luna',
            personaName: 'Luna',
            title: 'Title',
            summary: 'Summary',
            audioUrl: 'https://example.com/audio.mp3',
            createdAt: 0,
            isPublic: false,
        }];

        const { result } = render();

        act(() => {
            result.current.handleBack();
        });

        expect(mockStoryPlayerPause).toHaveBeenCalled();
        expect(mockSetAmbientSound).toHaveBeenCalledWith(null);
        expect(mockRouter.replace).toHaveBeenCalledWith('/library');
    });
});
