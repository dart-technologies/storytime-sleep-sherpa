
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AudioProvider, useAudioPlayback, useAudioSettings } from '../../components/AudioProvider';

// Mocks
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSetVolume = jest.fn();
const mockStop = jest.fn();
const mockUnload = jest.fn();
const mockReplace = jest.fn();
const mockSeekTo = jest.fn();

const mockSetAudioModeAsync = jest.fn();

jest.mock('expo-audio', () => ({
    useAudioPlayer: () => {
        let volume = 1;
        let playing = false;
        return {
            loop: false,
            play: (...args: any[]) => {
                playing = true;
                return mockPlay(...args);
            },
            pause: (...args: any[]) => {
                playing = false;
                return mockPause(...args);
            },
            stop: mockStop,
            unload: mockUnload,
            replace: mockReplace,
            seekTo: (...args: any[]) => Promise.resolve(mockSeekTo(...args)),
            get playing() {
                return playing;
            },
            get volume() {
                return volume;
            },
            set volume(value: number) {
                volume = value;
                mockSetVolume(value);
            },
        };
    },
    setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AudioProvider>{children}</AudioProvider>
);

describe('AudioProvider', () => {
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    const originalCancelAnimationFrame = global.cancelAnimationFrame;
    const originalMathRandom = Math.random;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        global.requestAnimationFrame = ((cb: any) => setTimeout(() => cb(Date.now()), 16)) as any;
        global.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as any;
        Math.random = () => 0;
    });

    afterEach(() => {
        jest.useRealTimers();
        global.requestAnimationFrame = originalRequestAnimationFrame;
        global.cancelAnimationFrame = originalCancelAnimationFrame;
        Math.random = originalMathRandom;
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useAudioPlayback(), { wrapper });
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.currentUrl).toBeNull();
    });

    it('throws when hooks are used outside provider', () => {
        let playbackError: unknown;
        try {
            renderHook(() => useAudioPlayback());
        } catch (error) {
            playbackError = error;
        }
        expect(playbackError).toBeInstanceOf(Error);
        expect((playbackError as Error).message).toMatch(/useAudioPlayback must be used within an AudioProvider/);

        let settingsError: unknown;
        try {
            renderHook(() => useAudioSettings());
        } catch (error) {
            settingsError = error;
        }
        expect(settingsError).toBeInstanceOf(Error);
        expect((settingsError as Error).message).toMatch(/useAudioSettings must be used within an AudioProvider/);
    });

    it('playStory sets url and starts playback', async () => {
        const { result } = renderHook(() => useAudioPlayback(), { wrapper });

        await act(async () => {
            // playStory(source)
            await result.current.playStory('http://test.com/audio.mp3');
        });

        expect(result.current.currentUrl).toBe('http://test.com/audio.mp3');
        // We can check if internal mocks were called if we exposed them, 
        // but here checking state is sufficient for integration integration.
        // Also check if replace was called
        expect(mockReplace).toHaveBeenCalledWith('http://test.com/audio.mp3');
    });

    it('setAmbientSound replaces and plays ambient audio and can pause it later', async () => {
        const { result } = renderHook(() => useAudioPlayback(), { wrapper });

        act(() => {
            result.current.setAmbientSound('ambient.mp3');
        });
        expect(mockReplace).toHaveBeenCalledWith('ambient.mp3');
        expect(mockPlay).toHaveBeenCalled();

        mockPause.mockClear();
        act(() => {
            result.current.setAmbientSound(null);
        });
        jest.advanceTimersByTime(1600);
        expect(mockPause).toHaveBeenCalled();
    });

    it('playStory waits in chaos mode before starting', async () => {
        const { result } = renderHook(() => ({
            playback: useAudioPlayback(),
            settings: useAudioSettings(),
        }), { wrapper });

        act(() => {
            result.current.settings.toggleChaosMode();
        });

        mockReplace.mockClear();
        await act(async () => {
            const promise = result.current.playback.playStory('chaos.mp3');
            jest.advanceTimersByTime(1499);
            expect(mockReplace).not.toHaveBeenCalledWith('chaos.mp3');
            jest.advanceTimersByTime(1);
            await promise;
        });

        expect(mockReplace).toHaveBeenCalledWith('chaos.mp3');
    });

    it('pause/resume toggles playback logic', async () => {
        const { result } = renderHook(() => useAudioPlayback(), { wrapper });

        await act(async () => { await result.current.playStory('url'); });

        // pause()
        act(() => { result.current.pause(); });
        // pause() triggers a fade out then schedulePause.
        // It does NOT set isPlaying false immediately on the context unless we mock player state updates.
        // But it calls fade.

        // Advance timers to trigger the scheduled pause
        jest.advanceTimersByTime(1100);
        expect(mockPause).toHaveBeenCalled();

        // resume()
        mockPlay.mockClear();
        act(() => { result.current.resume(); });
        expect(mockPlay).toHaveBeenCalled();
    });

    it('fadeOut modulates volume', async () => {
        const { result } = renderHook(() => useAudioPlayback(), { wrapper });
        await act(async () => { await result.current.playStory('url'); });

        mockSetVolume.mockClear();
        act(() => { result.current.fadeOut(100); });

        // Advance timers
        jest.advanceTimersByTime(50);
        expect(mockSetVolume).toHaveBeenCalled();
        jest.advanceTimersByTime(100);
    });

    it('sets audio mode on mount and tolerates failures', async () => {
        mockSetAudioModeAsync.mockRejectedValueOnce(new Error('fail'));
        renderHook(() => useAudioPlayback(), { wrapper });
        await act(async () => {
            await Promise.resolve();
        });
        expect(mockSetAudioModeAsync).toHaveBeenCalled();
    });
});
