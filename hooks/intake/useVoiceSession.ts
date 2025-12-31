import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFlowLogger } from '../../lib/debugLogger';
import { personas, type Persona } from '../../lib/personas';
import { useElevenLabs } from '../useElevenLabs';
import { useStableCallback } from '../useStableCallback';

export type IntakeSummary = { title?: string; summary?: string };

type Params = {
    persona: Persona | null;
    isGenerating: boolean;
    triggerGenerateRef: React.MutableRefObject<(() => void) | null>;
};

export function useVoiceSession({ persona, isGenerating, triggerGenerateRef }: Params) {
    const hasAgentId = Boolean(persona?.agentId?.trim());
    const resolvedPersonaForHooks = persona || personas[0];

    const [convoHistory, setConvoHistory] = useState<Array<{ role: string; content: string }>>([]);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const intakeSummaryRef = useRef<IntakeSummary | null>(null);
    const intakeCompleteInFlightRef = useRef(false);
    const intakeCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setConvoHistory([]);
        setVoiceError(null);
        intakeSummaryRef.current = null;
        intakeCompleteInFlightRef.current = false;
        if (intakeCompleteTimerRef.current) {
            clearTimeout(intakeCompleteTimerRef.current);
            intakeCompleteTimerRef.current = null;
        }
    }, [persona?.id]);

    const handleConversationMessage = useCallback((message: any) => {
        const roleRaw = typeof message?.role === 'string' ? message.role.trim() : '';
        const textRaw =
            typeof message?.message === 'string'
                ? message.message
                : typeof message?.text === 'string'
                    ? message.text
                    : typeof message?.content === 'string'
                        ? message.content
                        : '';
        const role = roleRaw.toLowerCase() === 'agent' ? 'assistant' : roleRaw.toLowerCase();
        const content = textRaw.trim();
        if (!role || !content) return;
        if (role === 'system') return;
        setConvoHistory((prev) => [...prev, { role, content }].slice(-50));
    }, []);

    const handleIntakeComplete = useCallback((payload: { title?: string; summary?: string; raw?: unknown }) => {
        if (!persona) return;
        if (isGenerating) return;
        if (intakeCompleteInFlightRef.current) return;

        intakeCompleteInFlightRef.current = true;
        intakeSummaryRef.current = { title: payload.title, summary: payload.summary };

        const flow = createFlowLogger('Intake Complete', {
            meta: {
                personaId: persona.id,
                hasTitle: Boolean(payload.title),
                hasSummary: Boolean(payload.summary),
            },
        });
        flow.step('trigger:generate');
        triggerGenerateRef.current?.();
        flow.end();

        if (intakeCompleteTimerRef.current) {
            clearTimeout(intakeCompleteTimerRef.current);
        }
        intakeCompleteTimerRef.current = setTimeout(() => {
            intakeCompleteInFlightRef.current = false;
            intakeCompleteTimerRef.current = null;
        }, 2000);
    }, [isGenerating, persona, triggerGenerateRef]);

    const handleConversationConnect = useCallback(() => {
        setVoiceError(null);
    }, []);

    const handleConversationDisconnect = useCallback((reason?: 'user' | 'agent' | 'error') => {
        if (!reason || reason === 'user') return;
        setVoiceError('Voice connection ended. Tap the mic to retry.');
    }, []);

    const handleConversationError = useCallback((error: unknown) => {
        console.warn('[ElevenLabs] Conversation error', error);
        setVoiceError('Voice connection failed. Tap the mic to retry.');
    }, []);

    const {
        startConversation,
        stopConversation,
        status,
        mode,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    } = useElevenLabs(resolvedPersonaForHooks, {
        onConnect: handleConversationConnect,
        onDisconnect: handleConversationDisconnect,
        onError: handleConversationError,
        onMessage: handleConversationMessage,
        onIntakeComplete: handleIntakeComplete,
    });

    const startConversationStable = useStableCallback(startConversation);
    const stopConversationStable = useStableCallback(stopConversation);

    useEffect(() => {
        return () => {
            if (intakeCompleteTimerRef.current) {
                clearTimeout(intakeCompleteTimerRef.current);
                intakeCompleteTimerRef.current = null;
            }
            void stopConversationStable({ force: true }).catch(() => undefined);
        };
    }, [stopConversationStable]);

    const isSessionActive = hasAgentId && status !== 'disconnected';

    const clearVoiceError = useCallback(() => setVoiceError(null), []);
    const setVoiceErrorMessage = useCallback((message: string) => setVoiceError(message), []);

    return useMemo(() => ({
        hasAgentId,
        convoHistory,
        voiceError,
        clearVoiceError,
        setVoiceErrorMessage,
        intakeSummaryRef,
        startConversation: startConversationStable,
        stopConversation: stopConversationStable,
        status,
        mode,
        isSessionActive,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    }), [
        hasAgentId,
        convoHistory,
        voiceError,
        clearVoiceError,
        setVoiceErrorMessage,
        startConversationStable,
        stopConversationStable,
        status,
        mode,
        isSessionActive,
        isPlayingMask,
        playingMaskType,
        playLatencyMask,
        stopLatencyMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording,
    ]);
}
