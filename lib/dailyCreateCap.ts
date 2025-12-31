import { collection, doc, runTransaction, setDoc } from '@react-native-firebase/firestore';
import { DEFAULT_APP_RUNTIME_CONFIG, fetchAppRuntimeConfig } from './appConfig';
import { firestore as db } from './firebase';

export const DAILY_CREATE_LIMIT = DEFAULT_APP_RUNTIME_CONFIG.dailyCreateLimit;

async function resolveDailyCreateLimit(): Promise<number> {
    const config = await fetchAppRuntimeConfig();
    return config.dailyCreateLimit;
}

type DailyCreateDoc = {
    timeZone?: string;
    dailyCreateDate?: string;
    dailyCreateCount?: number;
};

function snapshotExists(snapshot: any): boolean {
    try {
        if (!snapshot) return false;
        const existsField = (snapshot as any).exists;
        if (typeof existsField === 'function') return Boolean(existsField.call(snapshot));
        return Boolean(existsField);
    } catch {
        return false;
    }
}

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function getLocalDateKeyNow(): string {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getDeviceTimeZone(): string | null {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return typeof tz === 'string' && tz.trim() ? tz.trim() : null;
    } catch {
        return null;
    }
}

export function getDateKeyNow(timeZone: string | null | undefined): string {
    const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
    if (!tz) return getLocalDateKeyNow();

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const year = parts.find((p) => p.type === 'year')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;
        if (!year || !month || !day) return getLocalDateKeyNow();
        return `${year}-${month}-${day}`;
    } catch {
        return getLocalDateKeyNow();
    }
}

function normalizeCount(value: unknown): number {
    if (typeof value !== 'number') return 0;
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
}

function getEffectiveCountForToday(data: DailyCreateDoc, todayKey: string): number {
    const storedDate = typeof data.dailyCreateDate === 'string' ? data.dailyCreateDate : '';
    if (storedDate !== todayKey) return 0;
    return normalizeCount(data.dailyCreateCount);
}

export type DailyCreateState = {
    timeZone: string | null;
    todayKey: string;
    countToday: number;
    limit: number;
    remaining: number;
};

export async function fetchDailyCreateState(userId: string): Promise<DailyCreateState> {
    const limit = await resolveDailyCreateLimit();
    const deviceTimeZone = getDeviceTimeZone();
    const userRef = doc(collection(db, 'users'), userId);
    const snapshot = await userRef.get();
    const data = (snapshotExists(snapshot) ? (snapshot.data() as DailyCreateDoc) : {}) || {};
    const timeZone = typeof data.timeZone === 'string' && data.timeZone.trim() ? data.timeZone.trim() : deviceTimeZone;
    const todayKey = getDateKeyNow(timeZone);
    const countToday = getEffectiveCountForToday(data, todayKey);
    return {
        timeZone: timeZone || null,
        todayKey,
        countToday,
        limit,
        remaining: Math.max(0, limit - countToday),
    };
}

export async function assertUnderDailyCreateCap(userId: string): Promise<DailyCreateState> {
    const state = await fetchDailyCreateState(userId);
    if (state.countToday >= state.limit) {
        throw new Error(`Daily generation limit reached (${state.limit}/day). Try again tomorrow.`);
    }
    return state;
}

export async function incrementDailyCreateCount(userId: string): Promise<DailyCreateState> {
    const limit = await resolveDailyCreateLimit();
    const deviceTimeZone = getDeviceTimeZone();
    const userRef = doc(collection(db, 'users'), userId);

    const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(userRef);
        const data = (snapshotExists(snapshot) ? (snapshot.data() as DailyCreateDoc) : {}) || {};
        const storedTimeZone =
            typeof data.timeZone === 'string' && data.timeZone.trim() ? data.timeZone.trim() : null;
        const timeZone = storedTimeZone || deviceTimeZone;
        const todayKey = getDateKeyNow(timeZone);
        const countToday = getEffectiveCountForToday(data, todayKey);

        const nextCount = countToday + 1;
        transaction.set(
            userRef,
            {
                timeZone: timeZone || null,
                dailyCreateDate: todayKey,
                dailyCreateCount: nextCount,
            },
            { merge: true }
        );

        return { timeZone: timeZone || null, todayKey, countToday: nextCount };
    });

    return {
        timeZone: result.timeZone,
        todayKey: result.todayKey,
        countToday: result.countToday,
        limit,
        remaining: Math.max(0, limit - result.countToday),
    };
}

export async function ensureUserTimeZone(userId: string): Promise<void> {
    const timeZone = getDeviceTimeZone();
    if (!timeZone) return;
    const userRef = doc(collection(db, 'users'), userId);
    await setDoc(userRef, { timeZone }, { merge: true });
}
