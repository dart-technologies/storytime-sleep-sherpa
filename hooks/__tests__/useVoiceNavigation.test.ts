import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { AnalyticsService } from '../../services/analytics';
import { useElevenLabs } from '../useElevenLabs';
import { useVoiceNavigation } from '../useVoiceNavigation';

// Mock dependencies
jest.mock('../useElevenLabs', () => ({
    useElevenLabs: jest.fn(),
}));

jest.mock('expo-router', () => ({
    useRouter: jest.fn(),
}));

jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackVoiceCommand: jest.fn(),
    },
}));

describe('useVoiceNavigation', () => {
    const mockRouter = { push: jest.fn() };
    const mockConversation = {
        startConversation: jest.fn(),
        stopConversation: jest.fn(),
        status: 'disconnected',
    };
    const mockStories = [
        { id: '1', title: 'The Great Forest', summary: 'A calm forest walk', narrative: '...', userId: 'u1', personaId: 'p1', personaName: 'Sage', createdAt: 123, isPublic: false },
        { id: '2', title: 'Mountain Peak', summary: 'A quiet mountain climb', narrative: '...', userId: 'u1', personaId: 'p1', personaName: 'Sage', createdAt: 456, isPublic: true },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
        (useElevenLabs as jest.Mock).mockReturnValue(mockConversation);
    });

    it('should initialize with empty search query and not listening', () => {
        const { result } = renderHook(() => useVoiceNavigation(mockStories));
        expect(result.current.searchQuery).toBe('');
        expect(result.current.isListening).toBe(false);
    });

    it('should start and stop voice search', async () => {
        const { result } = renderHook(() => useVoiceNavigation(mockStories));

        await act(async () => {
            await result.current.startVoiceSearch();
        });
        expect(result.current.isListening).toBe(true);
        expect(mockConversation.startConversation).toHaveBeenCalled();

        await act(async () => {
            await result.current.stopVoiceSearch();
        });
        expect(result.current.isListening).toBe(false);
        expect(mockConversation.stopConversation).toHaveBeenCalled();
    });

    it('should parse and handle search intent', () => {
        let messageHandler: any;
        (useElevenLabs as jest.Mock).mockImplementation((persona, options) => {
            messageHandler = options.onMessage;
            return mockConversation;
        });

        const { result } = renderHook(() => useVoiceNavigation(mockStories));

        act(() => {
            messageHandler({ role: 'user', text: 'Search for Forest' });
        });

        expect(result.current.searchQuery).toBe('forest');
        expect(AnalyticsService.trackVoiceCommand).toHaveBeenCalledWith('search', true);
    });

    it('should parse and handle play intent', () => {
        let messageHandler: any;
        (useElevenLabs as jest.Mock).mockImplementation((persona, options) => {
            messageHandler = options.onMessage;
            return mockConversation;
        });

        renderHook(() => useVoiceNavigation(mockStories));

        act(() => {
            messageHandler({ role: 'user', text: 'Play Mountain' });
        });

        expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/library/[storyId]', params: { storyId: '2' } });
        expect(AnalyticsService.trackVoiceCommand).toHaveBeenCalledWith('play', true);
    });

    it('should parse and handle clear intent', () => {
        let messageHandler: any;
        (useElevenLabs as jest.Mock).mockImplementation((persona, options) => {
            messageHandler = options.onMessage;
            return mockConversation;
        });

        const { result } = renderHook(() => useVoiceNavigation(mockStories));

        act(() => {
            messageHandler({ role: 'user', text: 'Clear search' });
        });

        expect(result.current.searchQuery).toBe('');
        expect(AnalyticsService.trackVoiceCommand).toHaveBeenCalledWith('clear', true);
    });

    it('should handle unrecognized play intent', () => {
        let messageHandler: any;
        (useElevenLabs as jest.Mock).mockImplementation((persona, options) => {
            messageHandler = options.onMessage;
            return mockConversation;
        });

        renderHook(() => useVoiceNavigation(mockStories));

        act(() => {
            messageHandler({ role: 'user', text: 'Play Unknown Story' });
        });

        expect(mockRouter.push).not.toHaveBeenCalled();
        expect(AnalyticsService.trackVoiceCommand).toHaveBeenCalledWith('play', false);
    });
});
