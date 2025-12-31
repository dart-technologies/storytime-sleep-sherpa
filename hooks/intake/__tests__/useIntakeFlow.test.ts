import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
}));

let mockNetworkState = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({
    useNetworkState: () => mockNetworkState,
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium', Light: 'Light' },
}));

jest.mock('../../../lib/firebase', () => ({
    getFirebaseIdToken: jest.fn(async () => 'token'),
    app: {},
    auth: { currentUser: null },
    firestore: {},
}));

jest.mock('../../../lib/appConfig', () => ({
    ALLOWED_STORY_DURATIONS_SEC: [15, 60, 300, 600],
    DEFAULT_APP_RUNTIME_CONFIG: { dailyCreateLimit: 1, defaultStoryDurationSec: 60 },
    fetchAppRuntimeConfig: jest.fn(async () => ({ dailyCreateLimit: 1, defaultStoryDurationSec: 60 })),
}));

jest.mock('../../../lib/dailyCreateCap', () => ({
    assertUnderDailyCreateCap: jest.fn(async () => undefined),
}));

const mockSetAmbientSound = jest.fn();
const mockPauseAmbient = jest.fn();
const mockResumeAmbient = jest.fn();
jest.mock('../../../components/AudioProvider', () => ({
    useAudioPlayback: () => ({
        setAmbientSound: mockSetAmbientSound,
        pauseAmbient: mockPauseAmbient,
        resumeAmbient: mockResumeAmbient,
    }),
}));

const mockProduceStory = jest.fn();
jest.mock('../../useStoryProduction', () => ({
    useStoryProduction: () => ({
        produceStory: mockProduceStory,
        productionState: { phase: 'idle', error: null },
    }),
}));

jest.mock('../../useStories', () => ({
    useStories: () => ({ myStories: [], featuredStories: [] }),
}));

let lastElevenLabsCallbacks: any = null;
const mockStartConversation = jest.fn().mockResolvedValue(undefined);
const mockStopConversation = jest.fn().mockResolvedValue(undefined);
const mockPlayLatencyMask = jest.fn();
const mockStopLatencyMask = jest.fn();
let mockElevenLabsStatus = 'disconnected';
jest.mock('../../useElevenLabs', () => ({
    useElevenLabs: (persona: any, callbacks: any) => {
        lastElevenLabsCallbacks = callbacks;
        return {
            startConversation: mockStartConversation,
            stopConversation: mockStopConversation,
            status: mockElevenLabsStatus,
            isPlayingMask: false,
            playingMaskType: null,
            playLatencyMask: mockPlayLatencyMask,
            stopLatencyMask: mockStopLatencyMask,
        };
    },
}));

jest.mock('../../../lib/assetMapper', () => ({
    getPersonaAvatar: () => 123,
    getDefaultSoundscapeId: () => 'falling-snow',
    getSoundscapeAsset: () => 456,
}));

jest.mock('../../../lib/seasonalSpecials', () => ({
    SEASONAL_SPECIALS: [],
}));

let mockImageAnalysisReturn: any = null;
jest.mock('../useImageAnalysis', () => ({
    useImageAnalysis: (_params: any) => mockImageAnalysisReturn,
}));

jest.mock('../../../lib/personas', () => ({
    personas: [
        {
            id: 'luna',
            name: 'Luna',
            avatar: 'avatar',
            voiceProfile: 'voice',
            voiceId: 'voice-id',
            agentId: 'agent-123',
            specialty: 'special',
            welcomeGreeting: 'hi',
            personalizationHook: 'hook',
            systemPrompt: 'prompt',
        },
    ],
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useIntakeFlow } = require('../useIntakeFlow');

describe('hooks/intake/useIntakeFlow', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => { });

    beforeEach(() => {
        jest.clearAllMocks();
        lastElevenLabsCallbacks = null;
        mockNetworkState = { isConnected: true, isInternetReachable: true };
        mockElevenLabsStatus = 'disconnected';
        mockStartConversation.mockResolvedValue(undefined);
        mockImageAnalysisReturn = {
            selectedImageUri: null,
            selectedImageUrl: null,
            isSeasonalMoodSelected: false,
            canSelectMoodImage: true,
            imageAnalysis: null,
            isAnalyzingImage: false,
            imageAnalysisError: null,
            handlePickImage: jest.fn(),
            handleSelectSeasonalMood: jest.fn(),
            clearImage: jest.fn(),
        };
    });

    afterAll(() => {
        alertSpy.mockRestore();
    });

    it('sets default soundscape and ambient sound for the persona', async () => {
        renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));
        await waitFor(() => expect(mockSetAmbientSound).toHaveBeenCalledWith(456));
    });

    it('generates story and navigates to playback', async () => {
        mockProduceStory.mockResolvedValueOnce('story-1');

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.coverPreviewRef.current = {
                measureInWindow: (cb: any) => cb(10.2, 20.8, 100.4, 200.6),
            };
        });

        act(() => {
            result.current.handleFinish();
        });

        await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());

        expect(mockStopConversation).toHaveBeenCalledWith({ force: true });
        expect(mockProduceStory).toHaveBeenCalledWith(expect.objectContaining({
            persona: expect.objectContaining({ id: 'luna' }),
        }));
        expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/library/[storyId]',
            params: expect.objectContaining({
                storyId: 'story-1',
                autoplay: 1,
                personaId: 'luna',
                coverX: 10,
                coverY: 21,
                coverW: 100,
                coverH: 201,
            }),
        }));
    });

    it('uses server Vertex defaults when no model overrides are set', async () => {
        const prevTextOverride = process.env.EXPO_PUBLIC_VERTEX_TEXT_MODEL_OVERRIDE;
        const prevImageOverride = process.env.EXPO_PUBLIC_VERTEX_IMAGE_MODEL_OVERRIDE;
        delete process.env.EXPO_PUBLIC_VERTEX_TEXT_MODEL_OVERRIDE;
        delete process.env.EXPO_PUBLIC_VERTEX_IMAGE_MODEL_OVERRIDE;

        mockProduceStory.mockResolvedValueOnce('story-1');

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.handleFinish();
        });

        await waitFor(() => expect(mockProduceStory).toHaveBeenCalled());
        const [call] = mockProduceStory.mock.calls[0];
        expect(call.vertexTextModel).toBeUndefined();
        expect(call.vertexImageModel).toBeUndefined();

        if (typeof prevTextOverride === 'string') {
            process.env.EXPO_PUBLIC_VERTEX_TEXT_MODEL_OVERRIDE = prevTextOverride;
        } else {
            delete process.env.EXPO_PUBLIC_VERTEX_TEXT_MODEL_OVERRIDE;
        }

        if (typeof prevImageOverride === 'string') {
            process.env.EXPO_PUBLIC_VERTEX_IMAGE_MODEL_OVERRIDE = prevImageOverride;
        } else {
            delete process.env.EXPO_PUBLIC_VERTEX_IMAGE_MODEL_OVERRIDE;
        }
    });

    it('triggers generation from intake complete callback', async () => {
        mockProduceStory.mockResolvedValueOnce('story-2');

        renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        await act(async () => {
            await Promise.resolve();
        });

        act(() => {
            lastElevenLabsCallbacks?.onIntakeComplete?.({ title: 'T', summary: 'S' });
        });

        await waitFor(() => expect(mockProduceStory).toHaveBeenCalled());
        expect(mockProduceStory).toHaveBeenCalledWith(expect.objectContaining({
            intakeSummary: expect.objectContaining({ title: 'T', summary: 'S' }),
        }));
    });

    it('blocks story generation when offline', () => {
        mockNetworkState = { isConnected: false, isInternetReachable: false };
        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.handleFinish();
        });

        expect(Alert.alert).toHaveBeenCalledWith('Offline', expect.any(String));
        expect(mockProduceStory).not.toHaveBeenCalled();
    });

    it('blocks story generation while analyzing an image', () => {
        mockImageAnalysisReturn.selectedImageUri = 'file://picked.jpg';
        mockImageAnalysisReturn.isAnalyzingImage = true;

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.handleFinish();
        });

        expect(Alert.alert).toHaveBeenCalledWith('Analyzing...', expect.any(String));
        expect(mockProduceStory).not.toHaveBeenCalled();
    });

    it('alerts when production returns no story id', async () => {
        mockProduceStory.mockResolvedValueOnce(null);

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.handleFinish();
        });

        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String)));
    });

    it('toggleListening stops an active session', async () => {
        mockElevenLabsStatus = 'connected';

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.toggleListening();
        });

        await waitFor(() => expect(mockStopConversation).toHaveBeenCalled());
    });

    it('toggleListening resumes soundscape and sets an error when voice connect fails', async () => {
        mockElevenLabsStatus = 'disconnected';
        mockStartConversation.mockRejectedValueOnce(new Error('nope'));

        const { result } = renderHook(() => useIntakeFlow({ personaId: 'luna', remixId: undefined, remixContext: undefined }));

        act(() => {
            result.current.toggleListening();
        });

        await waitFor(() => expect(mockPauseAmbient).toHaveBeenCalled());
        await waitFor(() => expect(mockResumeAmbient).toHaveBeenCalledWith(expect.objectContaining({ fadeMs: 250 })));
        await waitFor(() => expect(result.current.voiceError).toContain('Voice connection failed'));
    });
});
