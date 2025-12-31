import { act, renderHook } from '@testing-library/react-native';
import { personas } from '../../../lib/personas';
import { useVoiceSession } from '../useVoiceSession';

jest.mock('../../../lib/debugLogger', () => ({
    createFlowLogger: () => ({
        step: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        end: jest.fn(),
        requestId: 'req_test',
        log: jest.fn(),
    }),
}));

let lastElevenLabsCallbacks: any = null;
const mockStartConversation = jest.fn();
const mockStopConversation = jest.fn(async (_options?: any) => undefined);
const mockPlayLatencyMask = jest.fn();
const mockStopLatencyMask = jest.fn();

jest.mock('../../useElevenLabs', () => ({
    useElevenLabs: (_persona: any, callbacks: any) => {
        lastElevenLabsCallbacks = callbacks;
        return {
            startConversation: mockStartConversation,
            stopConversation: (...args: any[]) => mockStopConversation(...args),
            status: 'disconnected',
            isPlayingMask: false,
            playingMaskType: null,
            playLatencyMask: mockPlayLatencyMask,
            stopLatencyMask: mockStopLatencyMask,
        };
    },
}));

describe('hooks/intake/useVoiceSession', () => {
    const persona = personas.find((p) => p.id === 'luna') || personas[0];

    beforeEach(() => {
        jest.clearAllMocks();
        lastElevenLabsCallbacks = null;
    });

    it('normalizes conversation messages into convoHistory', () => {
        const triggerGenerateRef = { current: jest.fn() };
        const { result } = renderHook(() => useVoiceSession({ persona, isGenerating: false, triggerGenerateRef }));

        act(() => {
            lastElevenLabsCallbacks.onMessage({ role: 'agent', message: 'Hello' });
            lastElevenLabsCallbacks.onMessage({ role: 'system', message: 'ignore' });
            lastElevenLabsCallbacks.onMessage({ role: 'user', content: 'Hi' });
        });

        expect(result.current.convoHistory).toEqual([
            { role: 'assistant', content: 'Hello' },
            { role: 'user', content: 'Hi' },
        ]);
    });

    it('sets voiceError on disconnect or error and clears it on connect', () => {
        const triggerGenerateRef = { current: jest.fn() };
        const { result } = renderHook(() => useVoiceSession({ persona, isGenerating: false, triggerGenerateRef }));

        act(() => {
            lastElevenLabsCallbacks.onDisconnect('error');
        });
        expect(result.current.voiceError).toContain('Voice connection ended');

        act(() => {
            lastElevenLabsCallbacks.onConnect();
        });
        expect(result.current.voiceError).toBeNull();

        act(() => {
            lastElevenLabsCallbacks.onError(new Error('boom'));
        });
        expect(result.current.voiceError).toContain('Voice connection failed');
    });

    it('triggers generation once per intake completion window', () => {
        jest.useFakeTimers();

        const triggerGenerate = jest.fn();
        const triggerGenerateRef = { current: triggerGenerate };
        const { result } = renderHook(() => useVoiceSession({ persona, isGenerating: false, triggerGenerateRef }));

        act(() => {
            lastElevenLabsCallbacks.onIntakeComplete({ title: 'T', summary: 'S' });
        });
        expect(triggerGenerate).toHaveBeenCalledTimes(1);
        expect(result.current.intakeSummaryRef.current).toEqual({ title: 'T', summary: 'S' });

        act(() => {
            lastElevenLabsCallbacks.onIntakeComplete({ title: 'T2' });
        });
        expect(triggerGenerate).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        act(() => {
            lastElevenLabsCallbacks.onIntakeComplete({ title: 'T2' });
        });
        expect(triggerGenerate).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
    });

    it('does not trigger generation while generating', () => {
        const triggerGenerate = jest.fn();
        const triggerGenerateRef = { current: triggerGenerate };
        renderHook(() => useVoiceSession({ persona, isGenerating: true, triggerGenerateRef }));

        act(() => {
            lastElevenLabsCallbacks.onIntakeComplete({ title: 'T' });
        });

        expect(triggerGenerate).not.toHaveBeenCalled();
    });

    it('stops conversation on unmount', () => {
        const triggerGenerateRef = { current: jest.fn() };
        const { unmount } = renderHook(() => useVoiceSession({ persona, isGenerating: false, triggerGenerateRef }));

        unmount();
        expect(mockStopConversation).toHaveBeenCalledWith({ force: true });
    });
});

