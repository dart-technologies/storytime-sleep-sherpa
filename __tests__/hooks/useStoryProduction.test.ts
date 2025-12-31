
import { renderHook, act } from '@testing-library/react-native';
import { useStoryProduction } from '../../hooks/useStoryProduction';
import { Persona } from '../../lib/personas';

// Mocks
const mockGetFirebaseIdToken = jest.fn();
jest.mock('../../lib/firebase', () => ({
    getFirebaseIdToken: () => mockGetFirebaseIdToken(),
    auth: { currentUser: { uid: 'test-user-id' } },
}));

const mockAssertUnderDailyCreateCap = jest.fn(async (_uid: string) => undefined);
const mockIncrementDailyCreateCount = jest.fn(async (_uid: string) => undefined);
jest.mock('../../lib/dailyCreateCap', () => ({
    assertUnderDailyCreateCap: (uid: string) => mockAssertUnderDailyCreateCap(uid),
    incrementDailyCreateCount: (uid: string) => mockIncrementDailyCreateCount(uid),
}));

const mockGenerateAIBasedStory = jest.fn();
const mockGenerateStoryIllustration = jest.fn();
jest.mock('../../hooks/useGemini', () => ({
    useGemini: () => ({
        generateAIBasedStory: mockGenerateAIBasedStory,
        generateStoryIllustration: mockGenerateStoryIllustration,
    }),
}));

const mockNarrateStory = jest.fn();
jest.mock('../../hooks/useNarration', () => ({
    useNarration: () => ({
        narrateStory: mockNarrateStory,
    }),
}));

const mockSaveStory = jest.fn();
const mockUpdateStoryCoverImage = jest.fn();
jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        saveStory: mockSaveStory,
        updateStoryCoverImage: mockUpdateStoryCoverImage,
    }),
}));

jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackStoryGeneration: jest.fn(),
        trackStoryGenerationStart: jest.fn(),
    },
}));

// Test Constants
const TEST_PERSONA: Persona = {
    id: 'luna',
    name: 'Luna',
    voiceProfile: 'Female, whisper',
    specialty: 'Fantasy',
    welcomeGreeting: 'Hello',
    personalizationHook: 'Hook?',
    systemPrompt: 'You are Luna...',
    agentId: 'agent-123',
    voiceId: 'voice-123',
    avatar: 'http://example.com/avatar.png',
};

const TEST_PARAMS = {
    persona: TEST_PERSONA,
    durationSec: 300,
    convoHistory: [],
    intakeSummary: { title: 'Moon Trip', summary: 'Going to the moon.' },
};

describe('useStoryProduction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetFirebaseIdToken.mockResolvedValue('mock-token');
        mockGenerateAIBasedStory.mockResolvedValue({
            title: 'Generated Title',
            summary: 'Generated Summary',
            narrative: 'Once upon a time...'
        });
        mockGenerateStoryIllustration.mockResolvedValue('https://cover.url/image.png');
        mockNarrateStory.mockResolvedValue({ audioUrl: 'https://audio.url/file.mp3' });
        mockSaveStory.mockResolvedValue('new-story-id');
    });

    it('initializes in idle state', () => {
        const { result } = renderHook(() => useStoryProduction());
        expect(result.current.productionState.phase).toBe('idle');
    });

    it('runs through full happy path', async () => {
        const { result } = renderHook(() => useStoryProduction());

        let storyId: string | null = null;
        await act(async () => {
            storyId = await result.current.produceStory(TEST_PARAMS);
        });

        // 1. Auth
        expect(mockGetFirebaseIdToken).toHaveBeenCalled();

        // 2. Generation
        expect(mockGenerateAIBasedStory).toHaveBeenCalledWith(expect.objectContaining({
            persona: TEST_PERSONA,
            idToken: 'mock-token',
        }));

        // 3. Cover (Parallel start, but awaited for patch logic test in hook)
        // Wait, the hook fires cover generation in parallel but doesn't await it for the main flow unless needed?
        // Actually step 4 in code: starts it. Step 7: updates it after save.
        expect(mockGenerateStoryIllustration).toHaveBeenCalled();

        // 4. Narration
        expect(mockNarrateStory).toHaveBeenCalledWith(expect.objectContaining({
            text: 'Once upon a time...',
            voiceId: 'voice-123',
            idToken: 'mock-token',
        }));

        // 5. Save
        expect(mockSaveStory).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Moon Trip', // Prefer intake summary if present
            audioUrl: 'https://audio.url/file.mp3',
        }), expect.anything());

        // 6. Update Cover (Background task within produceStory)
        // We verify that updateStoryCoverImage is called eventually.
        // Since `produceStory` awaits the flow up to save, checking immediate invocation might be race-prone
        // because the patch logic is in a `void (async () => { ... })()` block.
        // Ideally we wait a tick.
        await new Promise(process.nextTick);
        expect(mockUpdateStoryCoverImage).toHaveBeenCalledWith('new-story-id', 'https://cover.url/image.png', expect.anything());

        // Final State
        expect(result.current.productionState.phase).toBe('completed');
        expect(result.current.productionState.storyId).toBe('new-story-id');
        expect(storyId).toBe('new-story-id');
    });

    it('does not inherit stored Vertex model ids when remixing without overrides', async () => {
        const { result } = renderHook(() => useStoryProduction());

        await act(async () => {
            await result.current.produceStory({
                ...TEST_PARAMS,
                remix: {
                    storyId: 'base-story-id',
                    title: 'Base title',
                    summary: 'Base summary',
                    contextText: 'Make it even sleepier.',
                    generation: {
                        version: 1,
                        source: 'create',
                        durationSec: 300,
                        convoHistory: [],
                        intakeSummary: null,
                        imageAnalysis: null,
                        vertexTextModel: 'gemini-2.5-flash',
                        vertexImageModel: 'gemini-2.5-flash-image',
                    },
                },
            });
        });

        expect(mockGenerateAIBasedStory).toHaveBeenCalledWith(expect.objectContaining({
            vertexTextModel: undefined,
        }));
        expect(mockGenerateStoryIllustration).toHaveBeenCalledWith(expect.objectContaining({
            vertexImageModel: undefined,
        }));
    });

    it('handles generation failure gracefully', async () => {
        mockGenerateAIBasedStory.mockRejectedValue(new Error('AI Overload'));
        const { result } = renderHook(() => useStoryProduction());

        await act(async () => {
            const id = await result.current.produceStory(TEST_PARAMS);
            expect(id).toBeNull();
        });

        expect(result.current.productionState.phase).toBe('error');
        expect(result.current.productionState.error).toBe('AI Overload');
    });

    it('supports cancellation during generation', async () => {
        // Delay generation so we can cancel
        mockGenerateAIBasedStory.mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 100));
            return { narrative: 'foo' };
        });

        const { result } = renderHook(() => useStoryProduction());

        const promise = act(async () => {
            return result.current.produceStory(TEST_PARAMS);
        });

        // Cancel immediately
        act(() => {
            result.current.cancelProduction();
        });

        const id = await promise;
        expect(id).toBeNull();
        expect(result.current.productionState.phase).toBe('idle');
        // Note: cancelProduction sets phase to idle/error='Cancelled'. 
        // The loop inside produceStory checks isCancelledRef and stops.
    });
});
