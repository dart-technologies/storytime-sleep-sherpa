import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AudioPlayer, setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import type { AudioSource } from 'expo-audio';
import { estimateAppMixVolume, getAudioDebugSampleIntervalMs, isAudioDebugEnabled, logAudioDebug, snapshotAudioPlayer } from '../lib/audioDebug';
import { isVerboseDebugLoggingEnabled } from '../lib/debugLogger';
import { redactUrlForLogs } from '../lib/urlUtils';

const AMBIENT_VOLUME_BASE = 0.25;
const AMBIENT_VOLUME_DURING_STORY = 0.12;
const STORY_START_VOLUME = 1.0;
const STORY_START_FADE_MS = 400;
const PLAYBACK_TOGGLE_FADE_MS = 200;

function redactAudioSource(source: AudioSource): string | number | null {
    if (source === null) return null;
    if (typeof source === 'number') return source;
    if (typeof source === 'string') return redactUrlForLogs(source) || source;
    if (typeof source === 'object' && source) {
        if (typeof (source as any).assetId === 'number') return (source as any).assetId;
        if (typeof (source as any).uri === 'string') return redactUrlForLogs((source as any).uri) || (source as any).uri;
    }
    return null;
}

interface AudioPlaybackContextType {
    player: AudioPlayer;
    ambientPlayer: AudioPlayer;
    playStory: (source: AudioSource) => void;
    setAmbientSound: (source: AudioSource) => void;
    pauseAmbient: (options?: { fadeMs?: number }) => void;
    resumeAmbient: (options?: { volume?: number; fadeMs?: number }) => void;
    pause: () => void;
    resume: () => void;
    isPlaying: boolean;
    currentUrl: AudioSource;
    ambientUrl: AudioSource;
    fadeIn: (duration?: number) => void;
    fadeOut: (duration?: number) => void;
}

interface AudioSettingsContextType {
    chaosMode: boolean;
    toggleChaosMode: () => void;
    isLowEnergyMode: boolean;
    toggleLowEnergyMode: () => void;
}

export type AudioContextType = AudioPlaybackContextType & AudioSettingsContextType;

const AudioPlaybackContext = createContext<AudioPlaybackContextType | null>(null);
const AudioSettingsContext = createContext<AudioSettingsContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const [currentUrl, setCurrentUrl] = useState<AudioSource>(null);
    const [ambientUrl, setAmbientUrl] = useState<AudioSource>(null);
    const [chaosMode, setChaosMode] = useState(false);
    const [isLowEnergyMode, setIsLowEnergyMode] = useState(false);

    // Ensure predictable audio behavior (silent switch + background + mixing).
    // This makes short UI sounds (latency masks) reliably audible on iOS.
    React.useEffect(() => {
        void (async () => {
            try {
                await setAudioModeAsync({
                    playsInSilentMode: true,
                    // Use `doNotMix` so iOS resets the AVAudioSession mode to `.default`.
                    // (`mixWithOthers` sets category options but may leave a prior voice/chat mode active.)
                    interruptionMode: 'doNotMix',
                    allowsRecording: false,
                    shouldPlayInBackground: true,
                    shouldRouteThroughEarpiece: false,
                });
                if (isVerboseDebugLoggingEnabled()) {
                    console.log('[Audio] audioMode:configured', {
                        playsInSilentMode: true,
                        interruptionMode: 'doNotMix',
                        allowsRecording: false,
                        shouldPlayInBackground: true,
                    });
                }
            } catch (error) {
                if (__DEV__) {
                    console.warn('[Audio] Failed to set global audio mode:', error);
                }
            }
        })();
    }, []);

    // The singleton story player
    const player = useAudioPlayer(null);
    // The singleton ambient player
    const ambientPlayer = useAudioPlayer(null);

    const currentUrlRef = useRef<AudioSource>(null);
    const ambientUrlRef = useRef<AudioSource>(null);
    React.useEffect(() => {
        currentUrlRef.current = currentUrl;
    }, [currentUrl]);
    React.useEffect(() => {
        ambientUrlRef.current = ambientUrl;
    }, [ambientUrl]);

    // Configure ambient player for looping
    React.useEffect(() => {
        if (ambientPlayer) {
            ambientPlayer.loop = true;
        }
    }, [ambientPlayer]);

    React.useEffect(() => {
        if (!isAudioDebugEnabled()) return;
        const intervalMs = getAudioDebugSampleIntervalMs(1000);
        if (intervalMs <= 0) return;

        const id = setInterval(() => {
            try {
                const storyPlaying = Boolean(player?.playing);
                const ambientPlaying = Boolean(ambientPlayer?.playing);
                if (!storyPlaying && !ambientPlaying) return;

                const storyVolume = typeof player?.volume === 'number' ? player.volume : 0;
                const ambientVolume = typeof ambientPlayer?.volume === 'number' ? ambientPlayer.volume : 0;
                const mix = estimateAppMixVolume([
                    { label: 'story', playing: storyPlaying, volume: storyVolume },
                    { label: 'ambient', playing: ambientPlaying, volume: ambientVolume },
                ]);

                logAudioDebug('sample', {
                    story: {
                        source: redactAudioSource(currentUrlRef.current),
                        ...snapshotAudioPlayer(player),
                    },
                    ambient: {
                        source: redactAudioSource(ambientUrlRef.current),
                        ...snapshotAudioPlayer(ambientPlayer),
                    },
                    mixEstimate: mix,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logAudioDebug('sample:error', { message });
            }
        }, intervalMs);

        return () => clearInterval(id);
    }, [ambientPlayer, player]);

    type FadeController = {
        token: number;
        rafId: number | null;
    };

    const storyFadeRef = useRef<FadeController>({ token: 0, rafId: null });
    const ambientFadeRef = useRef<FadeController>({ token: 0, rafId: null });
    const storyPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ambientPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelScheduledPause = useCallback((timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
        if (!timeoutRef.current) return;
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }, []);

    const schedulePause = useCallback((
        p: AudioPlayer,
        timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
        delayMs: number
    ) => {
        cancelScheduledPause(timeoutRef);
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            try {
                p.pause();
            } catch {
                // ignore
            }
        }, delayMs);
    }, [cancelScheduledPause]);

    const fadeTo = useCallback((p: AudioPlayer, fadeRef: React.MutableRefObject<FadeController>, toVolume: number, durationMs: number) => {
        fadeRef.current.token += 1;
        const token = fadeRef.current.token;

        if (fadeRef.current.rafId !== null) {
            cancelAnimationFrame(fadeRef.current.rafId);
            fadeRef.current.rafId = null;
        }

        const clamp = (value: number) => Math.max(0, Math.min(1, value));
        const from = clamp(typeof p.volume === 'number' ? p.volume : 0);
        const to = clamp(toVolume);

        if (durationMs <= 0) {
            p.volume = to;
            return;
        }

        const easeInOutCubic = (t: number) => (
            t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        );

        const startTime = Date.now();
        const tick = () => {
            if (fadeRef.current.token !== token) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = easeInOutCubic(progress);
            p.volume = from + (to - from) * eased;

            if (progress >= 1) {
                fadeRef.current.rafId = null;
                return;
            }
            fadeRef.current.rafId = requestAnimationFrame(tick);
        };
        fadeRef.current.rafId = requestAnimationFrame(tick);
    }, []);

    const fadeStoryTo = useCallback((toVolume: number, durationMs: number) => {
        fadeTo(player, storyFadeRef, toVolume, durationMs);
        if (isAudioDebugEnabled()) {
            logAudioDebug('fade:story', {
                toVolume,
                durationMs,
                story: snapshotAudioPlayer(player),
            });
        }
    }, [fadeTo, player]);

    const fadeAmbientTo = useCallback((toVolume: number, durationMs: number) => {
        fadeTo(ambientPlayer, ambientFadeRef, toVolume, durationMs);
        if (isAudioDebugEnabled()) {
            logAudioDebug('fade:ambient', {
                toVolume,
                durationMs,
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
    }, [ambientPlayer, fadeTo]);

    const playStory = useCallback(async (source: AudioSource) => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[Audio] playStory', { source: redactAudioSource(source), chaosMode });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('playStory:begin', {
                source: redactAudioSource(source),
                chaosMode,
                story: snapshotAudioPlayer(player),
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
        if (!source) return;
        if (chaosMode) {
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        }
        cancelScheduledPause(storyPauseTimeoutRef);
        setCurrentUrl(source);
        player.replace(source);
        try {
            await player.seekTo(0);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('NativeSharedObjectNotFoundException')) {
                console.warn('[Audio] Failed to seek story audio to 0:', error);
            }
        }
        player.volume = STORY_START_VOLUME;
        player.play();
        if (ambientUrl) {
            fadeAmbientTo(AMBIENT_VOLUME_DURING_STORY, 400);
        }
        fadeStoryTo(1, STORY_START_FADE_MS);
        if (isAudioDebugEnabled()) {
            logAudioDebug('playStory:started', {
                source: redactAudioSource(source),
                story: snapshotAudioPlayer(player),
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
    }, [ambientUrl, chaosMode, cancelScheduledPause, fadeAmbientTo, fadeStoryTo, player]);

    const setAmbientSound = useCallback((source: AudioSource) => {
        if (isVerboseDebugLoggingEnabled()) {
            console.log('[Audio] setAmbientSound', { source: redactAudioSource(source) });
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('setAmbientSound', {
                source: redactAudioSource(source),
                ambient: snapshotAudioPlayer(ambientPlayer),
                story: snapshotAudioPlayer(player),
            });
        }
        setAmbientUrl(source);
        if (source) {
            cancelScheduledPause(ambientPauseTimeoutRef);
            ambientPlayer.replace(source);
            ambientPlayer.volume = 0;
            ambientPlayer.play();
            const targetVolume = player.playing ? AMBIENT_VOLUME_DURING_STORY : AMBIENT_VOLUME_BASE;
            fadeAmbientTo(targetVolume, 2000); // Ambient is softer by default
        } else {
            fadeAmbientTo(0, 1500);
            schedulePause(ambientPlayer, ambientPauseTimeoutRef, 1500);
        }
    }, [ambientPlayer, cancelScheduledPause, fadeAmbientTo, player, schedulePause]);

    const pauseAmbient = useCallback((options?: { fadeMs?: number }) => {
        const fadeMs = typeof options?.fadeMs === 'number' ? options.fadeMs : 800;
        if (isAudioDebugEnabled()) {
            logAudioDebug('pauseAmbient', {
                fadeMs,
                ambient: snapshotAudioPlayer(ambientPlayer),
                story: snapshotAudioPlayer(player),
            });
        }
        fadeAmbientTo(0, fadeMs);
        if (fadeMs <= 0) {
            cancelScheduledPause(ambientPauseTimeoutRef);
            try {
                ambientPlayer.pause();
            } catch {
                // ignore
            }
            return;
        }
        schedulePause(ambientPlayer, ambientPauseTimeoutRef, fadeMs);
    }, [ambientPlayer, cancelScheduledPause, fadeAmbientTo, schedulePause]);

    const resumeAmbient = useCallback((options?: { volume?: number; fadeMs?: number }) => {
        if (!ambientUrl) return;
        const defaultVolume = player.playing ? AMBIENT_VOLUME_DURING_STORY : AMBIENT_VOLUME_BASE;
        const targetVolume = typeof options?.volume === 'number' ? options.volume : defaultVolume;
        const fadeMs = typeof options?.fadeMs === 'number' ? options.fadeMs : 0;

        if (isAudioDebugEnabled()) {
            logAudioDebug('resumeAmbient', {
                ambientUrl: redactAudioSource(ambientUrl),
                targetVolume,
                fadeMs,
                ambient: snapshotAudioPlayer(ambientPlayer),
                story: snapshotAudioPlayer(player),
            });
        }
        cancelScheduledPause(ambientPauseTimeoutRef);
        try {
            ambientPlayer.play();
        } catch {
            // ignore
        }

        if (fadeMs <= 0) {
            ambientPlayer.volume = targetVolume;
            return;
        }

        fadeAmbientTo(targetVolume, fadeMs);
    }, [ambientPlayer, ambientUrl, cancelScheduledPause, fadeAmbientTo, player]);

    const pause = useCallback(() => {
        if (isAudioDebugEnabled()) {
            logAudioDebug('pauseAll', {
                story: snapshotAudioPlayer(player),
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
        fadeStoryTo(0, PLAYBACK_TOGGLE_FADE_MS);
        fadeAmbientTo(0, PLAYBACK_TOGGLE_FADE_MS);
        schedulePause(player, storyPauseTimeoutRef, PLAYBACK_TOGGLE_FADE_MS);
        schedulePause(ambientPlayer, ambientPauseTimeoutRef, PLAYBACK_TOGGLE_FADE_MS);
    }, [ambientPlayer, fadeAmbientTo, fadeStoryTo, player, schedulePause]);

    const resume = useCallback(() => {
        if (isAudioDebugEnabled()) {
            logAudioDebug('resumeAll', {
                story: snapshotAudioPlayer(player),
                ambient: snapshotAudioPlayer(ambientPlayer),
            });
        }
        cancelScheduledPause(storyPauseTimeoutRef);
        cancelScheduledPause(ambientPauseTimeoutRef);
        if (currentUrl) player.play();
        if (ambientUrl) ambientPlayer.play();
        fadeStoryTo(currentUrl ? 1 : 0, PLAYBACK_TOGGLE_FADE_MS);
        if (ambientUrl) {
            const targetVolume = currentUrl ? AMBIENT_VOLUME_DURING_STORY : AMBIENT_VOLUME_BASE;
            fadeAmbientTo(targetVolume, PLAYBACK_TOGGLE_FADE_MS);
        }
    }, [ambientPlayer, ambientUrl, cancelScheduledPause, currentUrl, fadeAmbientTo, fadeStoryTo, player]);

    const fadeIn = useCallback((duration = 1000) => {
        fadeStoryTo(currentUrl ? 1 : 0, duration);
        const targetVolume = currentUrl ? AMBIENT_VOLUME_DURING_STORY : AMBIENT_VOLUME_BASE;
        fadeAmbientTo(targetVolume, duration);
    }, [currentUrl, fadeAmbientTo, fadeStoryTo]);

    const fadeOut = useCallback((duration = 1000) => {
        fadeStoryTo(0, duration);
        fadeAmbientTo(0, duration);
    }, [fadeAmbientTo, fadeStoryTo]);

    const toggleChaosMode = useCallback(() => {
        setChaosMode(prev => !prev);
    }, []);

    const toggleLowEnergyMode = useCallback(() => {
        setIsLowEnergyMode(prev => !prev);
    }, []);

    const playbackValue = useMemo<AudioPlaybackContextType>(() => ({
        player,
        ambientPlayer,
        playStory,
        setAmbientSound,
        pauseAmbient,
        resumeAmbient,
        pause,
        resume,
        isPlaying: player.playing,
        currentUrl,
        ambientUrl,
        fadeIn,
        fadeOut,
    }), [
        player,
        ambientPlayer,
        playStory,
        setAmbientSound,
        pauseAmbient,
        resumeAmbient,
        pause,
        resume,
        currentUrl,
        ambientUrl,
        fadeIn,
        fadeOut,
    ]);

    const settingsValue = useMemo<AudioSettingsContextType>(() => ({
        chaosMode,
        toggleChaosMode,
        isLowEnergyMode,
        toggleLowEnergyMode,
    }), [chaosMode, toggleChaosMode, isLowEnergyMode, toggleLowEnergyMode]);

    return (
        <AudioPlaybackContext.Provider value={playbackValue}>
            <AudioSettingsContext.Provider value={settingsValue}>
                {children}
            </AudioSettingsContext.Provider>
        </AudioPlaybackContext.Provider>
    );
}

export function useAudioPlayback(): AudioPlaybackContextType {
    const context = useContext(AudioPlaybackContext);
    if (!context) {
        throw new Error('useAudioPlayback must be used within an AudioProvider');
    }
    return context;
}

export function useAudioSettings(): AudioSettingsContextType {
    const context = useContext(AudioSettingsContext);
    if (!context) {
        throw new Error('useAudioSettings must be used within an AudioProvider');
    }
    return context;
}

export function useAudio(): AudioContextType {
    const playback = useAudioPlayback();
    const settings = useAudioSettings();
    return useMemo(() => ({ ...playback, ...settings }), [playback, settings]);
}
