import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAudioDebugEnabled, logAudioDebug, redactAudioSourceForLogs, snapshotAudioPlayer } from '../../lib/audioDebug';
import { getPersonaMask } from '../../lib/assetMapper';
import { isVerboseDebugLoggingEnabled } from '../../lib/debugLogger';
import type { Persona, PersonaId } from '../../lib/personas';
import type { LatencyMaskType } from './types';

type PlayingMaskState = { personaId: PersonaId; type: LatencyMaskType } | null;

type Params = {
    ambientPlayer: AudioPlayer | null;
    setAudioForPlayback: () => Promise<void>;
};

export function useLatencyMaskAudio({ ambientPlayer, setAudioForPlayback }: Params) {
    const [playingMask, setPlayingMask] = useState<PlayingMaskState>(null);
    const playingMaskType = playingMask?.type ?? null;

    const maskSource = playingMask ? getPersonaMask(playingMask.personaId, playingMask.type) : null;
    const maskPlayer = useAudioPlayer(maskSource, { keepAudioSessionActive: true });
    const maskStatus = useAudioPlayerStatus(maskPlayer);
    const isPlayingMask = Boolean(playingMaskType) && maskStatus.playing;

    const maskEverPlayedRef = useRef(false);
    const maskStatusRef = useRef(maskStatus);
    const playingMaskRef = useRef(playingMask);
    const ambientVolumeBeforeMaskRef = useRef<number | null>(null);
    const maskStatusLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        maskStatusRef.current = maskStatus;
    }, [maskStatus]);

    useEffect(() => {
        playingMaskRef.current = playingMask;
    }, [playingMask]);

    const clearMaskStatusLogTimer = useCallback(() => {
        if (!maskStatusLogTimerRef.current) return;
        clearTimeout(maskStatusLogTimerRef.current);
        maskStatusLogTimerRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            clearMaskStatusLogTimer();
        };
    }, [clearMaskStatusLogTimer]);

    const duckAmbientForMask = useCallback(() => {
        if (!ambientPlayer) return;
        if (!ambientPlayer.playing) return;
        if (ambientVolumeBeforeMaskRef.current !== null) return;

        ambientVolumeBeforeMaskRef.current = ambientPlayer.volume;
        ambientPlayer.volume = Math.min(ambientPlayer.volume, 0.15);
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[Audio] ambient:duck', { toVolume: ambientPlayer.volume });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:ambient:duck', {
                toVolume: ambientPlayer.volume,
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
    }, [ambientPlayer]);

    const restoreAmbientAfterMask = useCallback(() => {
        const previous = ambientVolumeBeforeMaskRef.current;
        ambientVolumeBeforeMaskRef.current = null;
        if (previous === null) return;
        if (!ambientPlayer) return;
        if (!ambientPlayer.playing) return;

        ambientPlayer.volume = previous;
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[Audio] ambient:restore', { toVolume: previous });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:ambient:restore', {
                toVolume: previous,
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
    }, [ambientPlayer]);

    const safePauseMask = useCallback(() => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[ElevenLabs] mask:pause', { playingMask });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:pause', {
                playingMask,
                mask: snapshotAudioPlayer(maskPlayer),
            });
        }
        clearMaskStatusLogTimer();
        try {
            maskPlayer?.pause();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('NativeSharedObjectNotFoundException')) {
                console.warn('[ElevenLabs] Failed to pause latency mask audio:', error);
            }
        }
    }, [clearMaskStatusLogTimer, maskPlayer, playingMask]);

    const safePlayMask = useCallback(async () => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[ElevenLabs] mask:play', {
                playingMask,
                sourceType: typeof maskSource,
                source: maskSource,
            });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:play', {
                playingMask,
                source: redactAudioSourceForLogs(maskSource),
                mask: snapshotAudioPlayer(maskPlayer),
            });
        }
        clearMaskStatusLogTimer();
        duckAmbientForMask();
        await setAudioForPlayback();
        try {
            await maskPlayer.seekTo(0).catch(() => undefined);
            maskPlayer.volume = 1;
            maskPlayer.muted = false;
            maskPlayer?.play();
            if (isAudioDebugEnabled()) {
                logAudioDebug('mask:play:started', {
                    playingMask,
                    source: redactAudioSourceForLogs(maskSource),
                    mask: snapshotAudioPlayer(maskPlayer),
                });
            }
            if (isVerboseDebugLoggingEnabled()) {
                maskStatusLogTimerRef.current = setTimeout(() => {
                    maskStatusLogTimerRef.current = null;
                    try {
                        const statusSnapshot = maskStatusRef.current;
                        let muted: boolean | undefined = undefined;
                        let volume: number | undefined = undefined;
                        try {
                            muted = maskPlayer.muted;
                            volume = maskPlayer.volume;
                        } catch (innerError) {
                            const message = innerError instanceof Error ? innerError.message : String(innerError);
                            if (!message.includes('NativeSharedObjectNotFoundException')) {
                                console.warn('[ElevenLabs] mask:status read failed', { message });
                            }
                        }
                        console.log('[ElevenLabs] mask:status', {
                            playingMask: playingMaskRef.current,
                            isLoaded: statusSnapshot.isLoaded,
                            playing: statusSnapshot.playing,
                            currentTime: statusSnapshot.currentTime,
                            duration: statusSnapshot.duration,
                            didJustFinish: statusSnapshot.didJustFinish,
                            muted,
                            volume,
                        });
                    } catch (logError) {
                        const message = logError instanceof Error ? logError.message : String(logError);
                        if (!message.includes('NativeSharedObjectNotFoundException')) {
                            console.warn('[ElevenLabs] mask:status failed', { message });
                        }
                    }
                }, 250);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('NativeSharedObjectNotFoundException')) {
                console.warn('[ElevenLabs] Failed to play latency mask audio:', error);
            }
        }
    }, [clearMaskStatusLogTimer, duckAmbientForMask, maskPlayer, maskSource, playingMask, setAudioForPlayback]);

    const clearLatencyMask = useCallback(() => {
        safePauseMask();
        setPlayingMask(null);
    }, [safePauseMask]);

    const stopLatencyMask = useCallback(() => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[ElevenLabs] mask:stop');
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:stop', { playingMask: playingMaskRef.current });
        }
        clearLatencyMask();
    }, [clearLatencyMask]);

    const playLatencyMask = useCallback((persona: Persona, type: LatencyMaskType) => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[ElevenLabs] mask:start', { personaId: persona.id, type });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('mask:start', { personaId: persona.id, type });
        }
        setPlayingMask({ personaId: persona.id, type });
    }, []);

    useEffect(() => {
        if (!playingMask) return;
        void safePlayMask();
    }, [playingMask, safePlayMask]);

    useEffect(() => {
        if (!playingMask) {
            maskEverPlayedRef.current = false;
            restoreAmbientAfterMask();
            return;
        }
        maskEverPlayedRef.current = false;
    }, [playingMask, restoreAmbientAfterMask]);

    useEffect(() => {
        if (!playingMask) return;
        if (!maskStatus.playing) return;
        maskEverPlayedRef.current = true;
    }, [maskStatus.playing, playingMask]);

    useEffect(() => {
        if (!playingMask) return;
        if (!maskStatus.didJustFinish) return;
        if (!maskEverPlayedRef.current) return;
        stopLatencyMask();
    }, [maskStatus.didJustFinish, playingMask, stopLatencyMask]);

    return useMemo(() => ({
        playingMaskType,
        isPlayingMask,
        playLatencyMask,
        stopLatencyMask,
        clearLatencyMask,
    }), [playingMaskType, isPlayingMask, playLatencyMask, stopLatencyMask, clearLatencyMask]);
}
