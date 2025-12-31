import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOfflineFavoritesDownloadsStats } from '../useOfflineFavoritesDownloadsStats';

let mockMyStories: any[] = [];
let mockFeaturedStories: any[] = [];
jest.mock('../../stories/useStoryTables', () => ({
    useStoryTables: () => ({
        myStories: mockMyStories,
        featuredStories: mockFeaturedStories,
    }),
}));

const mockGetAudioCacheStats = jest.fn();
const mockGetCachedAudioPath = jest.fn();
jest.mock('../../../lib/audioCache', () => ({
    getAudioCacheStats: () => mockGetAudioCacheStats(),
    getCachedAudioPath: (...args: any[]) => mockGetCachedAudioPath(...args),
}));

describe('hooks/offline/useOfflineFavoritesDownloadsStats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMyStories = [];
        mockFeaturedStories = [];
        mockGetAudioCacheStats.mockResolvedValue({ totalBytes: 0 });
        mockGetCachedAudioPath.mockResolvedValue(null);
    });

    it('summarizes eligible and cached favorites', async () => {
        mockMyStories = [
            { id: 'story-1', isFavorite: true, audioUrl: 'https://example.com/1.mp3', duration: 60 },
            { id: 'story-2', isFavorite: false, audioUrl: 'https://example.com/2.mp3', duration: 60 },
        ];
        mockFeaturedStories = [
            { id: 'story-1', isFavorite: true, audioUrl: 'https://example.com/1.mp3', duration: 60 },
            { id: 'story-3', isFavorite: true, audioUrl: 'https://example.com/3.mp3', duration: 120 },
        ];

        mockGetAudioCacheStats.mockResolvedValueOnce({ totalBytes: 5000 });
        mockGetCachedAudioPath.mockImplementation(async (fileName: string) => {
            if (fileName.includes('story-1')) return 'file:///cache/favorite_story-1.mp3';
            return null;
        });

        const { result } = renderHook(() => useOfflineFavoritesDownloadsStats());

        await waitFor(() => expect(result.current.cachedBytes).toBe(5000));
        expect(result.current.eligibleCount).toBe(2);
        expect(result.current.cachedEligibleCount).toBe(1);
        expect(result.current.summary).toContain('2 eligible');
        expect(result.current.summary).toContain('1 cached');

        mockGetAudioCacheStats.mockResolvedValueOnce({ totalBytes: 6000 });
        await act(async () => {
            await result.current.refresh();
        });
        expect(result.current.cachedBytes).toBe(6000);
    });

    it('tolerates cache lookup failures', async () => {
        mockMyStories = [
            { id: 'story-1', isFavorite: true, audioUrl: 'https://example.com/1.mp3', duration: 60 },
        ];
        mockGetCachedAudioPath.mockRejectedValueOnce(new Error('disk'));

        const { result } = renderHook(() => useOfflineFavoritesDownloadsStats());

        await waitFor(() => expect(result.current.eligibleCount).toBe(1));
        expect(result.current.cachedEligibleCount).toBe(0);
    });
});

