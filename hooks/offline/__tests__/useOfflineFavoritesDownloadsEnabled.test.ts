import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOfflineFavoritesDownloadsEnabled } from '../useOfflineFavoritesDownloadsEnabled';

const mockClearOfflineFavoritesAudioCache = jest.fn();
jest.mock('../../../lib/audioCache', () => ({
    clearOfflineFavoritesAudioCache: () => mockClearOfflineFavoritesAudioCache(),
}));

const mockGetOfflineFavoritesDownloadsEnabled = jest.fn();
const mockSetOfflineFavoritesDownloadsEnabled = jest.fn();
const mockSubscribeOfflineFavoritesDownloadsEnabled = jest.fn();

let lastSubscriber: ((value: boolean) => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock('../../../lib/offlineFavoritesDownloads', () => ({
    getOfflineFavoritesDownloadsEnabled: () => mockGetOfflineFavoritesDownloadsEnabled(),
    setOfflineFavoritesDownloadsEnabled: (next: boolean) => mockSetOfflineFavoritesDownloadsEnabled(next),
    subscribeOfflineFavoritesDownloadsEnabled: (cb: (value: boolean) => void) => {
        lastSubscriber = cb;
        mockSubscribeOfflineFavoritesDownloadsEnabled(cb);
        return mockUnsubscribe;
    },
}));

describe('hooks/offline/useOfflineFavoritesDownloadsEnabled', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        lastSubscriber = null;
        mockGetOfflineFavoritesDownloadsEnabled.mockResolvedValue(false);
        mockSetOfflineFavoritesDownloadsEnabled.mockResolvedValue(undefined);
        mockClearOfflineFavoritesAudioCache.mockResolvedValue(undefined);
    });

    it('loads initial enabled state and subscribes for changes', async () => {
        mockGetOfflineFavoritesDownloadsEnabled.mockResolvedValueOnce(true);

        const { result, unmount } = renderHook(() => useOfflineFavoritesDownloadsEnabled());

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.enabled).toBe(true);
        expect(mockSubscribeOfflineFavoritesDownloadsEnabled).toHaveBeenCalled();

        act(() => {
            lastSubscriber?.(false);
        });
        expect(result.current.enabled).toBe(false);

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('updates and persists when toggled', async () => {
        const { result } = renderHook(() => useOfflineFavoritesDownloadsEnabled());

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.setEnabled(true);
        });

        expect(mockSetOfflineFavoritesDownloadsEnabled).toHaveBeenCalledWith(true);
        expect(mockClearOfflineFavoritesAudioCache).not.toHaveBeenCalled();
        expect(result.current.enabled).toBe(true);
    });

    it('clears cached favorites when disabled', async () => {
        mockGetOfflineFavoritesDownloadsEnabled.mockResolvedValueOnce(true);

        const { result } = renderHook(() => useOfflineFavoritesDownloadsEnabled());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.enabled).toBe(true);

        await act(async () => {
            await result.current.setEnabled(false);
        });

        expect(mockClearOfflineFavoritesAudioCache).toHaveBeenCalled();
        expect(mockSetOfflineFavoritesDownloadsEnabled).toHaveBeenCalledWith(false);
        expect(result.current.enabled).toBe(false);
    });
});
