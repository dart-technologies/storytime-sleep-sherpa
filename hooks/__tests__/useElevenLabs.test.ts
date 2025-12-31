import { act, renderHook } from '@testing-library/react-native';
import { useElevenLabs } from '../useElevenLabs';
import { useElevenLabsConversation } from '../../components/ElevenLabsConversationProvider';

jest.mock('../../components/ElevenLabsConversationProvider', () => ({
    useElevenLabsConversation: jest.fn(),
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

describe('useElevenLabs', () => {
    const mockStartConversation = jest.fn();
    const mockStopConversation = jest.fn();
    const mockSubscribe = jest.fn().mockReturnValue(jest.fn());
    const mockConversation = {
        status: 'disconnected',
        startSession: jest.fn(),
        endSession: jest.fn(),
        sendUserMessage: jest.fn(),
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        (useElevenLabsConversation as jest.Mock).mockReturnValue({
            conversation: mockConversation,
            startConversation: mockStartConversation,
            stopConversation: mockStopConversation,
            subscribe: mockSubscribe,
            isPlayingMask: false,
        });
    });

    it('should initialize correctly', () => {
        const { result } = renderHook(() => useElevenLabs(mockPersona));
        expect(result.current.isPlayingMask).toBe(false);
    });

    it('should start conversation via provider', async () => {
        const { result } = renderHook(() => useElevenLabs(mockPersona));

        await act(async () => {
            await result.current.startConversation();
        });

        expect(mockStartConversation).toHaveBeenCalledWith(
            mockPersona,
            expect.objectContaining({ ownerKey: expect.any(String) })
        );
    });

    it('should stop conversation via provider', async () => {
        const { result } = renderHook(() => useElevenLabs(mockPersona));

        await act(async () => {
            await result.current.stopConversation();
        });

        expect(mockStopConversation).toHaveBeenCalledWith(
            expect.objectContaining({ ownerKey: expect.any(String) })
        );
    });

    it('should subscribe to onMessage callback', async () => {
        const onMessage = jest.fn();
        renderHook(() => useElevenLabs(mockPersona, { onMessage }));

        expect(mockSubscribe).toHaveBeenCalledWith(
            { onMessage },
            expect.any(String)
        );
    });
});
