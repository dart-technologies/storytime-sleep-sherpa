function trim(value: string | undefined): string {
    return (value || '').trim();
}

function getEnv(name: string): string | undefined {
    return process.env[name];
}

export function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(trim(value));
}

export function getFirebaseProjectIdFromEnv(): string | null {
    const explicit = trim(getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'));
    if (explicit && /^[a-z0-9-]+$/i.test(explicit)) return explicit;

    const authDomain = trim(getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'));
    const authDomainMatch = authDomain.match(/^([a-z0-9-]+)\.(?:firebaseapp\.com|web\.app)$/i);
    if (authDomainMatch?.[1]) return authDomainMatch[1];

    const storageBucket = trim(getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'));
    const bucketMatch = storageBucket.match(/^([a-z0-9-]+)\.(?:appspot\.com|firebasestorage\.app)$/i);
    if (bucketMatch?.[1]) return bucketMatch[1];

    const databaseUrl = trim(getEnv('EXPO_PUBLIC_FIREBASE_DATABASE_URL'));
    const databaseMatch = databaseUrl.match(
        /^https?:\/\/([a-z0-9-]+)(?:-default-rtdb)?\.(?:firebaseio\.com|firebasedatabase\.app)(?:\/|$)/i
    );
    if (databaseMatch?.[1]) return databaseMatch[1];

    return null;
}

export function joinUrl(baseUrl: string, path: string): string {
    const base = trim(baseUrl).replace(/\/$/, '');
    const suffix = trim(path).startsWith('/') ? trim(path) : `/${trim(path)}`;
    return `${base}${suffix}`;
}

/**
 * Resolves a Cloud Function URL from either:
 * - a full `endpoint` URL (recommended for Cloud Run URLs), or
 * - a `baseUrl` + relative `endpoint` path (legacy).
 */
export function resolveCloudFunctionUrl(baseUrl: string | undefined, endpoint: string | undefined): string | null {
    const endpointTrimmed = trim(endpoint);
    if (!endpointTrimmed) return null;
    if (isHttpUrl(endpointTrimmed)) return endpointTrimmed;

    const baseTrimmed = trim(baseUrl);
    if (!baseTrimmed) return null;
    return joinUrl(baseTrimmed, endpointTrimmed);
}

function inferSiblingCloudRunUrl(sourceUrl: string, serviceName: string): string | null {
    const trimmed = trim(sourceUrl);
    if (!isHttpUrl(trimmed)) return null;
    try {
        const url = new URL(trimmed);
        if (!url.host.endsWith('.a.run.app')) return null;

        const dashIndex = url.host.indexOf('-');
        if (dashIndex <= 0) return null;

        url.host = `${serviceName}${url.host.slice(dashIndex)}`;
        url.pathname = '/';
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function inferSiblingCloudFunctionsUrl(sourceUrl: string, functionName: string): string | null {
    const trimmed = trim(sourceUrl);
    if (!isHttpUrl(trimmed)) return null;
    try {
        const url = new URL(trimmed);
        if (!url.host.endsWith('.cloudfunctions.net')) return null;

        url.pathname = `/${functionName}`;
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function inferCloudFunctionsUrlFromFirebaseProjectId(functionName: string): string | null {
    const projectId = getFirebaseProjectIdFromEnv();
    if (!projectId) return null;

    const region =
        trim(getEnv('EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION')) ||
        trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTIONS_REGION')) ||
        'us-central1';

    if (!/^[a-z0-9-]+$/i.test(region)) return null;
    if (!/^[a-z0-9-]+$/i.test(projectId)) return null;

    return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

export function resolveCloudFunctionUrlFromEnv(endpoint: string | undefined, fallbackEnvVar: string): string {
    const baseUrl = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTIONS_URL'));
    const url = resolveCloudFunctionUrl(baseUrl, endpoint);
    if (url) return url;

    const endpointTrimmed = trim(endpoint);
    if (!endpointTrimmed || isHttpUrl(endpointTrimmed)) {
        throw new Error(
            `Missing Cloud Function URL. Set ${fallbackEnvVar} to a full URL, set EXPO_PUBLIC_CLOUD_FUNCTIONS_URL, or set EXPO_PUBLIC_FIREBASE_PROJECT_ID.`
        );
    }

    const functionName = endpointTrimmed.replace(/^\/+/, '').split(/[/?#]/)[0]?.trim();
    const inferred = functionName ? inferCloudFunctionsUrlFromFirebaseProjectId(functionName) : null;
    if (inferred) return inferred;

    throw new Error(
        `Missing Cloud Function URL. Set ${fallbackEnvVar} to a full URL, set EXPO_PUBLIC_CLOUD_FUNCTIONS_URL, or set EXPO_PUBLIC_FIREBASE_PROJECT_ID.`
    );
}

export type GeminiCloudEndpoints = {
    generate: string;
    vision: string;
    illustrate: string;
};

export function getGeminiCloudEndpointsFromEnv(): GeminiCloudEndpoints {
    const generate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE') || '/generate');
    const vision = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_VISION') || '/vision');
    const illustrateEnv = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_ILLUSTRATE'));

    const inferredIllustrate =
        inferSiblingCloudRunUrl(vision, 'illustrate') ||
        inferSiblingCloudRunUrl(generate, 'illustrate') ||
        inferSiblingCloudFunctionsUrl(generate, 'illustrate') ||
        inferSiblingCloudFunctionsUrl(vision, 'illustrate');

    return {
        generate,
        vision,
        illustrate: illustrateEnv || inferredIllustrate || '/illustrate',
    };
}

export function getNarrateCloudEndpointFromEnv(): string {
    const narrate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE'));
    if (narrate) return narrate;

    const generate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE'));
    const vision = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_VISION'));
    const inferred =
        inferSiblingCloudRunUrl(generate, 'narrate') ||
        inferSiblingCloudRunUrl(vision, 'narrate') ||
        inferSiblingCloudFunctionsUrl(generate, 'narrate') ||
        inferSiblingCloudFunctionsUrl(vision, 'narrate');

    return inferred || '/narrate';
}

export function getSharedStoryCloudEndpointFromEnv(): string {
    const baseUrl = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTIONS_URL'));
    const explicit = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY'));
    const explicitResolved = resolveCloudFunctionUrl(baseUrl, explicit);
    if (explicitResolved) return explicitResolved;

    const intake = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_INTAKE'));
    const generate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE'));
    const vision = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_VISION'));
    const narrate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE'));
    const elevenlabsToken = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN'));
    const illustrate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_ILLUSTRATE'));

    const inferred =
        inferSiblingCloudRunUrl(generate, 'sharedstory') ||
        inferSiblingCloudRunUrl(vision, 'sharedstory') ||
        inferSiblingCloudRunUrl(intake, 'sharedstory') ||
        inferSiblingCloudRunUrl(illustrate, 'sharedstory') ||
        inferSiblingCloudRunUrl(elevenlabsToken, 'sharedstory') ||
        inferSiblingCloudFunctionsUrl(narrate, 'sharedStory') ||
        inferSiblingCloudFunctionsUrl(generate, 'sharedStory') ||
        inferSiblingCloudFunctionsUrl(vision, 'sharedStory');

    return inferred || inferCloudFunctionsUrlFromFirebaseProjectId('sharedStory') || '/sharedStory';
}

export function getStoryPlayCloudEndpointFromEnv(): string {
    const baseUrl = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTIONS_URL'));
    const explicit = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_STORY_PLAY'));
    const explicitResolved = resolveCloudFunctionUrl(baseUrl, explicit);
    if (explicitResolved) return explicitResolved;

    const intake = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_INTAKE'));
    const generate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE'));
    const vision = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_VISION'));
    const narrate = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE'));
    const sharedStory = trim(getEnv('EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY'));

    const inferred =
        inferSiblingCloudRunUrl(sharedStory, 'storyplay') ||
        inferSiblingCloudRunUrl(generate, 'storyplay') ||
        inferSiblingCloudRunUrl(vision, 'storyplay') ||
        inferSiblingCloudRunUrl(intake, 'storyplay') ||
        inferSiblingCloudFunctionsUrl(sharedStory, 'storyPlay') ||
        inferSiblingCloudFunctionsUrl(generate, 'storyPlay') ||
        inferSiblingCloudFunctionsUrl(vision, 'storyPlay') ||
        inferSiblingCloudFunctionsUrl(narrate, 'storyPlay');

    return inferred || inferCloudFunctionsUrlFromFirebaseProjectId('storyPlay') || '/storyPlay';
}
