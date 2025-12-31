import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useAudioPlayback } from '../../components/AudioProvider';
import { ALLOWED_STORY_DURATIONS_SEC, DEFAULT_APP_RUNTIME_CONFIG, fetchAppRuntimeConfig } from '../../lib/appConfig';
import { getPersonaAvatar, type SoundscapeId } from '../../lib/assetMapper';
import { isAudioDebugEnabled, logAudioDebug } from '../../lib/audioDebug';
import { createFlowLogger } from '../../lib/debugLogger';
import type { Story } from '../../lib/models/story';
import { personas } from '../../lib/personas';
import { getFirstParamOrUndefined } from '../../lib/routerParams';
import { useStories } from '../useStories';
import { useStoryProduction } from '../useStoryProduction';
import { useImageAnalysis } from './useImageAnalysis';
import { useSoundscapeState } from './useSoundscapeState';
import { useVoiceSession } from './useVoiceSession';

export type GenerationPhase =
    | 'idle'
    | 'stoppingVoice'
    | 'generatingStory'
    | 'creatingCover'
    | 'narratingAudio'
    | 'savingStory'
    | 'openingPlayback';

function resolveStoryDurationOverrideSecFromEnv(): number | null {
    const raw = String(process.env.EXPO_PUBLIC_TEST_STORY_DURATION_SEC || '').trim();
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed)) return null;
    if (ALLOWED_STORY_DURATIONS_SEC.includes(parsed as any)) return parsed;
    return null;
}

async function resolveStoryDurationSec(): Promise<number> {
    const override = resolveStoryDurationOverrideSecFromEnv();
    if (typeof override === 'number') return override;
    const config = await fetchAppRuntimeConfig();
    return config.defaultStoryDurationSec || DEFAULT_APP_RUNTIME_CONFIG.defaultStoryDurationSec;
}

function resolveVertexTextModelOverride(): string | undefined {
    const override = String(process.env.EXPO_PUBLIC_VERTEX_TEXT_MODEL_OVERRIDE || '').trim();
    if (override) return override;
    return undefined;
}

function resolveVertexImageModelOverride(): string | undefined {
    const override = String(process.env.EXPO_PUBLIC_VERTEX_IMAGE_MODEL_OVERRIDE || '').trim();
    if (override) return override;
    return undefined;
}

type Params = {
    personaId: string | string[] | undefined;
    remixId: string | string[] | undefined;
    remixContext: string | string[] | undefined;
};

export function useIntakeFlow({ personaId, remixId, remixContext }: Params) {
    const router = useRouter();
    const networkState = Network.useNetworkState();
    const isConnected = networkState.isInternetReachable ?? networkState.isConnected ?? true;

    const normalizedPersonaId = useMemo(
        () => getFirstParamOrUndefined(personaId),
        [personaId]
    );
    const normalizedRemixId = useMemo(
        () => getFirstParamOrUndefined(remixId),
        [remixId]
    );
    const normalizedRemixContext = useMemo(
        () => getFirstParamOrUndefined(remixContext),
        [remixContext]
    );

    const persona = useMemo(
        () => personas.find((p) => p.id === normalizedPersonaId) || null,
        [normalizedPersonaId]
    );

    const avatarAsset = useMemo(
        () => (persona ? getPersonaAvatar(persona.id) : null),
        [persona]
    );

    const { setAmbientSound, pauseAmbient, resumeAmbient } = useAudioPlayback();
    const { myStories, featuredStories } = useStories();
    const { produceStory, productionState } = useStoryProduction();

    const remixSourceStory = useMemo<Story | null>(() => {
        const remixKey = normalizedRemixId?.trim() || '';
        if (!remixKey) return null;
        return myStories.find((story) => story.id === remixKey)
            || featuredStories.find((story) => story.id === remixKey)
            || null;
    }, [featuredStories, myStories, normalizedRemixId]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isVoiceStarting, setIsVoiceStarting] = useState(false);
    const [localPhase, setLocalPhase] = useState<GenerationPhase>('idle');
    const voiceStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const generationPhase = useMemo<GenerationPhase>(() => {
        if (localPhase !== 'idle') return localPhase;
        if (productionState.phase !== 'idle' && productionState.phase !== 'completed' && productionState.phase !== 'error') {
            return productionState.phase as GenerationPhase;
        }
        return 'idle';
    }, [localPhase, productionState.phase]);

    const handleFinishRef = useRef<(() => void) | null>(null);
    const coverPreviewRef = useRef<any>(null);

    const {
        hasAgentId,
        convoHistory,
        voiceError,
        clearVoiceError,
        setVoiceErrorMessage,
        intakeSummaryRef,
        startConversation,
        stopConversation,
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
    } = useVoiceSession({ persona, isGenerating, triggerGenerateRef: handleFinishRef });

    const voiceStatusRef = useRef(status);
    useEffect(() => {
        voiceStatusRef.current = status;
    }, [status]);

    const clearVoiceStartTimeout = useCallback(() => {
        if (!voiceStartTimeoutRef.current) return;
        clearTimeout(voiceStartTimeoutRef.current);
        voiceStartTimeoutRef.current = null;
    }, []);

    useEffect(() => {
        if (status !== 'disconnected') {
            setIsVoiceStarting(false);
            clearVoiceStartTimeout();
        }
    }, [clearVoiceStartTimeout, status]);

    useEffect(() => {
        return () => {
            clearVoiceStartTimeout();
        };
    }, [clearVoiceStartTimeout]);

    const {
        soundscapeId,
        isSoundscapeEnabled,
        isSoundscapeMenuOpen,
        toggleSoundscapeMenu,
        closeSoundscapeMenu,
        handleSelectSoundscape,
        handleDisableSoundscape,
    } = useSoundscapeState({
        persona,
        isSessionActive,
        setAmbientSound,
        pauseAmbient,
        resumeAmbient,
    });

    const canInteract = isConnected && !isGenerating;

    const {
        selectedImageUri,
        selectedImageUrl,
        isSeasonalMoodSelected,
        canSelectMoodImage,
        imageAnalysis,
        isAnalyzingImage,
        imageAnalysisError,
        handlePickImage,
        handleSelectSeasonalMood,
        clearImage,
    } = useImageAnalysis({
        persona,
        isConnected,
        canInteract,
        voiceStatus: status,
        playLatencyMask,
        stopLatencyMask,
        remixId: normalizedRemixId || null,
        remixCoverUrl: remixSourceStory?.coverImageUrl || null,
    });

    const coverPreviewSource = useMemo(
        () => (selectedImageUri ? ({ uri: selectedImageUri } as const) : avatarAsset),
        [avatarAsset, selectedImageUri]
    );

    const canGenerate = canInteract && !isAnalyzingImage;

    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    const handleFinish = useCallback(() => {
        if (!persona) return;
        const vertexTextModel = resolveVertexTextModelOverride();
        const vertexImageModel = resolveVertexImageModelOverride();
        if (!isConnected) {
            Alert.alert('Offline', 'Please check your internet connection to generate a story.');
            return;
        }
        if (selectedImageUri && isAnalyzingImage) {
            Alert.alert('Analyzing...', 'Please wait for image analysis to finish.');
            return;
        }
        void (async () => {
            const flowStartMs = Date.now();
            const durationSec = await resolveStoryDurationSec();
            const flow = createFlowLogger('Generate Story', {
                meta: {
                    personaId: persona.id,
                    durationSec,
                    vertexTextModel: vertexTextModel || null,
                    vertexImageModel: vertexImageModel || null,
                    isConnected,
                    status,
                    isPlayingMask,
                    hasAgentId,
                    hasImage: Boolean(selectedImageUri),
                    hasImageAnalysis: Boolean(imageAnalysis),
                    convoHistoryCount: convoHistory.length,
                },
            });
            try {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsGenerating(true);
                setLocalPhase('stoppingVoice');

                flow.step('begin', { at: new Date(flowStartMs).toISOString() });
                await new Promise<void>((resolve) => setTimeout(resolve, 0));

                flow.step('stopConversation:begin', { status, isSessionActive });
                // If it's a voice session, give it a tiny moment to finish the "final" response if complete_intake was triggered by voice.
                if (isSessionActive) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                await stopConversation({ force: true });
                flow.step('stopConversation:done');

                if (isSoundscapeEnabled) {
                    resumeAmbient();
                }
                stopLatencyMask();
                playLatencyMask(persona, 'mask');
                flow.step('mask:begin');

                setLocalPhase('idle');

                const history = convoHistory.slice(-50);
                const intakeSummary = intakeSummaryRef.current || undefined;
                const remixKey = normalizedRemixId?.trim() || '';

                const storyId = await produceStory({
                    persona,
                    durationSec,
                    convoHistory: history,
                    intakeSummary,
                    imageAnalysis: imageAnalysis || null,
                    selectedImageUrl: selectedImageUrl || null,
                    remix: remixKey ? {
                        storyId: remixKey,
                        title: remixSourceStory?.title,
                        summary: remixSourceStory?.summary,
                        generation: remixSourceStory?.generation,
                        contextText: normalizedRemixContext?.trim() || null,
                    } : undefined,
                    vertexTextModel,
                    vertexImageModel,
                    soundscapeId: isSoundscapeEnabled ? (soundscapeId as SoundscapeId) : undefined,
                    requestId: flow.requestId,
                });

                if (storyId) {
                    setLocalPhase('openingPlayback');
                    const navigateStartMs = Date.now();
                    flow.step('navigate:playback', { storyId });
                    stopLatencyMask();
                    const coverRect = await new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
                        if (!coverPreviewRef.current) return resolve(null);
                        if (typeof coverPreviewRef.current.measureInWindow !== 'function') return resolve(null);
                        coverPreviewRef.current.measureInWindow((x: number, y: number, width: number, height: number) => resolve({ x, y, width, height }));
                    });
                    router.push({
                        pathname: '/library/[storyId]',
                        params: {
                            storyId,
                            autoplay: 1,
                            personaId: persona.id,
                            ...(selectedImageUri ? { coverUri: selectedImageUri } : {}),
                            ...(coverRect ? {
                                coverX: Math.round(coverRect.x),
                                coverY: Math.round(coverRect.y),
                                coverW: Math.round(coverRect.width),
                                coverH: Math.round(coverRect.height),
                            } : {}),
                        },
                    });
                    flow.step('navigate:done', { ms: Date.now() - navigateStartMs });
                } else {
                    throw new Error(productionState.error || 'Production returned no story ID');
                }
            } catch (error) {
                console.error('Failed to generate/save story:', error);
                const message = error instanceof Error ? error.message : String(error);
                if (message !== 'Cancelled') {
                    flow.error('failed', { message });
                    const supportCode = flow.requestId ? `\n\nSupport code: ${flow.requestId}` : '';
                    Alert.alert(
                        'Error',
                        `I am sorry, I could not craft your story just yet. Please try again.${supportCode}`
                    );
                }
            } finally {
                stopLatencyMask();
                flow.end({ isGenerating: false, totalMs: Date.now() - flowStartMs });
                setIsGenerating(false);
                setLocalPhase('idle');
            }
        })();
    }, [
        convoHistory,
        hasAgentId,
        imageAnalysis,
        intakeSummaryRef,
        isAnalyzingImage,
        isConnected,
        isPlayingMask,
        isSessionActive,
        isSoundscapeEnabled,
        normalizedRemixContext,
        normalizedRemixId,
        persona,
        playLatencyMask,
        produceStory,
        productionState.error,
        remixSourceStory,
        resumeAmbient,
        router,
        selectedImageUri,
        selectedImageUrl,
        soundscapeId,
        status,
        stopConversation,
        stopLatencyMask,
    ]);

    useEffect(() => {
        handleFinishRef.current = handleFinish;
    }, [handleFinish]);

    const toggleListening = useCallback(() => {
        if (!persona) return;
        if (!isConnected) {
            Alert.alert('Offline', 'Please check your internet connection to speak with the guide.');
            return;
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('ui:mic:press', {
                personaId: persona.id,
                status,
                isSessionActive,
                isVoiceStarting,
                isSoundscapeEnabled,
            });
        }
        const flow = createFlowLogger('ElevenLabs Toggle', {
            meta: { personaId: persona.id, isSessionActive, status, isPlayingMask, isConnected },
        });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isSessionActive || isVoiceStarting) {
            if (isAudioDebugEnabled()) {
                logAudioDebug('ui:mic:stopConversation', { personaId: persona.id });
            }
            setIsVoiceStarting(false);
            clearVoiceStartTimeout();
            flow.step('stopConversation:begin');
            void stopConversation()
                .catch((error) => flow.warn('stopConversation:error', error instanceof Error ? { message: error.message } : String(error)))
                .finally(() => flow.end());
            return;
        }
        if (isSoundscapeEnabled) {
            pauseAmbient({ fadeMs: 0 });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('ui:mic:startConversation', { personaId: persona.id });
        }
        setIsVoiceStarting(true);
        clearVoiceStartTimeout();
        voiceStartTimeoutRef.current = setTimeout(() => {
            voiceStartTimeoutRef.current = null;
            setIsVoiceStarting(false);
            if (voiceStatusRef.current === 'connected') return;
            if (isSoundscapeEnabled) {
                resumeAmbient({ fadeMs: 250 });
            }
            setVoiceErrorMessage('Voice connection failed. Tap the mic to retry.');
        }, 18000);
        clearVoiceError();
        flow.step('startConversation:begin');
        void startConversation()
            .catch((error) => {
                if (isSoundscapeEnabled) {
                    resumeAmbient({ fadeMs: 250 });
                }
                setIsVoiceStarting(false);
                clearVoiceStartTimeout();
                setVoiceErrorMessage('Voice connection failed. Tap the mic to retry.');
                flow.warn('startConversation:error', error instanceof Error ? { message: error.message } : String(error));
            })
            .finally(() => flow.end());
    }, [
        clearVoiceError,
        clearVoiceStartTimeout,
        isConnected,
        isPlayingMask,
        isSessionActive,
        isVoiceStarting,
        isSoundscapeEnabled,
        pauseAmbient,
        persona,
        resumeAmbient,
        setVoiceErrorMessage,
        setIsVoiceStarting,
        startConversation,
        status,
        stopConversation,
    ]);

    const personaStatusText = useMemo(() => {
        if (!persona) return '';
        if (!isConnected) return 'OFFLINE';
        if (isGenerating) return 'Crafting your perfect dream...';
        if (!hasAgentId) return 'Voice not configured';
        if (playingMaskType === 'welcome') return 'Welcoming you...';
        if (isVoiceStarting) return 'Connecting...';
        if (status === 'disconnected') return 'Ready when you are';
        if (isPlayingMask) return 'Connecting...';
        if (status === 'connected') return mode === 'speaking' ? 'Speaking...' : 'Listening...';
        return 'Connecting...';
    }, [hasAgentId, isConnected, isGenerating, isPlayingMask, isVoiceStarting, mode, persona, playingMaskType, status]);

    const micHintText = useMemo(() => {
        if (!persona) return '';
        if (!hasAgentId) return `Set EXPO_PUBLIC_ELEVENLABS_AGENT_${persona.id.toUpperCase()} to enable voice.`;
        if (!isConnected) return 'Offline';
        if (playingMaskType === 'welcome') return 'Welcome…';
        if (isVoiceStarting) return 'Connecting…';
        if (status === 'connecting') return 'Connecting…';
        if (status === 'connected') return `${mode === 'speaking' ? 'Speaking…' : 'Listening…'} (${convoHistory.length} msg)`;
        return 'Tap mic to share thoughts';
    }, [convoHistory.length, hasAgentId, isConnected, isVoiceStarting, mode, persona, playingMaskType, status]);

    const handleExportAgentAudio = useCallback(async () => {
        if (!agentAudioRecording?.uri) return;
        try {
            const result = await Share.share({
                title: 'ElevenLabs Agent Audio',
                message: 'ElevenLabs agent audio (WAV)',
                url: agentAudioRecording.uri,
            });
            if ((result as any)?.action === Share.sharedAction) {
                clearAgentAudioRecording();
            }
        } catch {
            // ignore
        }
    }, [agentAudioRecording?.uri, clearAgentAudioRecording]);

    return {
        persona,
        avatarAsset,
        hasAgentId,
        isConnected,
        isGenerating,
        isVoiceStarting,
        generationPhase,
        personaStatusText,
        micHintText,
        voiceError,
        isAgentAudioRecording,
        agentAudioRecording,
        handleExportAgentAudio,
        convoHistory,
        isSessionActive,
        status,
        isPlayingMask,
        playingMaskType,
        handleBack,
        toggleListening,
        canGenerate,
        handleFinish,
        coverPreviewRef,
        coverPreviewSource,
        selectedImageUri,
        selectedImageUrl,
        isSeasonalMoodSelected,
        canSelectMoodImage,
        imageAnalysis,
        isAnalyzingImage,
        imageAnalysisError,
        handlePickImage,
        handleSelectSeasonalMood,
        clearImage,
        soundscapeId,
        isSoundscapeEnabled,
        isSoundscapeMenuOpen,
        toggleSoundscapeMenu,
        closeSoundscapeMenu,
        handleSelectSoundscape,
        handleDisableSoundscape,
    };
}
