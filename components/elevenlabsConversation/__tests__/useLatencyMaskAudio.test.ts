import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../../lib/debugLogger', () => {
    const actual = jest.requireActual('../../../lib/debugLogger');
    return { ...actual, isDebugLoggingEnabled: () => false };
});

jest.mock('../../../lib/assetMapper', () => ({
    getPersonaMask: () => 123,
}));

const mockMaskPlayer = {
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    volume: 0,
    muted: true,
};

let currentStatus: any = {
    isLoaded: true,
    playing: false,
    currentTime: 0,
    duration: 1,
    didJustFinish: false,
};

const mockUseAudioPlayer = jest.fn((..._args: any[]) => mockMaskPlayer);
const mockUseAudioPlayerStatus = jest.fn((..._args: any[]) => currentStatus);

jest.mock('expo-audio', () => ({
    useAudioPlayer: (...args: any[]) => mockUseAudioPlayer(...args),
    useAudioPlayerStatus: (...args: any[]) => mockUseAudioPlayerStatus(...args),
}));

describe('components/elevenlabsConversation/useLatencyMaskAudio', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentStatus = {
            isLoaded: true,
            playing: false,
            currentTime: 0,
            duration: 1,
            didJustFinish: false,
        };
    });

    it('plays a latency mask and ducks/restores ambient audio', async () => {
        const ambientPlayer: any = { playing: true, volume: 0.5 };
        const setAudioForPlayback = jest.fn(async () => undefined);

        const { useLatencyMaskAudio } = require('../useLatencyMaskAudio') as typeof import('../useLatencyMaskAudio');

        const { result } = renderHook(() => useLatencyMaskAudio({ ambientPlayer, setAudioForPlayback }));

        act(() => {
            result.current.playLatencyMask({ id: 'luna' } as any, 'mask');
        });

        await waitFor(() => expect(mockMaskPlayer.play).toHaveBeenCalled());
        expect(setAudioForPlayback).toHaveBeenCalled();
        expect(ambientPlayer.volume).toBe(0.15);

        act(() => {
            result.current.stopLatencyMask();
        });

        await waitFor(() => expect(mockMaskPlayer.pause).toHaveBeenCalled());
        expect(ambientPlayer.volume).toBe(0.5);
    });

    it('stops after playback finishes', async () => {
        const ambientPlayer: any = { playing: true, volume: 0.5 };
        const setAudioForPlayback = jest.fn(async () => undefined);

        const { useLatencyMaskAudio } = require('../useLatencyMaskAudio') as typeof import('../useLatencyMaskAudio');

        const { result, rerender } = renderHook(() => useLatencyMaskAudio({ ambientPlayer, setAudioForPlayback }));

        act(() => {
            result.current.playLatencyMask({ id: 'luna' } as any, 'welcome');
        });

        await waitFor(() => expect(mockMaskPlayer.play).toHaveBeenCalled());

        act(() => {
            currentStatus = { ...currentStatus, playing: true };
            rerender(undefined as any);
        });

        act(() => {
            currentStatus = { ...currentStatus, playing: false, didJustFinish: true };
            rerender(undefined as any);
        });

        await waitFor(() => expect(mockMaskPlayer.pause).toHaveBeenCalled());
    });
});
