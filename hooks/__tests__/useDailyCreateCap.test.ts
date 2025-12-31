import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockAuth = { currentUser: null as null | { uid: string } };
jest.mock('../../lib/firebase', () => ({
    auth: mockAuth,
}));

const mockEnsureUserTimeZone = jest.fn();
const mockFetchDailyCreateState = jest.fn();
const mockIncrementDailyCreateCount = jest.fn();

jest.mock('../../lib/dailyCreateCap', () => ({
    ensureUserTimeZone: (userId: string) => mockEnsureUserTimeZone(userId),
    fetchDailyCreateState: (userId: string) => mockFetchDailyCreateState(userId),
    incrementDailyCreateCount: (userId: string) => mockIncrementDailyCreateCount(userId),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useDailyCreateCap } = require('../useDailyCreateCap') as typeof import('../useDailyCreateCap');

describe('hooks/useDailyCreateCap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.currentUser = null;
        mockEnsureUserTimeZone.mockResolvedValue(undefined);
        mockFetchDailyCreateState.mockResolvedValue({
            timeZone: 'UTC',
            todayKey: '2025-01-01',
            countToday: 0,
            limit: 1,
            remaining: 1,
        });
        mockIncrementDailyCreateCount.mockResolvedValue({
            timeZone: 'UTC',
            todayKey: '2025-01-01',
            countToday: 1,
            limit: 1,
            remaining: 0,
        });
    });

    it('defaults to 0 used when signed out', async () => {
        mockAuth.currentUser = null;
        const { result } = renderHook(() => useDailyCreateCap());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.countToday).toBe(0);
        expect(result.current.remaining).toBe(1);
        expect(mockFetchDailyCreateState).not.toHaveBeenCalled();
    });

    it('loads from Firestore when signed in', async () => {
        mockAuth.currentUser = { uid: 'user-1' };
        mockFetchDailyCreateState.mockResolvedValueOnce({
            timeZone: 'America/Los_Angeles',
            todayKey: '2025-12-30',
            countToday: 3,
            limit: 5,
            remaining: 2,
        });

        const { result } = renderHook(() => useDailyCreateCap());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(mockEnsureUserTimeZone).toHaveBeenCalledWith('user-1');
        expect(mockFetchDailyCreateState).toHaveBeenCalledWith('user-1');
        expect(result.current.countToday).toBe(3);
        expect(result.current.remaining).toBe(2);
    });

    it('increments the current day count', async () => {
        mockAuth.currentUser = { uid: 'user-1' };
        mockFetchDailyCreateState.mockResolvedValueOnce({
            timeZone: 'UTC',
            todayKey: '2025-12-30',
            countToday: 2,
            limit: 3,
            remaining: 1,
        });
        mockIncrementDailyCreateCount.mockResolvedValueOnce({
            timeZone: 'UTC',
            todayKey: '2025-12-30',
            countToday: 3,
            limit: 3,
            remaining: 0,
        });

        const { result } = renderHook(() => useDailyCreateCap());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.increment();
        });

        expect(mockIncrementDailyCreateCount).toHaveBeenCalledWith('user-1');
        expect(result.current.countToday).toBe(3);
        expect(result.current.remaining).toBe(0);
    });

    it('surfaces refresh errors', async () => {
        mockAuth.currentUser = { uid: 'user-1' };
        mockFetchDailyCreateState.mockRejectedValueOnce(new Error('boom'));

        const { result } = renderHook(() => useDailyCreateCap());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toContain('boom');
    });
});
