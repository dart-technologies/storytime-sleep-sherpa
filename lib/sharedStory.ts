import { getSharedStoryCloudEndpointFromEnv, resolveCloudFunctionUrlFromEnv } from './cloudFunctions';

function trim(value: string | undefined): string {
    return (value || '').trim();
}

export type SharedStory = {
    id: string;
    title: string;
    summary: string;
    personaName: string;
    userName?: string;
    audioUrl?: string;
    coverImageUrl?: string;
    createdAt: number;
    duration?: number;
    playCount?: number;
    remixCount?: number;
    favoritedCount?: number;
};

type SharedStoryResponse = {
    story: SharedStory;
    requestId?: string;
};

export async function fetchSharedStory(
    storyId: string,
    options?: { signal?: AbortSignal }
): Promise<SharedStory> {
    const resolvedStoryId = trim(storyId);
    if (!resolvedStoryId) throw new Error('Missing story id.');
    if (resolvedStoryId.length > 200) throw new Error('Invalid story id.');

    const endpoint = getSharedStoryCloudEndpointFromEnv();
    const url = new URL(resolveCloudFunctionUrlFromEnv(endpoint, 'EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY'));
    url.searchParams.set('storyId', resolvedStoryId);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: options?.signal,
    });

    if (!response.ok) {
        let detail = '';
        try {
            const body = await response.json();
            const message = typeof body?.error === 'string' ? body.error : typeof body?.detail?.message === 'string' ? body.detail.message : '';
            detail = message ? ` (${message})` : '';
        } catch {
            // ignore parse errors
        }
        throw new Error(`Story request failed: ${response.status}${detail}`);
    }

    const data = (await response.json()) as SharedStoryResponse;
    if (!data || typeof data !== 'object' || !data.story || typeof data.story !== 'object') {
        throw new Error('Invalid story response.');
    }

    return data.story;
}
