import { AudioPlayer } from 'expo-audio';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export function useSleepTimer(player: AudioPlayer | null) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<any>(null);
    const initialVolumeRef = useRef<number>(1.0);

    const startTimer = useCallback((minutes: number) => {
        setTimeLeft(minutes * 60);
        setIsActive(true);
        if (player) {
            initialVolumeRef.current = player.volume;
        }
    }, [player]);

    const stopTimer = useCallback(() => {
        setTimeLeft(null);
        setIsActive(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    }, []);

    useEffect(() => {
        if (isActive && timeLeft !== null && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 0) {
                        clearInterval(intervalRef.current!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0) {
            if (player) {
                player.pause();
            }
            stopTimer();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, timeLeft, player, stopTimer]);

    // Volume Fading logic
    useEffect(() => {
        if (isActive && timeLeft !== null && player) {
            const FADE_WINDOW = 60; // Start fading in the last 60 seconds
            if (timeLeft <= FADE_WINDOW) {
                const newVolume = (timeLeft / FADE_WINDOW) * initialVolumeRef.current;
                player.volume = Math.max(0, newVolume);
            }
        }
    }, [timeLeft, isActive, player]);

    return useMemo(() => ({
        timeLeft,
        isActive,
        startTimer,
        stopTimer,
        minutesLeft: timeLeft !== null ? Math.ceil(timeLeft / 60) : 0,
    }), [timeLeft, isActive, startTimer, stopTimer]);
}
