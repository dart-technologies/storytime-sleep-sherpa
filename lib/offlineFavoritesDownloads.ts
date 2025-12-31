import * as FileSystem from 'expo-file-system/legacy';

type OfflineFavoritesSettings = {
    offlineFavoritesEnabled?: boolean;
};

const settingsFilePath = (() => {
    const baseDir =
        (FileSystem as any).documentDirectory ||
        (FileSystem as any).cacheDirectory ||
        '';
    return `${baseDir}storytime_settings.json`;
})();

let cachedSettings: OfflineFavoritesSettings | null = null;
let loadPromise: Promise<OfflineFavoritesSettings> | null = null;
const listeners = new Set<(enabled: boolean) => void>();

async function readSettingsFile(): Promise<OfflineFavoritesSettings> {
    const path = settingsFilePath;
    if (!path) return {};

    try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return {};

        const raw = await FileSystem.readAsStringAsync(path);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as OfflineFavoritesSettings;
    } catch {
        return {};
    }
}

async function writeSettingsFile(next: OfflineFavoritesSettings): Promise<void> {
    const path = settingsFilePath;
    if (!path) return;

    try {
        await FileSystem.writeAsStringAsync(path, JSON.stringify(next));
    } catch {
        // ignore
    }
}

async function loadSettings(): Promise<OfflineFavoritesSettings> {
    if (cachedSettings) return cachedSettings;
    if (!loadPromise) {
        loadPromise = readSettingsFile().then((loaded) => {
            cachedSettings = loaded;
            loadPromise = null;
            return loaded;
        });
    }
    return loadPromise;
}

function notify(enabled: boolean) {
    listeners.forEach((listener) => {
        try {
            listener(enabled);
        } catch {
            // ignore
        }
    });
}

export function subscribeOfflineFavoritesDownloadsEnabled(listener: (enabled: boolean) => void): () => void {
    listeners.add(listener);
    void getOfflineFavoritesDownloadsEnabled().then((enabled) => {
        try {
            listener(enabled);
        } catch {
            // ignore
        }
    });

    return () => {
        listeners.delete(listener);
    };
}

export async function getOfflineFavoritesDownloadsEnabled(): Promise<boolean> {
    const settings = await loadSettings();
    return Boolean(settings.offlineFavoritesEnabled);
}

export async function setOfflineFavoritesDownloadsEnabled(enabled: boolean): Promise<void> {
    const settings = await loadSettings();
    const next: OfflineFavoritesSettings = { ...settings, offlineFavoritesEnabled: enabled };
    cachedSettings = next;
    await writeSettingsFile(next);
    notify(enabled);
}

export function getOfflineFavoriteAudioFileName(storyId: string): string {
    const safeId = String(storyId || '').replace(/[^A-Za-z0-9_-]/g, '');
    return `favorite_${safeId}.mp3`;
}

export function estimateAudioBytes(durationSec: number | undefined): number {
    if (typeof durationSec !== 'number') return 0;
    if (!Number.isFinite(durationSec)) return 0;
    if (durationSec <= 0) return 0;

    const bitrateKbps = 96;
    const bytesPerSecond = (bitrateKbps * 1000) / 8;
    return Math.round(bytesPerSecond * durationSec);
}
