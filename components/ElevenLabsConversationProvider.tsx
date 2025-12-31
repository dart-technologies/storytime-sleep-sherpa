import * as FileSystem from 'expo-file-system';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { resolveCloudFunctionUrl } from '../lib/cloudFunctions';
import { estimateAppMixVolume, isAudioDebugEnabled, logAudioDebug, redactAudioSourceForLogs, snapshotAudioPlayer } from '../lib/audioDebug';
import { createFlowLogger, createRequestId, isVerboseDebugLoggingEnabled } from '../lib/debugLogger';
import { useConversation } from '../lib/elevenlabs';
import type { Conversation, ConversationStatus, Mode } from '../lib/elevenlabs';
import { getPublicEnvBool, getPublicEnvInt } from '../lib/env';
import { getFirebaseIdToken } from '../lib/firebase';
import { settleWithTimeout, sleep } from '../lib/promiseUtils';
import type { Persona, PersonaId } from '../lib/personas';
import { useAudioPlayback } from './AudioProvider';
import { base64ToBytes, createWavHeader, parseAgentPcmSampleRate } from './elevenlabsConversation/agentAudioRecording';
import { setAudioForPlayback, setAudioForVoice } from './elevenlabsConversation/audioSession';
import type {
    AgentAudioRecording,
    ElevenLabsConversationContextValue,
    Listener,
    StartOptions,
    StopOptions,
    Subscription,
} from './elevenlabsConversation/types';
import { useLatencyMaskAudio } from './elevenlabsConversation/useLatencyMaskAudio';

export type { LatencyMaskType } from './elevenlabsConversation/types';

async function waitForConversationStatus(
    conversation: Conversation,
    desired: ConversationStatus,
    timeoutMs: number
): Promise<boolean> {
    const startMs = Date.now();
    while (Date.now() - startMs < timeoutMs) {
        if (conversation.status === desired) return true;
        await sleep(100);
    }
    return conversation.status === desired;
}

const ElevenLabsConversationContext = createContext<ElevenLabsConversationContextValue | null>(null);

export function ElevenLabsConversationProvider({ children }: { children: React.ReactNode }) {
    const { player, ambientPlayer, currentUrl, ambientUrl } = useAudioPlayback();
    const currentUrlRef = useRef(currentUrl);
    const ambientUrlRef = useRef(ambientUrl);
    useEffect(() => {
        currentUrlRef.current = currentUrl;
    }, [currentUrl]);
    useEffect(() => {
        ambientUrlRef.current = ambientUrl;
    }, [ambientUrl]);
    const tokenFetchUrl = useMemo(() => {
        const baseUrl = (process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL || '').trim();
        const endpoint = (process.env.EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN || '/elevenlabsToken').trim();
        const url = resolveCloudFunctionUrl(baseUrl, endpoint);
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[ElevenLabs] tokenFetchUrl', { baseUrl, endpoint, resolved: url || null });
        }
        return url || undefined;
    }, []);

    const [activePersonaId, setActivePersonaId] = useState<PersonaId | null>(null);
    const [activeOwnerKey, setActiveOwnerKey] = useState<string | null>(null);
    const [status, setStatus] = useState<ConversationStatus>('disconnected');
    const [mode, setMode] = useState<Mode | null>(null);

    const isAgentAudioRecordingEnabled = useMemo(
        () => getPublicEnvBool('EXPO_PUBLIC_ELEVENLABS_RECORD_AGENT_AUDIO', false),
        []
    );
    const playbackRearmAfterVoiceMs = useMemo(
        () => getPublicEnvInt('EXPO_PUBLIC_IOS_AUDIO_REARM_AFTER_VOICE_MS', 0),
        []
    );
    const [isAgentAudioRecording, setIsAgentAudioRecording] = useState(false);
    const [agentAudioRecording, setAgentAudioRecording] = useState<AgentAudioRecording | null>(null);

    const agentAudioRecorderRef = useRef<{
        enabled: boolean;
        startedAtMs: number;
        conversationId: string | null;
        sampleRate: number | null;
        file: FileSystem.File | null;
        handle: FileSystem.FileHandle | null;
        pending: Uint8Array[];
        dataBytes: number;
        flushInFlight: Promise<void> | null;
        stopInFlight: Promise<void> | null;
    }>({
        enabled: isAgentAudioRecordingEnabled,
        startedAtMs: 0,
        conversationId: null,
        sampleRate: null,
        file: null,
        handle: null,
        pending: [],
        dataBytes: 0,
        flushInFlight: null,
        stopInFlight: null,
    });

    useEffect(() => {
        agentAudioRecorderRef.current.enabled = isAgentAudioRecordingEnabled;
    }, [isAgentAudioRecordingEnabled]);

    const activePersonaIdRef = useRef<PersonaId | null>(null);
    const activeOwnerKeyRef = useRef<string | null>(null);
    const startInFlightRef = useRef(false);
    const sessionRequestIdRef = useRef(0);

    const subscriptionsRef = useRef<Set<Subscription>>(new Set());

    const {
        playingMaskType,
        isPlayingMask,
        playLatencyMask,
        stopLatencyMask,
        clearLatencyMask,
    } = useLatencyMaskAudio({ ambientPlayer, setAudioForPlayback });

    const emit = useCallback((fn: (listener: Listener) => void) => {
        const currentOwnerKey = activeOwnerKeyRef.current;
        subscriptionsRef.current.forEach(({ ownerKey, listener }) => {
            if (ownerKey) {
                if (!currentOwnerKey) return;
                if (ownerKey !== currentOwnerKey) return;
            }
            try {
                fn(listener);
            } catch (error) {
                console.warn('[ElevenLabs] Listener error:', error);
            }
        });
    }, []);

    const flushAgentAudioRecorder = useCallback(async (): Promise<void> => {
        const state = agentAudioRecorderRef.current;
        if (!state.enabled) return;
        if (!state.handle) return;
        if (!state.pending.length) return;

        if (state.flushInFlight) {
            await state.flushInFlight;
        }

        state.flushInFlight = (async () => {
            const handle = state.handle;
            if (!handle) return;
            const chunks = state.pending;
            state.pending = [];
            for (const chunk of chunks) {
                if (!chunk.length) continue;
                handle.writeBytes(chunk);
                state.dataBytes += chunk.length;
            }
        })();

        try {
            await state.flushInFlight;
        } finally {
            state.flushInFlight = null;
        }
    }, []);

    const stopAgentAudioRecorder = useCallback(async (): Promise<void> => {
        const state = agentAudioRecorderRef.current;
        if (state.stopInFlight) {
            await state.stopInFlight;
            return;
        }
        if (!state.enabled) return;
        const handle = state.handle;
        const file = state.file;
        if (!handle || !file) return;

        state.stopInFlight = (async () => {
            await flushAgentAudioRecorder();

            const endedAtMs = Date.now();
            const resolvedSampleRate = state.sampleRate ?? 24000;
            const dataBytes = state.dataBytes;
            const startedAtMs = state.startedAtMs;
            const conversationId = state.conversationId;

            try {
                const header = createWavHeader({ dataSize: dataBytes, sampleRate: resolvedSampleRate });
                handle.offset = 0;
                handle.writeBytes(header);
            } catch (error) {
                if (__DEV__) {
                    console.warn('[ElevenLabs] Failed to finalize agent WAV header:', error);
                }
            }

            try {
                handle.close();
            } catch {
                // ignore
            }

            state.handle = null;
            state.file = null;
            state.pending = [];
            state.dataBytes = 0;
            state.startedAtMs = 0;
            state.conversationId = null;
            state.sampleRate = null;

            setIsAgentAudioRecording(false);
            setAgentAudioRecording({
                uri: file.uri,
                sampleRate: resolvedSampleRate,
                bytes: dataBytes,
                startedAtMs,
                endedAtMs,
                conversationId,
            });
        })();

        try {
            await state.stopInFlight;
        } finally {
            state.stopInFlight = null;
        }
    }, [flushAgentAudioRecorder]);

    const startAgentAudioRecorder = useCallback(async (conversationId: string | null) => {
        const state = agentAudioRecorderRef.current;
        if (!state.enabled) return;

        if (state.handle) {
            await stopAgentAudioRecorder().catch(() => undefined);
        }

        try {
            const safeConversationId = (conversationId || 'conversation').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
            const fileName = `Storytime_ElevenLabsAgent_${safeConversationId}_${Date.now()}.wav`;
            const file = new FileSystem.File(FileSystem.Paths.document, 'storytime_recordings', fileName);
            file.create({ intermediates: true, overwrite: true });
            const handle = file.open();
            const header = createWavHeader({ dataSize: 0, sampleRate: 24000 });
            handle.writeBytes(header);

            state.startedAtMs = Date.now();
            state.conversationId = conversationId || null;
            state.sampleRate = null;
            state.file = file;
            state.handle = handle;
            state.pending = [];
            state.dataBytes = 0;
            state.flushInFlight = null;

            setIsAgentAudioRecording(true);
        } catch (error) {
            if (__DEV__) {
                console.warn('[ElevenLabs] Failed to start agent audio recorder:', error);
            }
            state.file = null;
            state.handle = null;
        }
    }, [stopAgentAudioRecorder]);

    const clientTools = useMemo(() => ({
        complete_intake: async (parameters: unknown) => {
            let title: string | undefined = undefined;
            let summary: string | undefined = undefined;

            const parsed =
                typeof parameters === 'string'
                    ? (() => {
                        try {
                            return JSON.parse(parameters);
                        } catch {
                            return null;
                        }
                    })()
                    : parameters;

            if (parsed && typeof parsed === 'object') {
                const anyParams = parsed as any;
                if (typeof anyParams.title === 'string' && anyParams.title.trim()) title = anyParams.title.trim();
                if (typeof anyParams.summary === 'string' && anyParams.summary.trim()) summary = anyParams.summary.trim();
            }

            emit((l) => l.onIntakeComplete?.({ title, summary, raw: parameters }));
            return 'ok';
        },
    }), [emit]);

    const fetchConversationToken = useCallback(async (agentId: string, requestId: string) => {
        if (!tokenFetchUrl) {
            throw new Error(
                'Missing ElevenLabs token endpoint. Set EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN to a full URL, or set EXPO_PUBLIC_CLOUD_FUNCTIONS_URL.'
            );
        }

        const flow = createFlowLogger('ElevenLabs Token', {
            requestId,
            meta: { agentId, tokenFetchUrl },
        });

        const url = new URL(tokenFetchUrl);
        url.searchParams.set('agent_id', agentId);

        flow.step('getFirebaseIdToken:begin');
        const idToken = await getFirebaseIdToken();
        flow.step('getFirebaseIdToken:done', { tokenLength: idToken.length });

        flow.step('fetch:begin', { url: url.toString() });
        const tokenFetchTimeoutMs = 15000;
        const responseResult = await settleWithTimeout(fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${idToken}`,
                'X-Storytime-Request-Id': requestId,
            },
        }), tokenFetchTimeoutMs);
        if (responseResult.status === 'timeout') {
            throw new Error(`Token fetch timed out after ${tokenFetchTimeoutMs}ms`);
        }
        if (responseResult.status === 'rejected') {
            throw responseResult.reason;
        }
        const response = responseResult.value;
        const bodyText = await response.text().catch(() => '');
        const bodyTrimmed = bodyText.trim();
        flow.step('fetch:response', {
            ok: response.ok,
            status: response.status,
            contentType:
                typeof (response as any).headers?.get === 'function' ? ((response as any).headers.get('content-type') || '') : '',
        });

        let data: any = undefined;
        if (bodyTrimmed) {
            try {
                data = JSON.parse(bodyTrimmed);
            } catch {
                // Non-JSON body (often an HTML error page due to wrong URL / missing deploy).
            }
        }

        if (!response.ok) {
            const isHtml = bodyTrimmed.startsWith('<');
            const message = isHtml
                ? `HTTP ${response.status} (received HTML). Likely wrong URL or an upstream auth/proxy page (url: ${url.toString()}, body: ${bodyTrimmed
                    .slice(0, 80)
                    .replace(/\\s+/g, ' ')}…).`
                : data?.detail?.message || data?.error || data?.message || bodyTrimmed || `HTTP ${response.status}`;
            throw new Error(message);
        }

        const token =
            (typeof data === 'string' ? data : undefined) ||
            data?.token ||
            data?.conversationToken ||
            data?.conversation_token ||
            (data === undefined && bodyTrimmed && !bodyTrimmed.startsWith('<') ? bodyTrimmed : undefined);
        if (typeof token !== 'string' || !token) {
            if (bodyTrimmed.startsWith('<')) {
                throw new Error(
                    `Token endpoint returned HTML. Check EXPO_PUBLIC_CLOUD_FUNCTIONS_URL and deploy functions. (${url.toString()})`
                );
            }
            throw new Error('No conversation token received from token endpoint');
        }

        flow.step('token:received', { tokenLength: token.length });
        flow.end();
        return token;
    }, [tokenFetchUrl]);

    const conversation = useConversation({
        clientTools,
        onConnect: ({ conversationId }) => {
            if (!activePersonaIdRef.current) return;
            setStatus('connected');
            setMode(null);
            if (isVerboseDebugLoggingEnabled()) {
                console.log('[ElevenLabs] conversation:onConnect');
            }
            void startAgentAudioRecorder(conversationId || null);
            if (isAudioDebugEnabled()) {
                const storyPlaying = Boolean(player?.playing);
                const ambientPlaying = Boolean(ambientPlayer?.playing);
                const storyVolume = typeof player?.volume === 'number' ? player.volume : 0;
                const ambientVolume = typeof ambientPlayer?.volume === 'number' ? ambientPlayer.volume : 0;
                logAudioDebug('agent:onConnect', {
                    activePersonaId: activePersonaIdRef.current,
                    activeOwnerKey: activeOwnerKeyRef.current,
                    story: { source: redactAudioSourceForLogs(currentUrlRef.current), ...snapshotAudioPlayer(player) },
                    ambient: { source: redactAudioSourceForLogs(ambientUrlRef.current), ...snapshotAudioPlayer(ambientPlayer) },
                    mixEstimate: estimateAppMixVolume([
                        { label: 'story', playing: storyPlaying, volume: storyVolume },
                        { label: 'ambient', playing: ambientPlaying, volume: ambientVolume },
                    ]),
                });
            }
            clearLatencyMask();
            emit((l) => l.onConnect?.());
        },
        onConversationMetadata: (metadata) => {
            if (!activePersonaIdRef.current) return;
            const format = (metadata as any)?.agent_output_audio_format;
            const sampleRate = parseAgentPcmSampleRate(format);
            const state = agentAudioRecorderRef.current;
            if (state.enabled && state.handle && sampleRate) {
                state.sampleRate = sampleRate;
            }
        },
        onAudio: (base64Audio: string) => {
            if (!activePersonaIdRef.current) return;
            const state = agentAudioRecorderRef.current;
            if (!state.enabled) return;
            if (!state.handle) return;
            try {
                const bytes = base64ToBytes(base64Audio);
                if (!bytes.length) return;
                state.pending.push(bytes);
                if (state.pending.length >= 24) {
                    void flushAgentAudioRecorder().catch(() => undefined);
                }
            } catch (error) {
                if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                    console.warn('[ElevenLabs] Failed to record agent audio chunk:', error);
                }
            }
        },
        onDisconnect: ({ reason }) => {
            if (!activePersonaIdRef.current) return;
            if (isVerboseDebugLoggingEnabled()) {
                console.log('[ElevenLabs] conversation:onDisconnect', { reason });
            }
            setStatus('disconnected');
            setMode(null);
            void stopAgentAudioRecorder();
            if (isAudioDebugEnabled()) {
                logAudioDebug('agent:onDisconnect', {
                    reason,
                    activePersonaId: activePersonaIdRef.current,
                    activeOwnerKey: activeOwnerKeyRef.current,
                });
            }
            clearLatencyMask();
            if (reason !== 'user') {
                void setAudioForPlayback();
            }
            emit((l) => l.onDisconnect?.(reason));
        },
        onMessage: (message) => {
            if (!activePersonaIdRef.current) return;
            if (isVerboseDebugLoggingEnabled()) {
                const kind =
                    typeof message === 'object' && message !== null && 'type' in message
                        ? String((message as any).type)
                        : typeof message;
                console.log('[ElevenLabs] conversation:onMessage', { kind });
            }
            emit((l) => l.onMessage?.(message));
        },
        onError: (error) => {
            if (!activePersonaIdRef.current) return;
            if (isVerboseDebugLoggingEnabled()) {
                const message =
                    typeof error === 'object' && error !== null && 'message' in error
                        ? String((error as any).message)
                        : String(error);
                console.log('[ElevenLabs] conversation:onError', { message });
            }
            if (isAudioDebugEnabled()) {
                const message =
                    typeof error === 'object' && error !== null && 'message' in error
                        ? String((error as any).message)
                        : String(error);
                logAudioDebug('agent:onError', {
                    message,
                    activePersonaId: activePersonaIdRef.current,
                    activeOwnerKey: activeOwnerKeyRef.current,
                });
            }
            clearLatencyMask();
            void stopAgentAudioRecorder();
            setMode(null);
            void setAudioForPlayback();
            emit((l) => l.onError?.(error));
        },
        onModeChange: ({ mode }) => {
            if (!activePersonaIdRef.current) return;
            setMode(mode);
            if (isAudioDebugEnabled()) {
                logAudioDebug('agent:onModeChange', {
                    mode,
                    activePersonaId: activePersonaIdRef.current,
                    activeOwnerKey: activeOwnerKeyRef.current,
                });
            }
            emit((l) => l.onModeChange?.(mode));
        },
        onStatusChange: ({ status }) => {
            if (!activePersonaIdRef.current) return;
            setStatus(status);
            if (isVerboseDebugLoggingEnabled()) {
                console.log('[ElevenLabs] conversation:onStatusChange', { status });
            }
            if (isAudioDebugEnabled()) {
                logAudioDebug('agent:onStatusChange', {
                    status,
                    activePersonaId: activePersonaIdRef.current,
                    activeOwnerKey: activeOwnerKeyRef.current,
                });
            }
            emit((l) => l.onStatusChange?.(status));
        },
    });

    useEffect(() => {
        if (Platform.OS !== 'ios') return;

        let lastState = AppState.currentState;
        const subscription = AppState.addEventListener('change', (nextState) => {
            const prevState = lastState;
            lastState = nextState;
            if (prevState === nextState) return;
            if (nextState !== 'active') return;

            // When Control Center interrupts the app, iOS can reset the audio session.
            // Re-apply playback audio configuration when we're not in a voice session.
            if (startInFlightRef.current) return;
            if (conversation.status !== 'disconnected') return;

            if (isAudioDebugEnabled()) {
                logAudioDebug('audioSession:reapplyPlayback:appActive', {
                    prevState,
                    nextState,
                    status: conversation.status,
                });
            }
            void setAudioForPlayback().catch(() => undefined);
        });

        return () => subscription.remove();
    }, [conversation]);

    const startConversation = useCallback(async (persona: Persona, options?: StartOptions) => {
        if (startInFlightRef.current) {
            if (isVerboseDebugLoggingEnabled()) {
                console.log('[ElevenLabs] startConversation:skipped (in-flight)', { personaId: persona.id });
            }
            return;
        }
        startInFlightRef.current = true;
        const sessionRequestId = ++sessionRequestIdRef.current;
        const requestId = createRequestId('voice');
        const flow = createFlowLogger('ElevenLabs Start', {
            requestId,
            meta: { personaId: persona.id, ownerKey: options?.ownerKey || null, sessionRequestId, tokenFetchUrl },
        });

        try {
            const ownerKey = options?.ownerKey;
            activeOwnerKeyRef.current = ownerKey ?? null;
            activePersonaIdRef.current = persona.id;
            setActiveOwnerKey(activeOwnerKeyRef.current);
            setActivePersonaId(activePersonaIdRef.current);
            setStatus('connecting');
            setMode(null);
            if (isAudioDebugEnabled()) {
                logAudioDebug('voice:startConversation', {
                    personaId: persona.id,
                    ownerKey: ownerKey ?? null,
                    sessionRequestId,
                    story: { source: redactAudioSourceForLogs(currentUrlRef.current), ...snapshotAudioPlayer(player) },
                    ambient: { source: redactAudioSourceForLogs(ambientUrlRef.current), ...snapshotAudioPlayer(ambientPlayer) },
                });
            }

            const agentId = persona.agentId?.trim();
            if (!agentId) {
                flow.warn('missing-agentId', { personaId: persona.id });
                stopLatencyMask();
                activeOwnerKeyRef.current = null;
                activePersonaIdRef.current = null;
                setActiveOwnerKey(null);
                setActivePersonaId(null);
                console.warn(
                    `[ElevenLabs] Missing agentId for persona "${persona.id}". Set EXPO_PUBLIC_ELEVENLABS_AGENT_${persona.id.toUpperCase()} in .env.local (or Expo env vars).`
                );
                flow.end();
                return;
            }

            // Ensure no persona mask is playing when voice starts.
            stopLatencyMask();

            let conversationToken: string;
            try {
                flow.step('tokenFetch:begin');
                conversationToken = await fetchConversationToken(agentId, requestId);
                flow.step('tokenFetch:done', { tokenLength: conversationToken.length });
            } catch (error) {
                stopLatencyMask();
                activeOwnerKeyRef.current = null;
                activePersonaIdRef.current = null;
                setActiveOwnerKey(null);
                setActivePersonaId(null);
                setStatus('disconnected');
                setMode(null);
                console.warn('[ElevenLabs] Failed to fetch conversation token:', error);
                flow.error('tokenFetch:error', error instanceof Error ? { message: error.message } : String(error));
                flow.end();
                return;
            }

            if (sessionRequestIdRef.current !== sessionRequestId) return;

            try {
                if (conversation.status !== 'disconnected') {
                    flow.step('endPreviousSession:begin', { status: conversation.status });
                    const ended = await settleWithTimeout(conversation.endSession(), 5000);
                    if (ended.status === 'timeout') {
                        flow.warn('endPreviousSession:timeout', { timeoutMs: 5000 });
                    } else if (ended.status === 'rejected') {
                        flow.warn('endPreviousSession:error', ended.reason instanceof Error ? { message: ended.reason.message } : String(ended.reason));
                    } else {
                        flow.step('endPreviousSession:done');
                    }
                }
            } catch (error) {
                console.warn('[ElevenLabs] Failed to end previous session:', error);
                flow.warn('endPreviousSession:exception', error instanceof Error ? { message: error.message } : String(error));
            }

            if (sessionRequestIdRef.current !== sessionRequestId) return;

            try {
                flow.step('audioMode:voice');
                await setAudioForVoice();
                if (sessionRequestIdRef.current !== sessionRequestId) return;
                if (isAudioDebugEnabled()) {
                    logAudioDebug('voice:audioMode:voice', {
                        personaId: persona.id,
                        story: { source: redactAudioSourceForLogs(currentUrlRef.current), ...snapshotAudioPlayer(player) },
                        ambient: { source: redactAudioSourceForLogs(ambientUrlRef.current), ...snapshotAudioPlayer(ambientPlayer) },
                    });
                }

                flow.step('startSession:begin');
                const started = await settleWithTimeout(conversation.startSession({
                    conversationToken,
                }), 15000);
                if (started.status === 'timeout') {
                    flow.error('startSession:timeout', { timeoutMs: 15000 });
                    try {
                        void conversation.endSession('user').catch(() => undefined);
                    } catch {
                        // ignore
                    }
                    activeOwnerKeyRef.current = null;
                    activePersonaIdRef.current = null;
                    setActiveOwnerKey(null);
                    setActivePersonaId(null);
                    setMode(null);
                    await setAudioForPlayback();
                    throw new Error('Voice connection timed out');
                } else if (started.status === 'rejected') {
                    flow.error('startSession:error', started.reason instanceof Error ? { message: started.reason.message } : String(started.reason));
                    activeOwnerKeyRef.current = null;
                    activePersonaIdRef.current = null;
                    setActiveOwnerKey(null);
                    setActivePersonaId(null);
                    setStatus('disconnected');
                    setMode(null);
                    void setAudioForPlayback();
                } else {
                    flow.step('startSession:done');
                }
            } catch (error) {
                stopLatencyMask();
                activeOwnerKeyRef.current = null;
                activePersonaIdRef.current = null;
                setActiveOwnerKey(null);
                setActivePersonaId(null);
                setStatus('disconnected');
                setMode(null);
                void setAudioForPlayback();
                console.warn('[ElevenLabs] Failed to start session:', error);
                flow.error('startSession:exception', error instanceof Error ? { message: error.message } : String(error));
            }
        } finally {
            startInFlightRef.current = false;
            flow.end();
        }
    }, [conversation, fetchConversationToken, stopLatencyMask, tokenFetchUrl]);

    const stopConversation = useCallback(async (options?: StopOptions) => {
        const currentOwnerKey = activeOwnerKeyRef.current;
        const shouldStop = options?.force || !options?.ownerKey || !currentOwnerKey || options.ownerKey === currentOwnerKey;

        if (!shouldStop) return;
        if (isAudioDebugEnabled()) {
            logAudioDebug('voice:stopConversation:begin', {
                ownerKey: options?.ownerKey || null,
                currentOwnerKey,
                force: Boolean(options?.force),
                status: conversation.status,
                activePersonaId: activePersonaIdRef.current,
            });
        }

        const requestId = createRequestId('voice_stop');
        const flow = createFlowLogger('ElevenLabs Stop', {
            requestId,
            meta: {
                ownerKey: options?.ownerKey || null,
                currentOwnerKey,
                force: Boolean(options?.force),
                status: conversation.status,
                activePersonaId: activePersonaIdRef.current,
            },
        });

        sessionRequestIdRef.current += 1;

        try {
            flow.step('endSession:begin');
            const endSessionTimeoutMs = 15000;
            const ended = await settleWithTimeout(conversation.endSession('user'), endSessionTimeoutMs);
            if (ended.status === 'timeout') {
                flow.warn('endSession:timeout', { timeoutMs: endSessionTimeoutMs });
            } else if (ended.status === 'rejected') {
                flow.warn('endSession:error', ended.reason instanceof Error ? { message: ended.reason.message } : String(ended.reason));
            } else {
                flow.step('endSession:done');
            }

            if (conversation.status !== 'disconnected') {
                flow.step('endSession:waitForDisconnect', { status: conversation.status });
                const didDisconnect = await waitForConversationStatus(conversation, 'disconnected', 2000);
                if (didDisconnect) {
                    flow.step('endSession:disconnected');
                } else {
                    flow.warn('endSession:stillConnected', { status: conversation.status });
                    void conversation.endSession('user').catch(() => undefined);
                }
            }
        } catch (error) {
            console.warn('[ElevenLabs] Failed to end session:', error);
            flow.warn('endSession:exception', error instanceof Error ? { message: error.message } : String(error));
        }

        await stopAgentAudioRecorder().catch(() => undefined);
        stopLatencyMask();
        activePersonaIdRef.current = null;
        activeOwnerKeyRef.current = null;
        setActivePersonaId(null);
        setActiveOwnerKey(null);
        setStatus('disconnected');
        setMode(null);
        await setAudioForPlayback();
        if (Platform.OS === 'ios' && playbackRearmAfterVoiceMs > 0) {
            flow.step('playbackRearm:wait', { ms: playbackRearmAfterVoiceMs });
            await sleep(playbackRearmAfterVoiceMs);
            flow.step('playbackRearm:reapply');
            await setAudioForPlayback();
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('voice:stopConversation:done');
        }
        flow.end();
    }, [conversation, playbackRearmAfterVoiceMs, stopAgentAudioRecorder, stopLatencyMask]);

    const subscribe = useCallback((listener: Listener, ownerKey?: string) => {
        const subscription: Subscription = { ownerKey, listener };
        subscriptionsRef.current.add(subscription);
        return () => {
            subscriptionsRef.current.delete(subscription);
        };
    }, []);

    const value = useMemo<ElevenLabsConversationContextValue>(() => ({
        conversation,
        status,
        mode,
        activePersonaId,
        activeOwnerKey,
        playingMaskType,
        isPlayingMask,
        isAgentAudioRecording,
        agentAudioRecording,
        clearAgentAudioRecording: () => setAgentAudioRecording(null),
        tokenFetchUrl,
        startConversation,
        stopConversation,
        playLatencyMask,
        stopLatencyMask,
        subscribe,
    }), [
        conversation,
        status,
        mode,
        activePersonaId,
        activeOwnerKey,
        playingMaskType,
        isPlayingMask,
        isAgentAudioRecording,
        agentAudioRecording,
        tokenFetchUrl,
        startConversation,
        stopConversation,
        playLatencyMask,
        stopLatencyMask,
        subscribe,
    ]);

    useEffect(() => {
        return () => {
            void stopAgentAudioRecorder().catch(() => undefined);
        };
    }, [stopAgentAudioRecorder]);

    return (
        <ElevenLabsConversationContext.Provider value={value}>
            {children}
        </ElevenLabsConversationContext.Provider>
    );
}

export function useElevenLabsConversation() {
    const context = useContext(ElevenLabsConversationContext);
    if (!context) {
        throw new Error('useElevenLabsConversation must be used within ElevenLabsConversationProvider');
    }
    return context;
}
