import { getStoryPlayCloudEndpointFromEnv, resolveCloudFunctionUrlFromEnv } from './cloudFunctions';

function trim(value: string | undefined): string {
    return (value || '').trim();
}

export async function trackStoryPlay(
    storyId: string,
    options?: { source?: string; signal?: AbortSignal }
): Promise<void> {
    const resolvedStoryId = trim(storyId);
    if (!resolvedStoryId) return;
    if (resolvedStoryId.length > 200) return;

    let url: string;
    try {
        const endpoint = getStoryPlayCloudEndpointFromEnv();
        url = resolveCloudFunctionUrlFromEnv(endpoint, 'EXPO_PUBLIC_CLOUD_FUNCTION_STORY_PLAY');
    } catch {
        return;
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                storyId: resolvedStoryId,
                source: trim(options?.source) || undefined,
            }),
            signal: options?.signal,
        });
    } catch {
        // ignore telemetry failures
    }
}

