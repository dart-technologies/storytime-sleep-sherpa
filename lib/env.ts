import { personas } from './personas';
import { resolveCloudFunctionUrl, resolveCloudFunctionUrlFromEnv } from './cloudFunctions';

function trim(value: string | undefined): string {
    return (value || '').trim();
}

export function getPublicEnvInt(name: string, fallback: number): number {
    const raw = trim((process.env as Record<string, string | undefined>)[name]);
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

export function getPublicEnvBool(name: string, fallback: boolean): boolean {
    const raw = trim((process.env as Record<string, string | undefined>)[name]).toLowerCase();
    if (!raw) return fallback;

    if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on') return true;
    if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'n' || raw === 'off') return false;

    return fallback;
}

export function getFirestoreWriteTimeoutMs(fallbackMs = 3500): number {
    const value = getPublicEnvInt('EXPO_PUBLIC_FIRESTORE_WRITE_TIMEOUT_MS', fallbackMs);
    return value > 0 ? value : fallbackMs;
}

export type PublicEnvValidation = {
    missingRequired: string[];
    missingAgentIds: string[];
    misconfigured: string[];
};

export function validatePublicEnv(): PublicEnvValidation {
    const missingRequired: string[] = [];
    const misconfigured: string[] = [];

    const googleClientId = trim(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
    const googleIosClientId = trim(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

    const firebaseApiKey = trim(process.env.EXPO_PUBLIC_FIREBASE_API_KEY);
    const firebaseAuthDomain = trim(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
    const firebaseProjectId = trim(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
    const firebaseStorageBucket = trim(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const firebaseMessagingSenderId = trim(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
    const firebaseAppId = trim(process.env.EXPO_PUBLIC_FIREBASE_APP_ID);

    const cloudFunctionsUrl = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL);
    const cloudFunctionsGenerate = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE || '/generate');
    const cloudFunctionsVision = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTION_VISION || '/vision');
    const cloudFunctionsNarrate = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE || '/narrate');
    const cloudFunctionsElevenLabsToken = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN || '/elevenlabsToken');
    const cloudFunctionsSharedStory = trim(process.env.EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY || '/sharedStory');
    const webBaseUrl = trim(process.env.EXPO_PUBLIC_WEB_BASE_URL);

    if (!googleClientId) missingRequired.push('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
    if (!googleIosClientId) missingRequired.push('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    if (!firebaseApiKey) missingRequired.push('EXPO_PUBLIC_FIREBASE_API_KEY');
    if (!firebaseAuthDomain) missingRequired.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
    if (!firebaseProjectId) missingRequired.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
    if (!firebaseStorageBucket) missingRequired.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
    if (!firebaseMessagingSenderId) missingRequired.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
    if (!firebaseAppId) missingRequired.push('EXPO_PUBLIC_FIREBASE_APP_ID');

    if (cloudFunctionsUrl) {
        try {
            new URL(cloudFunctionsUrl);
        } catch {
            misconfigured.push('EXPO_PUBLIC_CLOUD_FUNCTIONS_URL is not a valid URL.');
        }
    }

    const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
    const usesRelativeEndpoints =
        !!cloudFunctionsUrl &&
        [cloudFunctionsGenerate, cloudFunctionsVision, cloudFunctionsNarrate, cloudFunctionsElevenLabsToken].some((endpoint) => endpoint && !isHttpUrl(endpoint));
    if (usesRelativeEndpoints && cloudFunctionsUrl.includes('.a.run.app')) {
        misconfigured.push(
            'EXPO_PUBLIC_CLOUD_FUNCTIONS_URL points to a single Cloud Run service (`*.a.run.app`). Use full per-function URLs (recommended) or a shared base like `https://us-central1-<project>.cloudfunctions.net`.'
        );
    }

    const validateEndpoint = (envVarName: string, endpoint: string, required: boolean) => {
        let resolved = resolveCloudFunctionUrl(cloudFunctionsUrl, endpoint);
        if (!resolved) {
            try {
                resolved = resolveCloudFunctionUrlFromEnv(endpoint, envVarName);
            } catch {
                if (required) {
                    misconfigured.push(`Set ${envVarName} to a full URL (or set EXPO_PUBLIC_CLOUD_FUNCTIONS_URL).`);
                }
                return;
            }
        }

        try {
            new URL(resolved);
        } catch {
            misconfigured.push(`${envVarName} is not a valid URL.`);
        }
    };

    validateEndpoint('EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE', cloudFunctionsGenerate, true);
    validateEndpoint('EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE', cloudFunctionsNarrate, true);
    validateEndpoint('EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN', cloudFunctionsElevenLabsToken, true);
    validateEndpoint('EXPO_PUBLIC_CLOUD_FUNCTION_VISION', cloudFunctionsVision, false);
    validateEndpoint('EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY', cloudFunctionsSharedStory, false);

    if (webBaseUrl) {
        try {
            new URL(webBaseUrl);
            if (!/^https?:\/\//i.test(webBaseUrl)) {
                misconfigured.push('EXPO_PUBLIC_WEB_BASE_URL must start with http:// or https://.');
            }
        } catch {
            misconfigured.push('EXPO_PUBLIC_WEB_BASE_URL is not a valid URL.');
        }
    }

    const missingAgentIds = personas
        .filter((p) => !p.agentId?.trim())
        .map((p) => `EXPO_PUBLIC_ELEVENLABS_AGENT_${p.id.toUpperCase()}`);

    return { missingRequired, missingAgentIds, misconfigured };
}
