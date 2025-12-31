import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { personas } from '../../../lib/personas';
import { SEASONAL_SPECIALS } from '../../../lib/seasonalSpecials';
import { useImageAnalysis } from '../useImageAnalysis';

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: (...args: any[]) => mockRequestMediaLibraryPermissionsAsync(...args),
    launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
}));

const mockDownloadFileAsync = jest.fn();
const mockFileBase64 = jest.fn();
jest.mock('expo-file-system', () => {
    class File {
        static downloadFileAsync(...args: any[]) {
            return mockDownloadFileAsync(...args);
        }

        private readonly uri: string;

        constructor(...parts: string[]) {
            this.uri = parts.join('/');
        }

        base64() {
            return mockFileBase64(this.uri);
        }
    }

    return {
        File,
        Paths: { cache: 'cache' },
    };
});

const mockManipulateAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: (...args: any[]) => mockManipulateAsync(...args),
    SaveFormat: { JPEG: 'jpeg' },
}));

const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: (...args: any[]) => mockImpactAsync(...args),
    ImpactFeedbackStyle: { Light: 'Light' },
}));

const mockAnalyzeImageWithVision = jest.fn();
jest.mock('../../useGemini', () => ({
    useGemini: () => ({
        analyzeImageWithVision: (...args: any[]) => mockAnalyzeImageWithVision(...args),
    }),
}));

jest.mock('../../../lib/debugLogger', () => ({
    createFlowLogger: (_name: string, _opts?: any) => ({
        requestId: 'req_test',
        step: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        end: jest.fn(),
        log: jest.fn(),
    }),
}));

describe('hooks/intake/useImageAnalysis', () => {
    const persona = personas.find((p) => p.id === 'luna') || personas[0];
    const playLatencyMask = jest.fn();
    const stopLatencyMask = jest.fn();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => { });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
        mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
        mockAnalyzeImageWithVision.mockResolvedValue({ analysis: 'ok' });
        mockManipulateAsync.mockResolvedValue({ base64: '/9j/converted', uri: 'file://converted.jpg' });
        mockDownloadFileAsync.mockResolvedValue({ base64: async () => '/9j/seasonal' });
        mockFileBase64.mockResolvedValue('/9j/file');
    });

    afterAll(() => {
        alertSpy.mockRestore();
    });

    function render(overrides: Partial<Parameters<typeof useImageAnalysis>[0]> = {}) {
        const params = {
            persona,
            isConnected: true,
            canInteract: true,
            voiceStatus: 'disconnected',
            playLatencyMask,
            stopLatencyMask,
            remixId: undefined,
            remixCoverUrl: undefined,
            ...overrides,
        };

        return renderHook(() => useImageAnalysis(params));
    }

    it('alerts when offline', async () => {
        const { result } = render({ isConnected: false });

        await act(async () => {
            await result.current.handlePickImage();
        });

        expect(Alert.alert).toHaveBeenCalledWith('Offline', expect.any(String));
        expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    });

    it('alerts when photo permissions are denied', async () => {
        mockRequestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
        const { result } = render();

        await act(async () => {
            await result.current.handlePickImage();
        });

        expect(Alert.alert).toHaveBeenCalledWith('Permission Needed', expect.any(String));
        expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('runs vision analysis on a picked image', async () => {
        const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/test/o/covers%2F1.jpg?alt=media&token=abc';
        mockLaunchImageLibraryAsync.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file://picked.jpg', base64: '/9j/picked', mimeType: 'image/jpeg', fileName: 'picked.jpg' }],
        });
        mockAnalyzeImageWithVision.mockResolvedValueOnce({ analysis: 'calm ocean', imageUrl, meta: { vertex: { modelId: 'vision' }, storagePath: 'covers/1.jpg' } });

        const { result } = render({ voiceStatus: 'disconnected' });

        await act(async () => {
            await result.current.handlePickImage();
        });

        await waitFor(() => expect(result.current.isAnalyzingImage).toBe(false));
        expect(result.current.selectedImageUri).toBe('file://picked.jpg');
        expect(result.current.imageAnalysis).toBe('calm ocean');
        expect(result.current.selectedImageUrl).toBe(imageUrl);
        expect(result.current.imageAnalysisError).toBeNull();

        expect(stopLatencyMask).toHaveBeenCalled();
        expect(playLatencyMask).toHaveBeenCalledWith(persona, 'hook');
        expect(mockAnalyzeImageWithVision).toHaveBeenCalledWith(
            '/9j/picked',
            expect.objectContaining({ mimeType: 'image/jpeg', source: 'upload' })
        );
    });

    it('converts unsupported file image formats via ImageManipulator', async () => {
        mockLaunchImageLibraryAsync.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file://picked.heic', base64: 'data:image/heic;base64,AAAAAA' }],
        });
        mockAnalyzeImageWithVision.mockResolvedValueOnce({ analysis: 'converted ok' });

        const { result } = render({ voiceStatus: 'connected' });

        await act(async () => {
            await result.current.handlePickImage();
        });

        expect(mockManipulateAsync).toHaveBeenCalled();
        expect(result.current.selectedImageUri).toBe('file://converted.jpg');
        expect(mockAnalyzeImageWithVision).toHaveBeenCalledWith(
            '/9j/converted',
            expect.objectContaining({ mimeType: 'image/jpeg', source: 'upload' })
        );
    });

    it('surfaces a friendly error for unsupported non-file images', async () => {
        mockLaunchImageLibraryAsync.mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'content://picked.heic', base64: 'AAAAAA' }],
        });

        const { result } = render();

        await act(async () => {
            await result.current.handlePickImage();
        });

        expect(result.current.imageAnalysisError).toContain('Unsupported image format');
        expect(result.current.selectedImageUri).toBeNull();
    });

    it('selects a seasonal mood and analyzes it', async () => {
        const special = SEASONAL_SPECIALS[0];
        mockAnalyzeImageWithVision.mockResolvedValueOnce({ analysis: 'winter scene' });

        const { result } = render({ voiceStatus: 'connected' });

        await act(async () => {
            await result.current.handleSelectSeasonalMood(special);
        });

        expect(mockImpactAsync).toHaveBeenCalled();
        expect(result.current.selectedImageUri).toBe(special.image);
        expect(result.current.selectedImageUrl).toBe(special.image);
        expect(result.current.isSeasonalMoodSelected).toBe(true);
        expect(result.current.imageAnalysis).toBe('winter scene');
        expect(playLatencyMask).not.toHaveBeenCalled();
    });

    it('hydrates remix cover automatically when provided', async () => {
        const { result } = render({ remixId: 'remix-1', remixCoverUrl: 'https://example.com/cover.jpg' });

        await waitFor(() => {
            expect(result.current.selectedImageUri).toBe('https://example.com/cover.jpg');
        });
        expect(result.current.selectedImageUrl).toBe('https://example.com/cover.jpg');
    });
});

