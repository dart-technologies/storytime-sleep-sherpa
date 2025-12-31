import { act, renderHook } from '@testing-library/react-native';
import { useVisionAnalysis } from '../useVisionAnalysis';

jest.mock('../../../lib/firebase', () => ({
    getFirebaseIdToken: jest.fn(async () => 'test-token'),
}));

global.fetch = jest.fn();

describe('hooks/ai/useVisionAnalysis', () => {
    beforeEach(() => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';
        (global.fetch as jest.Mock).mockClear();
    });

    it('analyzes an image successfully', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ analysis: 'A peaceful forest', imageUrl: 'https://image.com/upload.jpg' }),
        });

        const { result } = renderHook(() => useVisionAnalysis({ setLoading, setError }));

        let analysis: any;
        await act(async () => {
            analysis = await result.current.analyzeImageWithVision('base64data', { mimeType: 'image/jpeg' });
        });

        expect(analysis?.analysis).toBe('A peaceful forest');
        expect(analysis?.imageUrl).toBe('https://image.com/upload.jpg');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/vision'), expect.any(Object));
        expect(setLoading).toHaveBeenCalled();
        expect(setError).toHaveBeenCalledWith(null);
    });

    it('handles non-ok responses', async () => {
        const setLoading = jest.fn();
        const setError = jest.fn();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 401,
        });

        const { result } = renderHook(() => useVisionAnalysis({ setLoading, setError }));

        await act(async () => {
            await expect(result.current.analyzeImageWithVision('base64data')).rejects.toThrow(/Failed to analyze image/);
        });

        expect(setError).toHaveBeenLastCalledWith(expect.stringMatching(/Failed to analyze image/));
    });
});

