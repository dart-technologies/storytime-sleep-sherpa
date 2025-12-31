import { act, renderHook } from '@testing-library/react-native';
import { personas } from '../../../lib/personas';
import { useIllustration } from '../useIllustration';

jest.mock('../../../lib/firebase', () => ({
    getFirebaseIdToken: jest.fn(async () => 'test-token'),
}));

global.fetch = jest.fn();

describe('hooks/ai/useIllustration', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';
        (global.fetch as jest.Mock).mockClear();
    });

    it('generates an illustration successfully', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ imageUrl: 'https://image.com/art.png' }),
        });

        const { result } = renderHook(() => useIllustration({ setLoading, setError }));

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
        expect(setError).toHaveBeenCalledWith(null);
    });

    it('sets error on failed illustration', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
        });

        const { result } = renderHook(() => useIllustration({ setLoading, setError }));

        await act(async () => {
            await expect(result.current.generateStoryIllustration({
                title: 'Title',
                summary: 'Summary',
                persona: personas[0],
            })).rejects.toThrow(/Failed to generate illustration/);
        });

        expect(setError).toHaveBeenLastCalledWith(expect.stringMatching(/Failed to generate illustration/));
    });
});

