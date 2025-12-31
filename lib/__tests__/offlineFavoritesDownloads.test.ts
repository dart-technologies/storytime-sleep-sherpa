let mockFileContents: string | null = null;

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///docs/',
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async (_path: string) => ({ exists: mockFileContents !== null }),
    readAsStringAsync: async (_path: string) => mockFileContents || '',
    writeAsStringAsync: async (_path: string, contents: string) => {
        mockFileContents = contents;
    },
}));

describe('lib/offlineFavoritesDownloads', () => {
    beforeEach(() => {
        jest.resetModules();
        mockFileContents = null;
    });

    it('defaults to disabled when no settings file exists', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getOfflineFavoritesDownloadsEnabled } = require('../offlineFavoritesDownloads') as typeof import('../offlineFavoritesDownloads');
        await expect(getOfflineFavoritesDownloadsEnabled()).resolves.toBe(false);
    });

    it('persists and notifies when toggled', async () => {
        const {
            getOfflineFavoritesDownloadsEnabled,
            setOfflineFavoritesDownloadsEnabled,
            subscribeOfflineFavoritesDownloadsEnabled,
        } = require('../offlineFavoritesDownloads') as typeof import('../offlineFavoritesDownloads');

        const calls: boolean[] = [];
        const unsubscribe = subscribeOfflineFavoritesDownloadsEnabled((value) => {
            calls.push(value);
        });

        await Promise.resolve();
        expect(await getOfflineFavoritesDownloadsEnabled()).toBe(false);

        await setOfflineFavoritesDownloadsEnabled(true);
        expect(await getOfflineFavoritesDownloadsEnabled()).toBe(true);

        await Promise.resolve();
        expect(calls.includes(true)).toBe(true);

        unsubscribe();
    });

    it('generates a safe cache file name', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getOfflineFavoriteAudioFileName } = require('../offlineFavoritesDownloads') as typeof import('../offlineFavoritesDownloads');
        expect(getOfflineFavoriteAudioFileName('abcDEF_123-xyz')).toBe('favorite_abcDEF_123-xyz.mp3');
        expect(getOfflineFavoriteAudioFileName('a/b')).toBe('favorite_ab.mp3');
    });
});
