import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useElevenLabsConversation } from '../components/ElevenLabsConversationProvider';
import { createFlowLogger } from '../lib/debugLogger';
import type { Mode } from '../lib/elevenlabs';
import { Persona } from '../lib/personas';
import { CrashlyticsService } from '../services/crashlytics';

export function useElevenLabs(
    persona: Persona,
    callbacks?: {
        onConnect?: () => void;
        onDisconnect?: (reason?: 'user' | 'agent' | 'error') => void;
        onError?: (error: unknown) => void;
        onMessage?: (message: any) => void;
        onModeChange?: (mode: Mode) => void;
        onStatusChange?: (status: any) => void;
        onIntakeComplete?: (payload: { title?: string; summary?: string; raw?: unknown }) => void;
    }
) {
    const {
        conversation,
        status,
        mode,
        startConversation: start,
        stopConversation: stop,
        subscribe,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    } = useElevenLabsConversation();
    const ownerKeyRef = useRef(`useElevenLabs:${Date.now()}:${Math.random().toString(16).slice(2)}`);
    const ownerKey = ownerKeyRef.current;

    useEffect(() => {
        const listener: Record<string, unknown> = {};
        if (callbacks?.onConnect) listener.onConnect = callbacks.onConnect;
        if (callbacks?.onDisconnect) listener.onDisconnect = callbacks.onDisconnect;
        if (callbacks?.onError) listener.onError = callbacks.onError;
        if (callbacks?.onMessage) listener.onMessage = callbacks.onMessage;
        if (callbacks?.onModeChange) listener.onModeChange = callbacks.onModeChange;
        if (callbacks?.onStatusChange) listener.onStatusChange = callbacks.onStatusChange;
        if (callbacks?.onIntakeComplete) listener.onIntakeComplete = callbacks.onIntakeComplete;

        if (!Object.keys(listener).length) return;
        return subscribe(listener as any, ownerKey);
    }, [
        callbacks?.onConnect,
        callbacks?.onDisconnect,
        callbacks?.onError,
        callbacks?.onIntakeComplete,
        callbacks?.onMessage,
        callbacks?.onModeChange,
        callbacks?.onStatusChange,
        subscribe,
        ownerKey,
    ]);

    const startConversation = useCallback(async () => {
        const flow = createFlowLogger('useElevenLabs.start', { meta: { personaId: persona.id, ownerKey } });
        try {
            await start(persona, { ownerKey });
            flow.step('done');
        } catch (error) {
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `ElevenLabs:start:${persona.id}`);
            flow.error('error', error instanceof Error ? { message: error.message } : String(error));
            throw error;
        } finally {
            flow.end();
        }
    }, [start, persona, ownerKey]);

    const stopConversation = useCallback(async (options?: { force?: boolean }) => {
        const flow = createFlowLogger('useElevenLabs.stop', { meta: { ownerKey } });
        try {
            await stop({ ownerKey, force: options?.force });
            flow.step('done');
        } catch (error) {
            flow.warn('error', error instanceof Error ? { message: error.message } : String(error));
            throw error;
        } finally {
            flow.end();
        }
    }, [stop, ownerKey]);

    return useMemo(() => ({
        ...conversation,
        status,
        mode,
        startConversation,
        stopConversation,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    }), [
        conversation,
        status,
        mode,
        startConversation,
        stopConversation,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    ]);
}
