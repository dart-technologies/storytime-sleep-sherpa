import type { AudioPlayer, AudioSource } from 'expo-audio';
import { Platform } from 'react-native';
import { redactUrlForLogs } from './urlUtils';

export type AudioDebugMode = 'off' | 'basic' | 'verbose';

function trim(value: string | undefined): string {
    return (value || '').trim();
}

export function getAudioDebugMode(): AudioDebugMode {
    const raw = trim(process.env.EXPO_PUBLIC_AUDIO_DEBUG).toLowerCase();
    if (raw === 'off' || raw === '0' || raw === 'false' || raw === 'none') return 'off';
    if (raw === 'verbose' || raw === 'true' || raw === '1' || raw === 'on') return 'verbose';
    if (raw === 'basic') return 'basic';
    return 'off';
}

export function isAudioDebugEnabled(): boolean {
    return getAudioDebugMode() !== 'off';
}

export function isAudioDebugVerbose(): boolean {
    return getAudioDebugMode() === 'verbose';
}

export function getAudioDebugSampleIntervalMs(fallbackMs = 1000): number {
    const raw = trim(process.env.EXPO_PUBLIC_AUDIO_DEBUG_SAMPLE_MS);
    if (!raw) return fallbackMs;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallbackMs;
    return Math.max(0, parsed);
}

export function redactAudioSourceForLogs(source: AudioSource): string | number | null {
    if (source === null) return null;
    if (typeof source === 'number') return source;
    if (typeof source === 'string') return redactUrlForLogs(source) || source;
    if (typeof source === 'object' && source) {
        if (typeof (source as any).assetId === 'number') return (source as any).assetId;
        if (typeof (source as any).uri === 'string') return redactUrlForLogs((source as any).uri) || (source as any).uri;
    }
    return null;
}

type AudioPlayerSnapshot = {
    platform: string;
    id?: number;
    playing?: boolean;
    muted?: boolean;
    loop?: boolean;
    paused?: boolean;
    isLoaded?: boolean;
    isBuffering?: boolean;
    currentTime?: number;
    duration?: number;
    volume?: number;
    error?: string;
};

export function snapshotAudioPlayer(player: AudioPlayer | null): {
    platform: string;
    id?: number;
    playing?: boolean;
    muted?: boolean;
    loop?: boolean;
    paused?: boolean;
    isLoaded?: boolean;
    isBuffering?: boolean;
    currentTime?: number;
    duration?: number;
    volume?: number;
    error?: string;
} {
    const snapshot: AudioPlayerSnapshot = { platform: Platform.OS };
    if (!player) return snapshot;
    try {
        snapshot.id = player.id;
        snapshot.playing = player.playing;
        snapshot.muted = player.muted;
        snapshot.loop = player.loop;
        snapshot.paused = player.paused;
        snapshot.isLoaded = player.isLoaded;
        snapshot.isBuffering = player.isBuffering;
        snapshot.currentTime = player.currentTime;
        snapshot.duration = player.duration;
        snapshot.volume = player.volume;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        snapshot.error = message;
    }
    return snapshot;
}

export function estimateAppMixVolume(inputs: Array<{ label: string; playing: boolean; volume: number }>): {
    total: number;
    playingCount: number;
    max: number;
} {
    let total = 0;
    let max = 0;
    let playingCount = 0;
    for (const input of inputs) {
        if (!input.playing) continue;
        playingCount += 1;
        total += input.volume;
        max = Math.max(max, input.volume);
    }
    return { total, playingCount, max };
}

export function logAudioDebug(event: string, meta?: Record<string, unknown>): void {
    const mode = getAudioDebugMode();
    if (mode === 'off') return;

    const nowIso = new Date().toISOString();
    const line = `[${nowIso}] [AudioDebug] ${event}`;

    if (mode === 'basic' || !meta || !Object.keys(meta).length) {
        // eslint-disable-next-line no-console
        console.log(line);
        return;
    }

    // eslint-disable-next-line no-console
    console.log(line, meta);
}
