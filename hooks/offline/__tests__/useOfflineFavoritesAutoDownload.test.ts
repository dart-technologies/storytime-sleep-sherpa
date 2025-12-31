import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfflineFavoritesAutoDownload } from '../useOfflineFavoritesAutoDownload';

let mockEnabled = false;
jest.mock('../useOfflineFavoritesDownloadsEnabled', () => ({
    useOfflineFavoritesDownloadsEnabled: () => ({
        enabled: mockEnabled,
        loading: false,
        setEnabled: jest.fn(),
    }),
}));

let mockMyStories: any[] = [];
let mockFeaturedStories: any[] = [];
jest.mock('../../stories/useStoryTables', () => ({
    useStoryTables: () => ({
        myStories: mockMyStories,
        featuredStories: mockFeaturedStories,
    }),
}));

const mockCacheAudio = jest.fn();
const mockGetCachedAudioPath = jest.fn();
const mockClearOldCache = jest.fn();
jest.mock('../../../lib/audioCache', () => ({
    cacheAudio: (...args: any[]) => mockCacheAudio(...args),
    getCachedAudioPath: (...args: any[]) => mockGetCachedAudioPath(...args),
    clearOldCache: (...args: any[]) => mockClearOldCache(...args),
}));

describe('hooks/offline/useOfflineFavoritesAutoDownload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockEnabled = false;
        mockMyStories = [];
        mockFeaturedStories = [];
        mockCacheAudio.mockResolvedValue(undefined);
        mockGetCachedAudioPath.mockResolvedValue(null);
        mockClearOldCache.mockResolvedValue(undefined);
    });

    it('does nothing when disabled', async () => {
        mockEnabled = false;
        mockMyStories = [{ id: 'story-1', isFavorite: true, audioUrl: 'https://example.com/1.mp3' }];

        renderHook(() => useOfflineFavoritesAutoDownload());

        await Promise.resolve();
        expect(mockCacheAudio).not.toHaveBeenCalled();
    });

    it('downloads missing favorite audio when enabled', async () => {
        mockEnabled = true;
        mockMyStories = [
            { id: 'story-1', isFavorite: true, audioUrl: 'https://example.com/1.mp3' },
            { id: 'story-2', isFavorite: true, audioUrl: 'https://example.com/2.mp3' },
        ];

        mockGetCachedAudioPath.mockImplementation(async (fileName: string) => {
            if (fileName.includes('story-2')) return 'file:///cache/favorite_story-2.mp3';
            return null;
        });

        renderHook(() => useOfflineFavoritesAutoDownload());

        await waitFor(() => expect(mockCacheAudio).toHaveBeenCalledWith('https://example.com/1.mp3', expect.any(String)));
        await waitFor(() => expect(mockClearOldCache).toHaveBeenCalledWith(500));
    });
});

