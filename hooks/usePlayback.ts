import type { AudioSource } from 'expo-audio';
import { useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useMemo, useState } from 'react';
import { useAudioPlayback, useAudioSettings } from '../components/AudioProvider';
import { Persona } from '../lib/personas';

export type PlaybackState = 'idle' | 'playing';

export function usePlayback(persona: Persona | null) {
    const [state, setState] = useState<PlaybackState>('idle');

    // Global audio context
    const {
        playStory: playGlobalStory,
        player: storyPlayer,
        ambientPlayer,
        setAmbientSound,
        pause: pauseGlobal,
        resume: resumeGlobal,
    } = useAudioPlayback();
    const { chaosMode, toggleChaosMode } = useAudioSettings();
    const storyStatus = useAudioPlayerStatus(storyPlayer);
    const ambientStatus = useAudioPlayerStatus(ambientPlayer);

    const atmosphereType = persona?.id === 'kai' ? 'kai' : persona?.id === 'river' ? 'river' : 'luna';

    const playStory = useCallback(async (source: AudioSource) => {
        playGlobalStory(source);
        setState('playing');
    }, [playGlobalStory]);

    const togglePlayback = useCallback(() => {
        const isActuallyPlaying = Boolean(storyPlayer?.playing || storyStatus.playing);
        if (isActuallyPlaying) {
            pauseGlobal();
            return;
        }
        if (state !== 'playing') return;
        resumeGlobal();
    }, [pauseGlobal, resumeGlobal, state, storyPlayer?.playing, storyStatus.playing]);

    return useMemo(() => ({
        state,
        atmosphereType,
        playStory,
        setAmbientSound,
        pausePlayback: pauseGlobal,
        resumePlayback: resumeGlobal,
        togglePlayback,
        isPlaying: storyStatus.playing,
        isPlayingAmbient: ambientStatus.playing,
        didJustFinish: storyStatus.didJustFinish,
        storyPlayer,
        ambientPlayer,
        chaosMode,
        toggleChaosMode
    }), [
        state,
        atmosphereType,
        playStory,
        setAmbientSound,
        pauseGlobal,
        resumeGlobal,
        togglePlayback,
        storyStatus.playing,
        ambientStatus.playing,
        storyStatus.didJustFinish,
        storyPlayer,
        ambientPlayer,
        chaosMode,
        toggleChaosMode
    ]);
}
