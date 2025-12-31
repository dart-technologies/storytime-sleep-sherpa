import { collection, doc } from '@react-native-firebase/firestore';
import { firestore as db } from './firebase';

export const ALLOWED_DAILY_CREATE_LIMITS = [1, 3, 5, 11] as const;
export type AllowedDailyCreateLimit = (typeof ALLOWED_DAILY_CREATE_LIMITS)[number];

export const ALLOWED_STORY_DURATIONS_SEC = [15, 60, 300, 600] as const;
export type AllowedStoryDurationSec = (typeof ALLOWED_STORY_DURATIONS_SEC)[number];

export type AppRuntimeConfig = {
    dailyCreateLimit: AllowedDailyCreateLimit;
    defaultStoryDurationSec: AllowedStoryDurationSec;
};

export const DEFAULT_APP_RUNTIME_CONFIG: AppRuntimeConfig = {
    dailyCreateLimit: 1,
    defaultStoryDurationSec: 60,
};

function normalizeDailyCreateLimit(value: unknown): AllowedDailyCreateLimit {
    if (typeof value !== 'number') return DEFAULT_APP_RUNTIME_CONFIG.dailyCreateLimit;
    if (!Number.isFinite(value)) return DEFAULT_APP_RUNTIME_CONFIG.dailyCreateLimit;
    const parsed = Math.floor(value);
    if (!ALLOWED_DAILY_CREATE_LIMITS.includes(parsed as AllowedDailyCreateLimit)) {
        return DEFAULT_APP_RUNTIME_CONFIG.dailyCreateLimit;
    }
    return parsed as AllowedDailyCreateLimit;
}

function normalizeStoryDurationSec(value: unknown): AllowedStoryDurationSec {
    if (typeof value !== 'number') return DEFAULT_APP_RUNTIME_CONFIG.defaultStoryDurationSec;
    if (!Number.isFinite(value)) return DEFAULT_APP_RUNTIME_CONFIG.defaultStoryDurationSec;
    const parsed = Math.floor(value);
    if (!ALLOWED_STORY_DURATIONS_SEC.includes(parsed as AllowedStoryDurationSec)) {
        return DEFAULT_APP_RUNTIME_CONFIG.defaultStoryDurationSec;
    }
    return parsed as AllowedStoryDurationSec;
}

let cachedConfig: AppRuntimeConfig | null = null;
let cachedAtMs = 0;
let inFlight: Promise<AppRuntimeConfig> | null = null;

export function resetAppRuntimeConfigCache(): void {
    cachedConfig = null;
    cachedAtMs = 0;
    inFlight = null;
}

export async function fetchAppRuntimeConfig(options?: { maxAgeMs?: number }): Promise<AppRuntimeConfig> {
    const now = Date.now();
    const maxAgeMsRaw = options?.maxAgeMs;
    const maxAgeMs =
        typeof maxAgeMsRaw === 'number' && Number.isFinite(maxAgeMsRaw) ? Math.max(0, maxAgeMsRaw) : 10_000;

    if (cachedConfig && now - cachedAtMs < maxAgeMs) {
        return cachedConfig;
    }

    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const ref = doc(collection(db, 'config'), 'app');
            const snapshot = await ref.get();
            const data = snapshot?.exists ? snapshot.data() : null;
            const next: AppRuntimeConfig = {
                dailyCreateLimit: normalizeDailyCreateLimit((data as any)?.dailyCreateLimit),
                defaultStoryDurationSec: normalizeStoryDurationSec((data as any)?.defaultStoryDurationSec),
            };
            cachedConfig = next;
            cachedAtMs = Date.now();
            return next;
        } catch {
            cachedConfig = DEFAULT_APP_RUNTIME_CONFIG;
            cachedAtMs = Date.now();
            return DEFAULT_APP_RUNTIME_CONFIG;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}
