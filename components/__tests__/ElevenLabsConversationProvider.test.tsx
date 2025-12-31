import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../lib/debugLogger', () => ({
    createRequestId: (prefix = 'req') => `${prefix}_test`,
    isDebugLoggingEnabled: () => false,
    isVerboseDebugLoggingEnabled: () => false,
    createFlowLogger: (_flowName: string, options?: { requestId?: string }) => ({
        requestId: options?.requestId || 'req_test',
        step: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        end: jest.fn(),
        log: jest.fn(),
    }),
}));

const mockGetFirebaseIdToken = jest.fn(async () => 'firebase-token');
jest.mock('../../lib/firebase', () => ({
    getFirebaseIdToken: () => mockGetFirebaseIdToken(),
    app: {},
    auth: { currentUser: null },
    firestore: {},
}));

const mockSetAudioForPlayback = jest.fn(async (..._args: any[]) => undefined);
const mockSetAudioForVoice = jest.fn(async (..._args: any[]) => undefined);
jest.mock('../elevenlabsConversation/audioSession', () => ({
    setAudioForPlayback: (...args: any[]) => mockSetAudioForPlayback(...args),
    setAudioForVoice: (...args: any[]) => mockSetAudioForVoice(...args),
}));

const mockClearLatencyMask = jest.fn();
const mockStopLatencyMask = jest.fn();
const mockPlayLatencyMask = jest.fn();
jest.mock('../elevenlabsConversation/useLatencyMaskAudio', () => ({
    useLatencyMaskAudio: () => ({
        playingMaskType: null,
        isPlayingMask: false,
        playLatencyMask: (...args: any[]) => mockPlayLatencyMask(...args),
        stopLatencyMask: (...args: any[]) => mockStopLatencyMask(...args),
        clearLatencyMask: (...args: any[]) => mockClearLatencyMask(...args),
    }),
}));

jest.mock('../AudioProvider', () => ({
    useAudioPlayback: () => ({ ambientPlayer: null }),
}));

const mockStartSession = jest.fn(async (..._args: any[]) => undefined);
const mockEndSession = jest.fn(async (..._args: any[]) => undefined);
const conversation: any = {
    status: 'disconnected',
    startSession: (...args: any[]) => mockStartSession(...args),
    endSession: (...args: any[]) => mockEndSession(...args),
};

let lastConversationConfig: any = null;
jest.mock('../../lib/elevenlabs', () => ({
    useConversation: (config: any) => {
        lastConversationConfig = config;
        return conversation;
    },
}));

describe('components/ElevenLabsConversationProvider', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        lastConversationConfig = null;
        conversation.status = 'disconnected';
        process.env = {
            ...oldEnv,
            EXPO_PUBLIC_CLOUD_FUNCTIONS_URL: 'https://example.com',
            EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN: '/elevenlabsToken',
        };
        delete (globalThis as any).fetch;
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    function renderConversation() {
        const { ElevenLabsConversationProvider, useElevenLabsConversation } = require('../ElevenLabsConversationProvider') as typeof import('../ElevenLabsConversationProvider');
        const wrapper = ({ children }: { children: any }) => (
            <ElevenLabsConversationProvider>{children}</ElevenLabsConversationProvider>
        );
        return renderHook(() => useElevenLabsConversation(), { wrapper });
    }

    it('starts a conversation by fetching a token and starting a session', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({ token: 'conv_token' })),
            headers: { get: () => 'application/json' },
        });

        const { result } = renderConversation();

        await act(async () => {
            await result.current.startConversation({ id: 'luna', agentId: 'agent_123' } as any);
        });

        expect(result.current.tokenFetchUrl).toBe('https://example.com/elevenlabsToken');
        expect(mockGetFirebaseIdToken).toHaveBeenCalled();
        expect((globalThis as any).fetch).toHaveBeenCalledWith(
            expect.stringContaining('agent_id=agent_123'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer firebase-token' }) })
        );
        expect(mockStartSession).toHaveBeenCalledWith(expect.objectContaining({ conversationToken: 'conv_token' }));
    });

    it('subscribes to intake completion events from the client tool', async () => {
        const { result } = renderConversation();

        const onIntakeComplete = jest.fn();
        act(() => {
            result.current.subscribe({ onIntakeComplete });
        });

        expect(lastConversationConfig?.clientTools?.complete_intake).toBeDefined();
        const response = await lastConversationConfig.clientTools.complete_intake(JSON.stringify({ title: 'T', summary: 'S' }));
        expect(response).toBe('ok');

        await waitFor(() => expect(onIntakeComplete).toHaveBeenCalledWith(expect.objectContaining({ title: 'T', summary: 'S' })));
    });

    it('handles non-JSON intake completion payloads', async () => {
        const { result } = renderConversation();

        const onIntakeComplete = jest.fn();
        act(() => {
            result.current.subscribe({ onIntakeComplete });
        });

        const response = await lastConversationConfig.clientTools.complete_intake('not json');
        expect(response).toBe('ok');

        await waitFor(() => expect(onIntakeComplete).toHaveBeenCalledWith(expect.objectContaining({ raw: 'not json' })));
    });

    it('waits for disconnect when stopping', async () => {
        jest.useFakeTimers();
        conversation.status = 'connected';

        const { result } = renderConversation();

        setTimeout(() => {
            conversation.status = 'disconnected';
        }, 50);

        await act(async () => {
            const promise = result.current.stopConversation({ force: true });
            await jest.runAllTimersAsync();
            await promise;
        });

        expect(mockEndSession).toHaveBeenCalled();
        expect(mockStopLatencyMask).toHaveBeenCalled();
        expect(mockSetAudioForPlayback).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('does not start when persona is missing an agentId', async () => {
        const { result } = renderConversation();

        await act(async () => {
            await result.current.startConversation({ id: 'luna', agentId: '' } as any);
        });

        expect(mockStartSession).not.toHaveBeenCalled();
        expect(result.current.activePersonaId).toBeNull();
    });

    it('resets active state when token fetch fails', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'boom' })),
            headers: { get: () => 'application/json' },
        });

        const { result } = renderConversation();

        await act(async () => {
            await result.current.startConversation({ id: 'luna', agentId: 'agent_123' } as any);
        });

        expect(mockStartSession).not.toHaveBeenCalled();
        expect(result.current.activePersonaId).toBeNull();
        expect(result.current.activeOwnerKey).toBeNull();
    });

    it('surfaces HTML token responses as a configuration error', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue('<html><body>auth</body></html>'),
            headers: { get: () => 'text/html' },
        });

        const { result } = renderConversation();

        await act(async () => {
            await result.current.startConversation({ id: 'luna', agentId: 'agent_123' } as any);
        });

        expect(mockStartSession).not.toHaveBeenCalled();
        expect(result.current.activePersonaId).toBeNull();
    });

    it('attempts to end a previous session before starting a new one', async () => {
        jest.useFakeTimers();
        conversation.status = 'connected';
        mockEndSession.mockImplementationOnce(() => new Promise(() => { }));

        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({ token: 'conv_token' })),
            headers: { get: () => 'application/json' },
        });

        const { result } = renderConversation();

        await act(async () => {
            const promise = result.current.startConversation({ id: 'luna', agentId: 'agent_123' } as any);
            await jest.advanceTimersByTimeAsync(5000);
            await promise;
        });

        expect(mockEndSession).toHaveBeenCalled();
        expect(mockStartSession).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('only stops the conversation for the current owner key', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({ token: 'conv_token' })),
            headers: { get: () => 'application/json' },
        });

        const { result } = renderConversation();

        await act(async () => {
            await result.current.startConversation({ id: 'luna', agentId: 'agent_123' } as any, { ownerKey: 'owner-a' });
        });

        mockEndSession.mockClear();

        await act(async () => {
            await result.current.stopConversation({ ownerKey: 'owner-b' });
        });

        expect(mockEndSession).not.toHaveBeenCalled();

        await act(async () => {
            await result.current.stopConversation({ ownerKey: 'owner-a' });
        });
        expect(mockEndSession).toHaveBeenCalled();
    });
});
