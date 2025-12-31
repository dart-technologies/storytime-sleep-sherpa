import { getFirebaseProjectIdFromEnv, isHttpUrl, joinUrl } from './cloudFunctions';
import { extractFirebaseBucketNameFromUrl } from './urlUtils';

function trim(value: string | undefined): string {
    return (value || '').trim();
}

const INLINED_EXPO_PUBLIC_ENV = {
    EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
    EXPO_PUBLIC_SHARE_BASE_URL: process.env.EXPO_PUBLIC_SHARE_BASE_URL,
} as const;

type ExpoPublicEnvKey = keyof typeof INLINED_EXPO_PUBLIC_ENV;

function getExpoPublicEnv(key: ExpoPublicEnvKey): string | undefined {
    const runtimeEnv = (process.env || {}) as Record<string, string | undefined>;
    const runtimeValue = runtimeEnv[key];
    if (typeof process.env.JEST_WORKER_ID === 'string') return runtimeValue;
    return runtimeValue !== undefined ? runtimeValue : INLINED_EXPO_PUBLIC_ENV[key];
}

function isValidHttpBaseUrl(value: string): boolean {
    const trimmed = trim(value);
    if (!trimmed) return false;
    if (!isHttpUrl(trimmed)) return false;
    if (!/^https?:\/\/[^/?#\s]+/i.test(trimmed)) return false;

    if (typeof URL === 'function') {
        try {
            new URL(trimmed);
        } catch {
            return false;
        }
    }

    return true;
}

function inferFirebaseHostingBaseUrlFromEnv(): string | null {
    const projectId = getFirebaseProjectIdFromEnv();
    if (!projectId) return null;
    return `https://${projectId}.web.app`;
}

function inferFirebaseProjectIdFromBucketName(bucketName: string | undefined): string | null {
    const trimmed = trim(bucketName);
    if (!trimmed) return null;
    const match = trimmed.match(/^([a-z0-9-]+)\.(?:appspot\.com|firebasestorage\.app)$/i);
    return match?.[1] ? match[1] : null;
}

function inferFirebaseHostingBaseUrlFromAssetUrls(assetUrls: Array<string | undefined> | undefined): string | null {
    if (!assetUrls?.length) return null;

    for (const assetUrl of assetUrls) {
        const bucketName = extractFirebaseBucketNameFromUrl(assetUrl);
        const projectId = inferFirebaseProjectIdFromBucketName(bucketName);
        if (!projectId) continue;
        return `https://${projectId}.web.app`;
    }

    return null;
}

export function getWebBaseUrlFromEnv(): string | null {
    const baseUrl = trim(getExpoPublicEnv('EXPO_PUBLIC_WEB_BASE_URL'));
    if (!isValidHttpBaseUrl(baseUrl)) return null;
    return baseUrl.replace(/\/+$/, '');
}

export function getShareBaseUrlFromEnv(): string | null {
    const shareBaseUrl = trim(getExpoPublicEnv('EXPO_PUBLIC_SHARE_BASE_URL'));
    if (shareBaseUrl && isValidHttpBaseUrl(shareBaseUrl)) {
        return shareBaseUrl.replace(/\/+$/, '');
    }

    const firebaseHostingBaseUrl = inferFirebaseHostingBaseUrlFromEnv();
    if (firebaseHostingBaseUrl) return firebaseHostingBaseUrl.replace(/\/+$/, '');

    return getWebBaseUrlFromEnv();
}

export function getStoryShareUrl(storyId: string, assetUrls?: Array<string | undefined>): string | null {
    const baseUrl = getShareBaseUrlFromEnv() || inferFirebaseHostingBaseUrlFromAssetUrls(assetUrls);
    if (!baseUrl) return null;
    const encoded = encodeURIComponent(trim(storyId));
    if (!encoded) return null;
    return joinUrl(baseUrl, `/s/${encoded}`);
}
