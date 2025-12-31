import { act, renderHook } from '@testing-library/react-native';
import { personas } from '../../../lib/personas';
import { useStoryGeneration } from '../useStoryGeneration';

jest.mock('../../../lib/firebase', () => ({
    getFirebaseIdToken: jest.fn(async () => 'test-token'),
}));

global.fetch = jest.fn();

describe('hooks/ai/useStoryGeneration', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';
        (global.fetch as jest.Mock).mockClear();
    });

    it('generates a story successfully', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ narrative: 'Once upon a time...' }),
        });

        const { result } = renderHook(() => useStoryGeneration({ setLoading, setError }));

        let story: any;
        await act(async () => {
            story = await result.current.generateAIBasedStory({
                persona: personas[0],
                durationSec: 300,
            });
        });

        expect(story?.narrative).toBe('Once upon a time...');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/generate'), expect.any(Object));
        expect(setLoading).toHaveBeenCalled();
        expect(setError).toHaveBeenCalledWith(null);
    });

    it('surfaces errors and sets error state', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
        });

        const { result } = renderHook(() => useStoryGeneration({ setLoading, setError }));

        await act(async () => {
            await expect(result.current.generateAIBasedStory({
                persona: personas[0],
                durationSec: 300,
            })).rejects.toThrow(/Failed to generate story/);
        });

        expect(setError).toHaveBeenLastCalledWith(expect.stringMatching(/Failed to generate story/));
    });
});

