import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { createFlowLogger } from '../../lib/debugLogger';
import type { Persona } from '../../lib/personas';
import { SEASONAL_SPECIALS } from '../../lib/seasonalSpecials';
import { extractFirebaseBucketNameFromUrl, redactUrlForLogs } from '../../lib/urlUtils';
import { useGemini } from '../useGemini';

function stripBase64DataUrl(value: string): { base64: string; mimeType: string | null } {
    const trimmed = String(value || '').trim();
    const match = trimmed.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) return { base64: trimmed, mimeType: null };
    return { base64: match[2], mimeType: match[1] };
}

function inferImageMimeTypeFromBase64(base64Data: string): 'image/png' | 'image/jpeg' {
    const trimmed = String(base64Data || '').trim();
    if (trimmed.startsWith('iVBORw0KGgo')) return 'image/png';
    if (trimmed.startsWith('/9j/')) return 'image/jpeg';
    return 'image/jpeg';
}

function clampNumber(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function resolveIntEnv(key: string, fallback: number): number {
    const raw = String((process.env as any)[key] || '').trim();
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFloatEnv(key: string, fallback: number): number {
    const raw = String((process.env as any)[key] || '').trim();
    const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}

const TARGET_UPLOAD_IMAGE_MAX_DIM_PX = clampNumber(resolveIntEnv('EXPO_PUBLIC_UPLOAD_IMAGE_MAX_DIM_PX', 1024), 256, 2048);
const TARGET_UPLOAD_IMAGE_JPEG_COMPRESS = clampNumber(
    resolveFloatEnv('EXPO_PUBLIC_UPLOAD_IMAGE_JPEG_COMPRESS', 0.85),
    0.1,
    1
);
const TARGET_UPLOAD_IMAGE_MAX_BASE64_LENGTH = clampNumber(
    resolveIntEnv('EXPO_PUBLIC_UPLOAD_IMAGE_MAX_BASE64_LENGTH', 1_500_000),
    200_000,
    10_000_000
);

type Params = {
    persona: Persona | null;
    isConnected: boolean;
    canInteract: boolean;
    voiceStatus: any;
    playLatencyMask: (persona: Persona, type: any) => void;
    stopLatencyMask: () => void;
    remixId?: string | null;
    remixCoverUrl?: string | null;
};

export function useImageAnalysis({
    persona,
    isConnected,
    canInteract,
    voiceStatus,
    playLatencyMask,
    stopLatencyMask,
    remixId,
    remixCoverUrl,
}: Params) {
    const { analyzeImageWithVision } = useGemini();

    const moodImageWasChangedByUserRef = useRef(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [imageAnalysis, setImageAnalysis] = useState<string | null>(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);

    const canSelectMoodImage = canInteract && !isAnalyzingImage;

    const isSeasonalMoodSelected = useMemo(
        () => Boolean(selectedImageUri && SEASONAL_SPECIALS.some((special) => special.image === selectedImageUri)),
        [selectedImageUri]
    );

    useEffect(() => {
        moodImageWasChangedByUserRef.current = false;
        setSelectedImageUri(null);
        setSelectedImageUrl(null);
        setImageAnalysis(null);
        setImageAnalysisError(null);
        setIsAnalyzingImage(false);
    }, [persona?.id]);

    useEffect(() => {
        const remixKey = typeof remixId === 'string' ? remixId.trim() : '';
        const remixCover = typeof remixCoverUrl === 'string' ? remixCoverUrl.trim() : '';
        if (!remixKey || !remixCover) return;
        if (moodImageWasChangedByUserRef.current) return;
        if (selectedImageUri) return;
        setSelectedImageUri(remixCover);
        setSelectedImageUrl(remixCover);
    }, [remixCoverUrl, remixId, selectedImageUri]);

    const clearImage = useCallback(() => {
        moodImageWasChangedByUserRef.current = true;
        setSelectedImageUri(null);
        setSelectedImageUrl(null);
        setImageAnalysis(null);
        setImageAnalysisError(null);
        setIsAnalyzingImage(false);
    }, []);

    const loadRemoteImageBase64 = useCallback(async (uri: string) => {
        const filename = `mood_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const destination = new FileSystem.File(FileSystem.Paths.cache, filename);
        const downloadedFile = await FileSystem.File.downloadFileAsync(uri, destination, { idempotent: true });
        return downloadedFile.base64();
    }, []);

    const handlePickImage = useCallback(async () => {
        if (!persona) return;
        if (!isConnected) {
            Alert.alert('Offline', 'Please check your internet connection to analyze an image.');
            return;
        }
        if (!canInteract) return;

        moodImageWasChangedByUserRef.current = true;
        const flow = createFlowLogger('Pick Image', { meta: { personaId: persona.id } });
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Needed', 'Please allow photo access to pick an image.');
                flow.warn('permission:denied');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                base64: true,
                quality: 0.7,
            });

            if (result.canceled || !result.assets?.length) {
                flow.step('picker:canceled');
                return;
            }

            const asset = result.assets[0];
            if (!asset?.uri) {
                throw new Error('No image URI returned by picker');
            }

            const uri = asset.uri;
            const assetMimeType =
                typeof (asset as any)?.mimeType === 'string' ? String((asset as any).mimeType).trim() : undefined;
            const assetFileName =
                typeof (asset as any)?.fileName === 'string' ? String((asset as any).fileName).trim() : undefined;
            const hasPickerBase64 = typeof asset.base64 === 'string' && asset.base64.trim();
            const base64Raw = hasPickerBase64
                ? asset.base64
                : uri.startsWith('file://')
                    ? await new FileSystem.File(uri).base64()
                    : '';
            if (!base64Raw) {
                throw new Error('No image data returned by picker');
            }
            const stripped = stripBase64DataUrl(base64Raw);
            const originalBase64Prefix = stripped.base64.slice(0, 12);
            const looksSupported = originalBase64Prefix.startsWith('iVBORw0KGgo') || originalBase64Prefix.startsWith('/9j/');

            let resolvedBase64 = stripped.base64;
            let resolvedUri = uri;
            let base64Source: 'picker' | 'filesystem' | 'manipulator' = hasPickerBase64 ? 'picker' : 'filesystem';

            if (!looksSupported) {
                if (!uri.startsWith('file://')) {
                    flow.warn('image:unsupported', {
                        uriScheme: uri.split(':')[0],
                        assetMimeType: assetMimeType || null,
                        assetFileName: assetFileName || null,
                        base64Prefix: originalBase64Prefix,
                    });
                    throw new Error('Unsupported image format. Please pick a JPEG or PNG.');
                }

                flow.step('image:convert:begin', {
                    assetMimeType: assetMimeType || null,
                    assetFileName: assetFileName || null,
                    base64Prefix: originalBase64Prefix,
                });

                const conversion = await ImageManipulator.manipulateAsync(
                    uri,
                    [],
                    {
                        compress: 0.85,
                        format: ImageManipulator.SaveFormat.JPEG,
                        base64: true,
                    }
                );

                const convertedBase64 = typeof conversion?.base64 === 'string' ? conversion.base64.trim() : '';
                if (!convertedBase64) {
                    flow.warn('image:convert:no_base64', {
                        assetMimeType: assetMimeType || null,
                        assetFileName: assetFileName || null,
                    });
                    throw new Error('Could not convert this image. Please pick a JPEG or PNG.');
                }

                const convertedPrefix = convertedBase64.slice(0, 12);
                if (!convertedPrefix.startsWith('/9j/')) {
                    flow.warn('image:convert:unexpected_format', {
                        assetMimeType: assetMimeType || null,
                        assetFileName: assetFileName || null,
                        convertedPrefix,
                    });
                    throw new Error('Unsupported image format. Please pick a JPEG or PNG.');
                }

                resolvedBase64 = convertedBase64;
                resolvedUri = typeof conversion?.uri === 'string' && conversion.uri.trim() ? conversion.uri : uri;
                base64Source = 'manipulator';

                flow.step('image:convert:done', {
                    assetMimeType: assetMimeType || null,
                    assetFileName: assetFileName || null,
                    base64Prefix: convertedPrefix,
                });
            }

            const assetWidth = typeof (asset as any)?.width === 'number' ? (asset as any).width : undefined;
            const assetHeight = typeof (asset as any)?.height === 'number' ? (asset as any).height : undefined;
            const assetMaxDim =
                typeof assetWidth === 'number' && typeof assetHeight === 'number'
                    ? Math.max(assetWidth, assetHeight)
                    : null;

            const shouldDownscale =
                resolvedUri.startsWith('file://') &&
                (
                    (assetMaxDim !== null && assetMaxDim > TARGET_UPLOAD_IMAGE_MAX_DIM_PX) ||
                    resolvedBase64.length > TARGET_UPLOAD_IMAGE_MAX_BASE64_LENGTH
                );

            if (shouldDownscale) {
                flow.step('image:resize:begin', {
                    assetWidth: assetWidth ?? null,
                    assetHeight: assetHeight ?? null,
                    assetMaxDim,
                    base64Length: resolvedBase64.length,
                    targetMaxDimPx: TARGET_UPLOAD_IMAGE_MAX_DIM_PX,
                });

                const resize =
                    typeof assetWidth === 'number' && typeof assetHeight === 'number' && assetMaxDim !== null
                        ? (
                            assetWidth >= assetHeight
                                ? { width: TARGET_UPLOAD_IMAGE_MAX_DIM_PX }
                                : { height: TARGET_UPLOAD_IMAGE_MAX_DIM_PX }
                        )
                        : { width: TARGET_UPLOAD_IMAGE_MAX_DIM_PX };

                const resized = await ImageManipulator.manipulateAsync(
                    resolvedUri,
                    [{ resize }],
                    {
                        compress: TARGET_UPLOAD_IMAGE_JPEG_COMPRESS,
                        format: ImageManipulator.SaveFormat.JPEG,
                        base64: true,
                    }
                );

                const resizedBase64 = typeof resized?.base64 === 'string' ? resized.base64.trim() : '';
                if (resizedBase64) {
                    resolvedBase64 = resizedBase64;
                    resolvedUri = typeof resized?.uri === 'string' && resized.uri.trim() ? resized.uri : resolvedUri;
                    base64Source = 'manipulator';
                    flow.step('image:resize:done', {
                        base64Prefix: resolvedBase64.slice(0, 12),
                        base64Length: resolvedBase64.length,
                        uriScheme: resolvedUri.split(':')[0],
                    });
                } else {
                    flow.warn('image:resize:no_base64', {
                        assetWidth: assetWidth ?? null,
                        assetHeight: assetHeight ?? null,
                        assetMaxDim,
                    });
                }
            }

            const resolvedMimeType = inferImageMimeTypeFromBase64(resolvedBase64);
            const base64Prefix = resolvedBase64.slice(0, 12);

            setSelectedImageUri(resolvedUri);
            setSelectedImageUrl(null);
            setImageAnalysis(null);
            setImageAnalysisError(null);
            setIsAnalyzingImage(true);

            flow.step('image:selected', {
                uriScheme: resolvedUri.split(':')[0],
                assetMimeType: assetMimeType || null,
                resolvedMimeType,
                assetFileName: assetFileName || null,
                base64Source,
                base64Prefix,
                base64Length: resolvedBase64.length,
            });

            if (voiceStatus === 'disconnected') {
                stopLatencyMask();
                playLatencyMask(persona, 'hook');
            } else {
                flow.step('hook:skipped', { voiceStatus });
            }

            flow.step('vision:begin', { bytes: resolvedBase64.length, mimeType: resolvedMimeType });
            const visionResult = await analyzeImageWithVision(resolvedBase64, {
                mimeType: resolvedMimeType,
                requestId: flow.requestId,
                source: 'upload',
            });
            setImageAnalysis(visionResult.analysis);
            const imageUrl = typeof (visionResult as any)?.imageUrl === 'string' ? String((visionResult as any).imageUrl) : null;
            setSelectedImageUrl(imageUrl);
            flow.step('vision:done', {
                analysisLength: visionResult.analysis.length,
                hasImageUrl: Boolean(imageUrl),
                imageUrl: redactUrlForLogs(imageUrl),
                imageUrlHasAltMedia: Boolean(imageUrl && imageUrl.includes('alt=media')),
                imageUrlHasToken: Boolean(imageUrl && imageUrl.includes('token=')),
                imageUrlBucket: extractFirebaseBucketNameFromUrl(imageUrl),
                storagePath: typeof (visionResult as any)?.meta?.storagePath === 'string' ? String((visionResult as any).meta.storagePath) : null,
                vertexModelId: typeof (visionResult as any)?.meta?.vertex?.modelId === 'string' ? String((visionResult as any).meta.vertex.modelId) : null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setImageAnalysisError(message);
            flow.warn('error', { message });
        } finally {
            setIsAnalyzingImage(false);
            flow.end();
        }
    }, [analyzeImageWithVision, canInteract, isConnected, persona, playLatencyMask, stopLatencyMask, voiceStatus]);

    const handleSelectSeasonalMood = useCallback(async (special: (typeof SEASONAL_SPECIALS)[number]) => {
        if (!persona) return;
        if (!isConnected) {
            Alert.alert('Offline', 'Please check your internet connection to analyze an image.');
            return;
        }
        if (!canSelectMoodImage) return;

        moodImageWasChangedByUserRef.current = true;
        const flow = createFlowLogger('Seasonal Mood', { meta: { personaId: persona.id, specialId: special.id } });
        try {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedImageUri(special.image);
            setSelectedImageUrl(special.image);
            setImageAnalysis(null);
            setImageAnalysisError(null);
            setIsAnalyzingImage(true);

            if (voiceStatus === 'disconnected') {
                stopLatencyMask();
                playLatencyMask(persona, 'hook');
            } else {
                flow.step('hook:skipped', { voiceStatus });
            }

            flow.step('download:begin');
            const base64 = await loadRemoteImageBase64(special.image);
            flow.step('vision:begin', { bytes: base64.length });
            const visionResult = await analyzeImageWithVision(base64, { mimeType: 'image/jpeg', requestId: flow.requestId, source: 'seasonal' });
            setImageAnalysis(visionResult.analysis);
            const imageUrl = typeof (visionResult as any)?.imageUrl === 'string' ? String((visionResult as any).imageUrl) : null;
            setSelectedImageUrl(imageUrl || special.image);
            flow.step('vision:done', {
                analysisLength: visionResult.analysis.length,
                hasImageUrl: Boolean(imageUrl),
                imageUrl: redactUrlForLogs(imageUrl),
                imageUrlHasAltMedia: Boolean(imageUrl && imageUrl.includes('alt=media')),
                imageUrlHasToken: Boolean(imageUrl && imageUrl.includes('token=')),
                imageUrlBucket: extractFirebaseBucketNameFromUrl(imageUrl),
                storagePath: typeof (visionResult as any)?.meta?.storagePath === 'string' ? String((visionResult as any).meta.storagePath) : null,
                vertexModelId: typeof (visionResult as any)?.meta?.vertex?.modelId === 'string' ? String((visionResult as any).meta.vertex.modelId) : null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setImageAnalysisError(message);
            flow.warn('error', { message });
        } finally {
            setIsAnalyzingImage(false);
            flow.end();
        }
    }, [analyzeImageWithVision, canSelectMoodImage, isConnected, loadRemoteImageBase64, persona, playLatencyMask, stopLatencyMask, voiceStatus]);

    return {
        selectedImageUri,
        selectedImageUrl,
        isSeasonalMoodSelected,
        canSelectMoodImage,
        imageAnalysis,
        isAnalyzingImage,
        imageAnalysisError,
        handlePickImage,
        handleSelectSeasonalMood,
        clearImage,
    };
}
