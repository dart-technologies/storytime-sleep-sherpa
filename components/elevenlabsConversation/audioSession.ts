import { setAudioModeAsync } from 'expo-audio';
import type { AppleAudioCategoryOption } from '@livekit/react-native';
import { Platform } from 'react-native';
import { isAudioDebugEnabled, logAudioDebug } from '../../lib/audioDebug';
import { isVerboseDebugLoggingEnabled } from '../../lib/debugLogger';
import { sleep } from '../../lib/promiseUtils';

type IosAppleAudioMode = 'default' | 'spokenAudio' | 'voiceChat' | 'videoChat';

function parseIosAppleAudioMode(raw: string | undefined, fallback: IosAppleAudioMode): IosAppleAudioMode {
    const normalized = String(raw || '').trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === 'default') return 'default';
    if (normalized === 'spoken' || normalized === 'spokenaudio') return 'spokenAudio';
    if (normalized === 'voicechat') return 'voiceChat';
    if (normalized === 'videochat') return 'videoChat';
    return fallback;
}

function resolveIosVoiceAudioMode(): IosAppleAudioMode {
    return parseIosAppleAudioMode(process.env.EXPO_PUBLIC_IOS_VOICE_AUDIO_MODE, 'spokenAudio');
}

function resolveIosPlaybackAudioMode(): IosAppleAudioMode {
    return parseIosAppleAudioMode(process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE, 'spokenAudio');
}

async function configureAndStartLiveKitAudioSession(): Promise<void> {
    if (Platform.OS === 'web') return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@livekit/react-native') as typeof import('@livekit/react-native');
    const { AudioSession } = mod;

    const config: Parameters<typeof AudioSession.configureAudio>[0] = {};
    if (Platform.OS === 'ios') {
        config.ios = { defaultOutput: 'speaker' };
    } else if (Platform.OS === 'android') {
        config.android = { audioTypeOptions: mod.AndroidAudioTypePresets.communication };
    }

    if (Object.keys(config).length > 0) {
        await AudioSession.configureAudio(config);
    }

    // Ensure LiveKit keeps its audio session alive even if Expo plays short sounds during the call.
    await AudioSession.startAudioSession();
}

export async function setAudioModeForPlaybackFallback(): Promise<void> {
    const mode = {
        playsInSilentMode: true,
        interruptionMode: 'doNotMix' as const,
        allowsRecording: false,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
    };

    let lastError: unknown = undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            if (isAudioDebugEnabled()) {
                logAudioDebug('expoAudio:setAudioMode:playback', mode as any);
            }
            await setAudioModeAsync(mode);
            return;
        } catch (error) {
            lastError = error;
            await sleep(150 * attempt);
        }
    }

    if (__DEV__ && lastError) {
        console.warn('[ElevenLabs] Failed to set Expo audio mode for playback:', lastError);
    }
}

export async function setAudioModeForVoiceFallback(): Promise<void> {
    try {
        const mode = {
            playsInSilentMode: true,
            // Keep voice on the same audio session semantics as playback so iOS doesn't
            // stick to a "quiet" chat/recording curve after the session ends.
            interruptionMode: 'doNotMix' as const,
            allowsRecording: true,
            shouldPlayInBackground: true,
            shouldRouteThroughEarpiece: false,
        };
        if (isAudioDebugEnabled()) {
            logAudioDebug('expoAudio:setAudioMode:voice', mode as any);
        }
        await setAudioModeAsync(mode);
    } catch (error) {
        if (__DEV__) {
            console.warn('[ElevenLabs] Failed to set Expo audio mode for voice:', error);
        }
    }
}

async function stopLiveKitAudioSession(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
        await AudioSession.stopAudioSession();
    } catch (error) {
        if (__DEV__ && isVerboseDebugLoggingEnabled()) {
            console.warn('[ElevenLabs] Failed to stop LiveKit audio session:', error);
        }
    }
}

export async function setAudioForVoice(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (isAudioDebugEnabled()) {
        logAudioDebug('audioSession:setAudioForVoice:begin', {
            platform: Platform.OS,
            iosVoiceAudioMode: Platform.OS === 'ios' ? resolveIosVoiceAudioMode() : null,
        });
    }
    await stopLiveKitAudioSession();
    await sleep(50);
    await setAudioModeForVoiceFallback();
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        await configureAndStartLiveKitAudioSession();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
        await AudioSession.setDefaultRemoteAudioTrackVolume(1);
        if (Platform.OS === 'ios') {
            const voiceAudioMode = resolveIosVoiceAudioMode();
            if (isAudioDebugEnabled()) {
                try {
                    const outputs = await AudioSession.getAudioOutputs();
                    logAudioDebug('livekit:audioOutputs', { outputs });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    logAudioDebug('livekit:audioOutputs:error', { message });
                }
            }
            const voiceConfig = {
                audioCategory: 'playAndRecord' as const,
                // Avoid `mixWithOthers` to reduce iOS treating this like "secondary audio"
                // (screen recordings were capturing audio too quietly).
                audioCategoryOptions: [
                    'allowAirPlay',
                    'allowBluetooth',
                    'allowBluetoothA2DP',
                    'defaultToSpeaker',
                ] as AppleAudioCategoryOption[],
            };
            let appliedVoiceAudioMode: IosAppleAudioMode = voiceAudioMode;
            try {
                await AudioSession.setAppleAudioConfiguration({ ...voiceConfig, audioMode: voiceAudioMode });
            } catch (error) {
                if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                    console.warn('[ElevenLabs] Failed to set voice Apple audio configuration:', error);
                }
                if (voiceAudioMode !== 'default') {
                    appliedVoiceAudioMode = 'default';
                    try {
                        await AudioSession.setAppleAudioConfiguration({ ...voiceConfig, audioMode: 'default' });
                    } catch (fallbackError) {
                        if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                            console.warn('[ElevenLabs] Failed to fall back to default iOS voice audio mode:', fallbackError);
                        }
                    }
                }
            }
            if (isAudioDebugEnabled()) {
                logAudioDebug('livekit:setAppleAudioConfiguration:voice', {
                    ...voiceConfig,
                    requestedAudioMode: voiceAudioMode,
                    audioMode: appliedVoiceAudioMode,
                });
            }
        }
        if (isAudioDebugEnabled()) {
            logAudioDebug('audioSession:setAudioForVoice:done');
        }
    } catch (error) {
        if (isAudioDebugEnabled()) {
            const message = error instanceof Error ? error.message : String(error);
            logAudioDebug('audioSession:setAudioForVoice:error', { message });
        }
        if (__DEV__ && isVerboseDebugLoggingEnabled()) {
            console.warn('[ElevenLabs] Failed to set voice audio mode:', error);
        }
    }
}

export async function setAudioForPlayback(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (isAudioDebugEnabled()) {
        logAudioDebug('audioSession:setAudioForPlayback:begin', {
            platform: Platform.OS,
            iosPlaybackAudioMode: Platform.OS === 'ios' ? resolveIosPlaybackAudioMode() : null,
        });
    }
    await stopLiveKitAudioSession();
    await sleep(100);
    await setAudioModeForPlaybackFallback();
    if (Platform.OS === 'ios') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
            const playbackAudioMode = resolveIosPlaybackAudioMode();
            const playbackConfig = {
                audioCategory: 'playback' as const,
                audioCategoryOptions: [
                    'allowAirPlay',
                    'allowBluetoothA2DP',
                ] as AppleAudioCategoryOption[],
            };
            let appliedPlaybackAudioMode: IosAppleAudioMode = playbackAudioMode;
            try {
                await AudioSession.setAppleAudioConfiguration({ ...playbackConfig, audioMode: playbackAudioMode });
            } catch (error) {
                if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                    console.warn('[ElevenLabs] Failed to set playback Apple audio configuration:', error);
                }
                if (playbackAudioMode !== 'default') {
                    appliedPlaybackAudioMode = 'default';
                    try {
                        await AudioSession.setAppleAudioConfiguration({ ...playbackConfig, audioMode: 'default' });
                    } catch (fallbackError) {
                        if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                            console.warn('[ElevenLabs] Failed to fall back to default iOS playback audio mode:', fallbackError);
                        }
                    }
                }
            }
            if (isAudioDebugEnabled()) {
                logAudioDebug('livekit:setAppleAudioConfiguration:playback', {
                    ...playbackConfig,
                    requestedAudioMode: playbackAudioMode,
                    audioMode: appliedPlaybackAudioMode,
                });
            }
        } catch (error) {
            if (__DEV__ && isVerboseDebugLoggingEnabled()) {
                console.warn('[ElevenLabs] Failed to set playback Apple audio configuration:', error);
            }
        }
    }
    if (isAudioDebugEnabled()) {
        logAudioDebug('audioSession:setAudioForPlayback:done');
    }
}
