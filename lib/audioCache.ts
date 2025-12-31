import * as FileSystem from 'expo-file-system/legacy';

// Using type assertion to bypass missing type definition in some versions of expo-file-system
const cacheDir = (FileSystem as any).cacheDirectory;
const AUDIO_CACHE_DIR = `${cacheDir ?? ''}audio_narration/`;

export async function ensureCacheDirExists() {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
    }
}

export async function getCachedAudioPath(fileName: string): Promise<string | null> {
    const filePath = `${AUDIO_CACHE_DIR}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists ? filePath : null;
}

export async function cacheAudio(url: string, fileName: string): Promise<string> {
    await ensureCacheDirExists();
    const filePath = `${AUDIO_CACHE_DIR}${fileName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
        url,
        filePath,
        {}
    );

    try {
        const result = await downloadResumable.downloadAsync();
        if (!result) throw new Error('Download failed');
        return result.uri;
    } catch (e) {
        console.error('Error caching audio:', e);
        throw e;
    }
}

export async function clearOldCache(maxSizeMB: number = 500) {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) return;

    // Use readDirectoryAsync to get all files in the cache
    const files = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
    const fileDetails = (await Promise.all(
        files.map(async (fileName) => {
            const filePath = `${AUDIO_CACHE_DIR}${fileName}`;
            const info = await FileSystem.getInfoAsync(filePath);
            if (!info.exists) return null;
            return {
                path: filePath,
                size: (info as any).size || 0,
                mtime: (info as any).modificationTime || 0
            };
        })
    )).filter((f): f is { path: string; size: number; mtime: number } => f !== null);

    const totalSize = fileDetails.reduce((sum, f) => sum + f.size, 0);
    const limit = maxSizeMB * 1024 * 1024;

    if (totalSize > limit) {
        // Sort oldest first
        fileDetails.sort((a, b) => a.mtime - b.mtime);

        let currentSize = totalSize;
        for (const file of fileDetails) {
            if (currentSize <= limit) break;
            await FileSystem.deleteAsync(file.path);
            currentSize -= file.size;
        }
    }
}

export async function getAudioCacheStats(): Promise<{ fileCount: number; totalBytes: number }> {
    try {
        const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
        if (!dirInfo.exists) return { fileCount: 0, totalBytes: 0 };

        const files = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
        const sizes = await Promise.all(files.map(async (fileName) => {
            try {
                const filePath = `${AUDIO_CACHE_DIR}${fileName}`;
                const info = await FileSystem.getInfoAsync(filePath);
                if (!info.exists) return 0;
                const size = (info as any).size;
                return typeof size === 'number' && Number.isFinite(size) ? size : 0;
            } catch {
                return 0;
            }
        }));

        const totalBytes = sizes.reduce((sum, bytes) => sum + bytes, 0);
        return { fileCount: files.length, totalBytes };
    } catch {
        return { fileCount: 0, totalBytes: 0 };
    }
}

export async function clearOfflineFavoritesAudioCache(): Promise<void> {
    try {
        const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
        if (!dirInfo.exists) return;

        const files = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
        const favoriteFiles = files.filter((fileName) => fileName.startsWith('favorite_'));
        await Promise.all(favoriteFiles.map((fileName) => FileSystem.deleteAsync(`${AUDIO_CACHE_DIR}${fileName}`, { idempotent: true })));
    } catch {
        // ignore
    }
}
