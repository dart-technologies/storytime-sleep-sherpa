import { fetchSharedStory } from '../sharedStory';

describe('lib/sharedStory', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        process.env = { ...oldEnv };
        process.env.EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY = 'https://example.com/sharedStory';
        delete (globalThis as any).fetch;
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    it('throws for missing story id', async () => {
        await expect(fetchSharedStory('')).rejects.toThrow('Missing story id.');
    });

    it('throws for overly long story id', async () => {
        await expect(fetchSharedStory('x'.repeat(201))).rejects.toThrow('Invalid story id.');
    });

    it('throws with status and error detail when request fails', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: jest.fn().mockResolvedValue({ error: 'Story not found.' }),
        });

        await expect(fetchSharedStory('story-1')).rejects.toThrow('Story request failed: 404 (Story not found.)');
    });

    it('throws when response shape is invalid', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ nope: true }),
        });

        await expect(fetchSharedStory('story-1')).rejects.toThrow('Invalid story response.');
    });

    it('returns a shared story on success', async () => {
        (globalThis as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                story: {
                    id: 'story-1',
                    title: 'Title',
                    summary: 'Summary',
                    personaName: 'Luna',
                    createdAt: 123,
                },
            }),
        });

        const story = await fetchSharedStory('story-1');
        expect(story.id).toBe('story-1');
        expect(story.title).toBe('Title');
    });
});

