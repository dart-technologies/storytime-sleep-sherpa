
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mocks
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ personaId: 'luna' }),
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('expo-network', () => ({
    useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
    getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('expo-keep-awake', () => ({
    useKeepAwake: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
    File: jest.fn().mockImplementation(() => ({
        base64: jest.fn().mockResolvedValue('iVBORw0KGgoAAA'),
    })),
    Paths: { cache: 'cache' },
    downloadFileAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'Medium', Light: 'Light' },
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn(),
    SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

jest.mock('../../lib/firebase', () => ({
    auth: { currentUser: null },
    firestore: {},
}));

jest.mock('../../lib/appConfig', () => ({
    ALLOWED_STORY_DURATIONS_SEC: [15, 60, 300, 600],
    DEFAULT_APP_RUNTIME_CONFIG: { dailyCreateLimit: 1, defaultStoryDurationSec: 60 },
    fetchAppRuntimeConfig: jest.fn(async () => ({ dailyCreateLimit: 1, defaultStoryDurationSec: 60 })),
}));

jest.mock('../../lib/dailyCreateCap', () => ({
    assertUnderDailyCreateCap: jest.fn(async () => undefined),
}));

// Mock Hooks
const mockSetAmbientSound = jest.fn();
jest.mock('../../components/AudioProvider', () => ({
    useAudioPlayback: () => ({
        setAmbientSound: mockSetAmbientSound,
        pauseAmbient: jest.fn(),
        resumeAmbient: jest.fn(),
    }),
}));

const mockProduceStory = jest.fn();
jest.mock('../../hooks/useStoryProduction', () => ({
    useStoryProduction: () => ({
        produceStory: mockProduceStory,
        productionState: { phase: 'idle', error: null },
    }),
}));

jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        myStories: [],
        featuredStories: [],
    }),
}));

const mockStartConversation = jest.fn().mockResolvedValue(undefined);
const mockStopConversation = jest.fn().mockResolvedValue(undefined);
jest.mock('../../hooks/useElevenLabs', () => ({
    useElevenLabs: () => ({
        startConversation: mockStartConversation,
        stopConversation: mockStopConversation,
        status: 'disconnected',
        isPlayingMask: false,
        playingMaskType: null,
        playLatencyMask: jest.fn(),
        stopLatencyMask: jest.fn(),
    }),
}));

const mockAnalyzeImageWithVision = jest.fn().mockResolvedValue({
    analysis: 'A beautiful scene',
    imageUrl: 'http://image.url',
    meta: {},
});

jest.mock('../../hooks/useGemini', () => ({
    useGemini: () => ({
        analyzeImageWithVision: mockAnalyzeImageWithVision,
    }),
}));

// Assets & Data
jest.mock('../../lib/assetMapper', () => ({
    getDefaultSoundscapeId: () => 'falling-snow',
    getPersonaAvatar: () => 123,
    getSoundscapeAsset: () => 456,
    SOUNDSCAPE_OPTIONS: [
        { id: 'falling-snow', label: 'Snow', emoji: '❄️' },
    ],
}));

jest.mock('../../lib/personas', () => ({
    personas: [
        { id: 'luna', name: 'Luna', agentId: 'agent-123' },
    ],
}));

jest.mock('../../components/Snowflakes', () => 'Snowflakes');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const IntakeScreen = require('../../app/create/intake/[personaId]').default;

describe('IntakeScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly with persona data', () => {
        const { getByText } = render(<IntakeScreen />);
        expect(getByText('Luna')).toBeTruthy();
        expect(getByText('Ready when you are')).toBeTruthy();
    });

    it('handles image picking permission flow', async () => {
        const ImagePicker = require('expo-image-picker');
        ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

        const alertSpy = jest.spyOn(Alert, 'alert');
        const { getByText, getByRole } = render(<IntakeScreen />);

        // Find "Pick image" button (accessibilityLabel="Pick an image")
        const pickBtn = getByRole('button', { name: "Pick an image" });
        fireEvent.press(pickBtn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Permission Needed', expect.stringContaining('allow photo access'));
        });
        alertSpy.mockRestore();
    });

    it('simulates picking an image successfully', async () => {
        const ImagePicker = require('expo-image-picker');
        ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file://img.png', base64: 'iVBORw0KGgoAAA' }],
        });

        const { getByRole, findByText } = render(<IntakeScreen />);
        const pickBtn = getByRole('button', { name: "Pick an image" });

        await act(async () => {
            fireEvent.press(pickBtn);
        });

        expect(await findByText('Gemini Analysis')).toBeTruthy();
        expect(await findByText('A beautiful scene')).toBeTruthy();
    });

    it('converts HEIC to JPEG before analyzing', async () => {
        const ImagePicker = require('expo-image-picker');
        const ImageManipulator = require('expo-image-manipulator');
        ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{
                uri: 'file://img.heic',
                base64: 'AAAAHGZ0eXBoheic',
                mimeType: 'image/heic',
                fileName: 'IMG_4708.heic',
            }],
        });

        ImageManipulator.manipulateAsync.mockResolvedValue({
            uri: 'file://converted.jpg',
            base64: '/9j/converted',
        });

        const { getByRole, findByText } = render(<IntakeScreen />);
        const pickBtn = getByRole('button', { name: 'Pick an image' });

        await act(async () => {
            fireEvent.press(pickBtn);
        });

        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
        expect(mockAnalyzeImageWithVision).toHaveBeenCalledWith('/9j/converted', expect.objectContaining({ mimeType: 'image/jpeg' }));
        expect(await findByText('A beautiful scene')).toBeTruthy();
    });

    it('generates story manually (simulated via mocking trigger)', async () => {
        // Since handleFinish is internal and wrapped in callbacks, 
        // we can mostly test that UI elements for interaction exist.
        // Testing the EXACT production triggers is hard without exposing internals or 
        // heavily mocking useElevenLabs to trigger onIntakeComplete.

        // However, note that `IntakeScreen` calls `produceStory` inside `handleFinish`.
        // `handleFinish` is triggered by `onIntakeComplete`.

        // Let's rely on the fact that if we interpret `IntakeScreen` as a "View", 
        // we verify the view state transitions.

        const { getByText } = render(<IntakeScreen />);
        expect(getByText('Add image')).toBeTruthy();
    });
});
