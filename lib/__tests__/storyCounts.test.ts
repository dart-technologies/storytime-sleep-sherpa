import { trackStoryPlay } from '../storyCounts';

describe('lib/storyCounts', () => {
    const oldEnv = process.env;
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...oldEnv };
    });

    afterAll(() => {
        process.env = oldEnv;
        global.fetch = originalFetch;
    });

    it('no-ops for invalid story ids', async () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch as any;

        await trackStoryPlay('');
        await trackStoryPlay('   ');

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('posts a play event when configured', async () => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';

        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = mockFetch as any;

        await trackStoryPlay('story-1', { source: 'web' });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];
        expect(String(url)).toBe('https://example.com/storyPlay');
        expect(options).toEqual(expect.objectContaining({ method: 'POST' }));
        const body = JSON.parse(String(options.body));
        expect(body).toEqual(expect.objectContaining({ storyId: 'story-1', source: 'web' }));
    });

    it('ignores missing Cloud Function configuration', async () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch as any;

        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL;

        await trackStoryPlay('story-1');

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('swallows fetch failures', async () => {
        process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = 'https://example.com';

        const mockFetch = jest.fn().mockRejectedValue(new Error('network'));
        global.fetch = mockFetch as any;

        await expect(trackStoryPlay('story-1')).resolves.toBeUndefined();
    });
});

