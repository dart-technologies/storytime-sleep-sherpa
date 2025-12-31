import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultSoundscapeId, getSoundscapeAsset, type SoundscapeId } from '../../lib/assetMapper';
import type { Persona } from '../../lib/personas';

type Params = {
    persona: Persona | null;
    isSessionActive: boolean;
    setAmbientSound: (source: any) => void;
    pauseAmbient: (options?: { fadeMs?: number }) => void;
    resumeAmbient: (options?: { volume?: number; fadeMs?: number }) => void;
};

export function useSoundscapeState({ persona, isSessionActive, setAmbientSound, pauseAmbient, resumeAmbient }: Params) {
    const [soundscapeId, setSoundscapeId] = useState<SoundscapeId>('falling-snow');
    const [isSoundscapeEnabled, setIsSoundscapeEnabled] = useState(true);
    const [isSoundscapeMenuOpen, setIsSoundscapeMenuOpen] = useState(false);

    useEffect(() => {
        setIsSoundscapeMenuOpen(false);
        if (!persona?.id) return;
        const defaultSoundscapeId = getDefaultSoundscapeId(persona.id);
        setSoundscapeId(defaultSoundscapeId);
        setIsSoundscapeEnabled(true);
        setAmbientSound(getSoundscapeAsset(defaultSoundscapeId));
    }, [persona?.id, setAmbientSound]);

    const wasVoiceActiveRef = useRef(false);
    useEffect(() => {
        if (!isSoundscapeEnabled) {
            wasVoiceActiveRef.current = false;
            return;
        }
        if (isSessionActive) {
            if (!wasVoiceActiveRef.current) {
                pauseAmbient();
                wasVoiceActiveRef.current = true;
            }
            return;
        }
        if (wasVoiceActiveRef.current) {
            resumeAmbient();
            wasVoiceActiveRef.current = false;
        }
    }, [isSessionActive, isSoundscapeEnabled, pauseAmbient, resumeAmbient]);

    const handleSelectSoundscape = useCallback((id: SoundscapeId) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSoundscapeId(id);
        setIsSoundscapeEnabled(true);
        setAmbientSound(getSoundscapeAsset(id));
    }, [setAmbientSound]);

    const handleDisableSoundscape = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSoundscapeEnabled(false);
        setAmbientSound(null);
    }, [setAmbientSound]);

    const toggleSoundscapeMenu = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSoundscapeMenuOpen((prev) => !prev);
    }, []);

    const closeSoundscapeMenu = useCallback(() => {
        setIsSoundscapeMenuOpen(false);
    }, []);

    return useMemo(() => ({
        soundscapeId,
        isSoundscapeEnabled,
        isSoundscapeMenuOpen,
        toggleSoundscapeMenu,
        closeSoundscapeMenu,
        handleSelectSoundscape,
        handleDisableSoundscape,
    }), [
        soundscapeId,
        isSoundscapeEnabled,
        isSoundscapeMenuOpen,
        toggleSoundscapeMenu,
        closeSoundscapeMenu,
        handleSelectSoundscape,
        handleDisableSoundscape,
    ]);
}
