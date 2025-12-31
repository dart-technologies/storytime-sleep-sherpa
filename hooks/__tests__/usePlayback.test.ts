import { act, renderHook } from '@testing-library/react-native';
import { usePlayback } from '../usePlayback';
import { useSleepTimer } from '../useSleepTimer';

jest.mock('expo-audio', () => ({
    useAudioPlayerStatus: (player: any) => ({
        playing: Boolean(player?.playing),
    }),
}));

// Mock useSleepTimer
jest.mock('../useSleepTimer', () => ({
    useSleepTimer: jest.fn(),
}));

// Mock AudioProvider
const mockPlayGlobalStory = jest.fn();
const mockPauseGlobal = jest.fn();
const mockResumeGlobal = jest.fn();
const mockSetAmbientSound = jest.fn();
const mockToggleChaosMode = jest.fn();
const mockGlobalPlayer = {
    playing: false,
    play: jest.fn(),
    pause: jest.fn(),
    volume: 1,
};
const mockAmbientPlayer = {
    playing: false,
    play: jest.fn(),
    pause: jest.fn(),
    volume: 1,
};

jest.mock('../../components/AudioProvider', () => ({
    useAudioPlayback: jest.fn(() => ({
        playStory: mockPlayGlobalStory,
        pause: mockPauseGlobal,
        resume: mockResumeGlobal,
        player: mockGlobalPlayer,
        ambientPlayer: mockAmbientPlayer,
        setAmbientSound: mockSetAmbientSound,
    })),
    useAudioSettings: jest.fn(() => ({
        chaosMode: false,
        toggleChaosMode: mockToggleChaosMode,
    })),
}));

// Mock persona
const mockPersona = {
    id: 'luna' as const,
    name: 'Luna',
    avatar: 'luna.png',
    voiceProfile: 'Female',
    voiceId: 'voice-1',
    agentId: 'agent-1',
    specialty: 'Sleep',
    welcomeGreeting: 'Hi',
    personalizationHook: '...',
    systemPrompt: '...',
};

describe('usePlayback', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockGlobalPlayer.playing = false;

        (useSleepTimer as jest.Mock).mockReturnValue({
            isActive: false,
            minutesLeft: 0,
        });
    });

    it('should initialize in idle state', () => {
        const { result } = renderHook(() => usePlayback(null));
        expect(result.current.state).toBe('idle');
    });

    it('should handle playStory transition', () => {
        const { result } = renderHook(() => usePlayback(mockPersona));

        act(() => {
            result.current.playStory('https://test.com/audio.mp3');
        });

        expect(result.current.state).toBe('playing');
        expect(mockPlayGlobalStory).toHaveBeenCalledWith('https://test.com/audio.mp3');
    });

    it('should toggle playback when playing', () => {
        mockGlobalPlayer.playing = true;
        const { result } = renderHook(() => usePlayback(mockPersona));

        // Mock state as playing
        act(() => {
            result.current.playStory('url');
        });

        act(() => {
            result.current.togglePlayback();
        });

        expect(mockPauseGlobal).toHaveBeenCalled();
    });

    it('should expose atmosphere type based on persona id', () => {
        const { result: luna } = renderHook(() => usePlayback(mockPersona));
        expect(luna.current.atmosphereType).toBe('luna');

        const { result: kai } = renderHook(() => usePlayback({ ...mockPersona, id: 'kai' as const }));
        expect(kai.current.atmosphereType).toBe('kai');
    });
});
