import * as FileSystem from 'expo-file-system/legacy';
import { cacheAudio, clearOldCache, ensureCacheDirExists, getCachedAudioPath } from '../audioCache';

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: 'file:///mock_cache/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    createDownloadResumable: jest.fn(),
    deleteAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
}));

const mockFS = FileSystem as any;

describe('audioCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should ensure cache directory exists', async () => {
        mockFS.getInfoAsync.mockResolvedValue({ exists: false });
        await ensureCacheDirExists();
        expect(mockFS.makeDirectoryAsync).toHaveBeenCalledWith(expect.any(String), { intermediates: true });
    });

    it('should check for cached audio path', async () => {
        mockFS.getInfoAsync.mockResolvedValue({ exists: true });
        const path = await getCachedAudioPath('test.mp3');
        expect(path).toContain('test.mp3');
    });

    it('should cache audio from url', async () => {
        mockFS.getInfoAsync.mockResolvedValue({ exists: true });
        const mockDownload = {
            downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///cached_path/test.mp3' }),
        };
        mockFS.createDownloadResumable.mockReturnValue(mockDownload);

        const path = await cacheAudio('https://example.com/audio.mp3', 'test.mp3');
        expect(path).toBe('file:///cached_path/test.mp3');
        expect(mockFS.createDownloadResumable).toHaveBeenCalled();
    });

    it('should throw error if download fails', async () => {
        mockFS.getInfoAsync.mockResolvedValue({ exists: true });
        const mockDownload = {
            downloadAsync: jest.fn().mockRejectedValue(new Error('Network error')),
        };
        mockFS.createDownloadResumable.mockReturnValue(mockDownload);

        await expect(cacheAudio('url', 'file')).rejects.toThrow('Network error');
    });

    it('should clear old cache using LRU if size exceeds limit', async () => {
        // Mock two files: one old, one new
        mockFS.readDirectoryAsync.mockResolvedValue(['old.mp3', 'new.mp3']);
        mockFS.getInfoAsync
            .mockResolvedValueOnce({ exists: true }) // DIR check
            .mockResolvedValueOnce({ exists: true, size: 400 * 1024 * 1024, modificationTime: 1000 }) // old.mp3
            .mockResolvedValueOnce({ exists: true, size: 200 * 1024 * 1024, modificationTime: 2000 }); // new.mp3

        await clearOldCache(500); // 500MB limit < 600MB total

        // Should delete the oldest file (old.mp3)
        expect(mockFS.deleteAsync).toHaveBeenCalledWith(expect.stringContaining('old.mp3'));
        expect(mockFS.deleteAsync).not.toHaveBeenCalledWith(expect.stringContaining('new.mp3'));
    });

    it('should skip clearing if cache is small', async () => {
        mockFS.readDirectoryAsync.mockResolvedValue(['small.mp3']);
        mockFS.getInfoAsync
            .mockResolvedValueOnce({ exists: true }) // DIR check
            .mockResolvedValueOnce({ exists: true, size: 100 * 1024, modificationTime: 1000 });

        await clearOldCache(500);
        expect(mockFS.deleteAsync).not.toHaveBeenCalled();
    });
});
