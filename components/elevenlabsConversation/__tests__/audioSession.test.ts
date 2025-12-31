const mockSetAudioModeAsync = jest.fn();
jest.mock('expo-audio', () => ({
    setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

const mockStopAudioSession = jest.fn(async (..._args: any[]) => undefined);
const mockStartAudioSession = jest.fn(async (..._args: any[]) => undefined);
const mockConfigureAudio = jest.fn(async (..._args: any[]) => undefined);
const mockSetAppleAudioConfiguration = jest.fn(async (..._args: any[]) => undefined);
const mockSetDefaultRemoteAudioTrackVolume = jest.fn(async (..._args: any[]) => undefined);
jest.mock('@livekit/react-native', () => ({
    AndroidAudioTypePresets: {
        communication: { audioMode: 'inCommunication' },
    },
    AudioSession: {
        configureAudio: (...args: any[]) => mockConfigureAudio(...args),
        startAudioSession: (...args: any[]) => mockStartAudioSession(...args),
        stopAudioSession: (...args: any[]) => mockStopAudioSession(...args),
        setAppleAudioConfiguration: (...args: any[]) => mockSetAppleAudioConfiguration(...args),
        setDefaultRemoteAudioTrackVolume: (...args: any[]) => mockSetDefaultRemoteAudioTrackVolume(...args),
    },
}));

describe('components/elevenlabsConversation/audioSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('setAudioModeForPlaybackFallback retries until success', async () => {
        jest.useFakeTimers();
        mockSetAudioModeAsync.mockRejectedValueOnce(new Error('fail'));
        mockSetAudioModeAsync.mockResolvedValueOnce(undefined);

        const { setAudioModeForPlaybackFallback } = require('../audioSession') as typeof import('../audioSession');

        const promise = setAudioModeForPlaybackFallback();
        await jest.runAllTimersAsync();
        await promise;

        expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    it('setAudioForVoice configures LiveKit audio', async () => {
        const { setAudioForVoice } = require('../audioSession') as typeof import('../audioSession');
        await setAudioForVoice();
        expect(mockStopAudioSession).toHaveBeenCalled();
        expect(mockConfigureAudio).toHaveBeenCalled();
        expect(mockStartAudioSession).toHaveBeenCalled();
        expect(mockSetDefaultRemoteAudioTrackVolume).toHaveBeenCalledWith(1);
        expect(mockSetAppleAudioConfiguration).toHaveBeenCalled();
    });

    it('setAudioForPlayback stops LiveKit session and sets Expo audio mode', async () => {
        jest.useFakeTimers();
        mockSetAudioModeAsync.mockResolvedValueOnce(undefined);

        const { setAudioForPlayback } = require('../audioSession') as typeof import('../audioSession');
        const promise = setAudioForPlayback();
        await jest.runAllTimersAsync();
        await promise;

        expect(mockStopAudioSession).toHaveBeenCalled();
        expect(mockSetAudioModeAsync).toHaveBeenCalled();
        expect(mockSetAppleAudioConfiguration).toHaveBeenCalledWith(
            expect.objectContaining({ audioCategory: 'playback', audioMode: 'spokenAudio' })
        );
        jest.useRealTimers();
    });

    it('setAudioForPlayback respects EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE', async () => {
        jest.useFakeTimers();
        mockSetAudioModeAsync.mockResolvedValueOnce(undefined);

        const previous = process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE;
        process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE = 'default';
        try {
            const { setAudioForPlayback } = require('../audioSession') as typeof import('../audioSession');
            const promise = setAudioForPlayback();
            await jest.runAllTimersAsync();
            await promise;
        } finally {
            process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE = previous;
        }

        expect(mockSetAppleAudioConfiguration).toHaveBeenCalledWith(
            expect.objectContaining({ audioCategory: 'playback', audioMode: 'default' })
        );
        jest.useRealTimers();
    });

    it('setAudioForPlayback falls back to default audio mode when iOS rejects spokenAudio', async () => {
        jest.useFakeTimers();
        mockSetAudioModeAsync.mockResolvedValueOnce(undefined);
        mockSetAppleAudioConfiguration.mockRejectedValueOnce(new Error('unsupported mode'));
        mockSetAppleAudioConfiguration.mockResolvedValueOnce(undefined);

        const previous = process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE;
        process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE = 'spokenAudio';
        try {
            const { setAudioForPlayback } = require('../audioSession') as typeof import('../audioSession');
            const promise = setAudioForPlayback();
            await jest.runAllTimersAsync();
            await promise;
        } finally {
            process.env.EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE = previous;
        }

        expect(mockSetAppleAudioConfiguration).toHaveBeenCalledTimes(2);
        expect(mockSetAppleAudioConfiguration).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ audioCategory: 'playback', audioMode: 'spokenAudio' })
        );
        expect(mockSetAppleAudioConfiguration).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ audioCategory: 'playback', audioMode: 'default' })
        );
        jest.useRealTimers();
    });
});
