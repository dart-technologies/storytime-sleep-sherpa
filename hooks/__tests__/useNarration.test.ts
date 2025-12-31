import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNarration } from '../useNarration';

jest.mock('../../lib/debugLogger', () => ({
    createRequestId: (prefix = 'req') => `${prefix}_test`,
    createFlowLogger: (_flowName: string, options?: { requestId?: string }) => {
        const requestId = options?.requestId || 'req_test';
        return {
            flowId: 'flow_test',
            requestId,
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            step: jest.fn(),
            end: jest.fn(),
        };
    },
}));

const mockGetFirebaseIdToken = jest.fn(async () => 'firebase-token');
jest.mock('../../lib/firebase', () => ({
    getFirebaseIdToken: () => mockGetFirebaseIdToken(),
    app: {},
    auth: { currentUser: null },
    firestore: {},
}));

describe('hooks/useNarration', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...oldEnv,
            EXPO_PUBLIC_CLOUD_FUNCTIONS_URL: 'https://example.com',
            EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE: '/narrate',
        };
        delete (globalThis as any).fetch;
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    it('narrates with a supplied token', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ audioUrl: 'https://example.com/audio.mp3', requestId: 'req-1', meta: { bytes: 10 } }),
        });

        const { result } = renderHook(() => useNarration());

        let response: { audioUrl: string; requestId?: string } | null = null;
        await act(async () => {
            response = await result.current.narrateStory({
                text: 'Hello',
                voiceId: 'voice-1',
                idToken: 'supplied',
            });
        });

        expect((response as { audioUrl: string; requestId?: string } | null)?.audioUrl).toBe('https://example.com/audio.mp3');
        expect(mockGetFirebaseIdToken).not.toHaveBeenCalled();
    });

    it('surfaces 401 errors with response detail', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: jest.fn().mockResolvedValue(JSON.stringify({ detail: { message: 'No access' } })),
            headers: { get: () => 'application/json' },
        });

        const { result } = renderHook(() => useNarration());

        let caught: unknown = null;
        await act(async () => {
            try {
                await result.current.narrateStory({
                    text: 'Hello',
                    voiceId: 'voice-1',
                });
            } catch (err) {
                caught = err;
            }
        });

        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toContain('Failed to narrate story: Unauthorized: No access');
        await waitFor(() => {
            expect(result.current.error).toContain('Failed to narrate story: Unauthorized: No access');
        });
    });
});
