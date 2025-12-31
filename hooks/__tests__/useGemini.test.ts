import { act, renderHook } from '@testing-library/react-native';
import { personas } from '../../lib/personas';
import { useGemini } from '../useGemini';

jest.mock('../../lib/firebase', () => ({
    getFirebaseIdToken: jest.fn(async () => 'test-token'),
}));

// Mock fetch
global.fetch = jest.fn();

describe('useGemini', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';
        (global.fetch as jest.Mock).mockClear();
    });

    it('should generate a story successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ narrative: 'Once upon a time...' }),
        });

        const { result } = renderHook(() => useGemini());

        let story: any;
        await act(async () => {
            story = await result.current.generateAIBasedStory({
                persona: personas[0],
                durationSec: 300,
            });
        });

        expect(story?.narrative).toBe('Once upon a time...');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/generate'), expect.any(Object));
    });

    it('should handle story generation error', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
        });

        const { result } = renderHook(() => useGemini());

        await act(async () => {
            await expect(result.current.generateAIBasedStory({
                persona: personas[0],
                durationSec: 300,
            })).rejects.toThrow(/Failed to generate story/);
        });

        expect(result.current.error).toContain('Failed to generate story');
    });

    it('should analyze an image successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ analysis: 'A peaceful forest', imageUrl: 'https://image.com/upload.jpg' }),
        });

        const { result } = renderHook(() => useGemini());

        let analysis: any;
        await act(async () => {
            analysis = await result.current.analyzeImageWithVision('base64data');
        });

        expect(analysis?.analysis).toBe('A peaceful forest');
        expect(analysis?.imageUrl).toBe('https://image.com/upload.jpg');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/vision'), expect.any(Object));
    });

    it('should generate an illustration successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ imageUrl: 'https://image.com/art.png' }),
        });

        const { result } = renderHook(() => useGemini());

        let url;
        await act(async () => {
            url = await result.current.generateStoryIllustration({
                title: 'A scary dragon',
                summary: 'A gentle, cozy dragon bedtime scene.',
                persona: personas[0],
            });
        });

        expect(url).toBe('https://image.com/art.png');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/illustrate'), expect.any(Object));
    });

    it('should handle illustration error', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
        });

        const { result } = renderHook(() => useGemini());

        await act(async () => {
            await expect(result.current.generateStoryIllustration({
                title: 'Title',
                summary: 'Summary',
                persona: personas[0],
            })).rejects.toThrow(/Failed to generate illustration/);
        });

        expect(result.current.error).toContain('Failed to generate illustration');
    });

    it('should handle fetch exception', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Down'));

        const { result } = renderHook(() => useGemini());

        await act(async () => {
            await expect(result.current.generateAIBasedStory({ persona: personas[0], durationSec: 100 })).rejects.toThrow('Network Down');
        });

        expect(result.current.error).toBe('Network Down');
    });
});
