import { useCallback } from 'react';
import { getGeminiCloudEndpointsFromEnv, resolveCloudFunctionUrlFromEnv } from '../../lib/cloudFunctions';
import { createFlowLogger, createRequestId } from '../../lib/debugLogger';
import { getFirebaseIdToken } from '../../lib/firebase';
import { extractFirebaseBucketNameFromUrl, redactUrlForLogs } from '../../lib/urlUtils';
import { AiRequestStateSetters, createAbortSignal, getResponseDetail } from './requestUtils';
import { CrashlyticsService } from '../../services/crashlytics';

function resolveVertexVisionModelOverride(): string | undefined {
    const override = String(process.env.EXPO_PUBLIC_VERTEX_VISION_MODEL_OVERRIDE || '').trim();
    if (override) return override;
    return undefined;
}

export type VisionAnalysisOptions = {
    mimeType?: string;
    requestId?: string;
    source?: string;
    idToken?: string;
};

export type VisionAnalysisResult = {
    analysis: string;
    imageUrl?: string;
};

export function useVisionAnalysis({ setLoading, setError }: AiRequestStateSetters) {
    const analyzeImageWithVision = useCallback(async (
        imageBase64: string,
        options?: VisionAnalysisOptions
    ): Promise<VisionAnalysisResult> => {
        const vertexVisionModel = resolveVertexVisionModelOverride();
        setLoading(true);
        setError(null);
        const requestId = options?.requestId || createRequestId('vision');
        const flow = createFlowLogger('Cloud Vision', {
            requestId,
            meta: {
                imageBytes: typeof imageBase64 === 'string' ? imageBase64.length : 0,
                mimeType: typeof options?.mimeType === 'string' ? options.mimeType : null,
                source: typeof options?.source === 'string' ? options.source : null,
                hasSuppliedToken: Boolean(options?.idToken),
                vertexVisionModel: vertexVisionModel || null,
            },
        });
        let abort: ReturnType<typeof createAbortSignal> | null = null;
        try {
            const { vision } = getGeminiCloudEndpointsFromEnv();
            const url = resolveCloudFunctionUrlFromEnv(vision, 'EXPO_PUBLIC_CLOUD_FUNCTION_VISION');
            flow.step('resolveUrl', { url });
            let idToken = typeof options?.idToken === 'string' ? options.idToken.trim() : '';
            if (idToken) {
                flow.step('getFirebaseIdToken:provided', { tokenLength: idToken.length });
            } else {
                flow.step('getFirebaseIdToken:begin');
                idToken = await getFirebaseIdToken();
                flow.step('getFirebaseIdToken:done', { tokenLength: idToken.length });
            }
            abort = createAbortSignal(120_000);
            flow.step('fetch:begin', { method: 'POST' });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                    'X-Storytime-Request-Id': requestId,
                },
                body: JSON.stringify({
                    imageBase64,
                    mimeType: options?.mimeType,
                    source: options?.source,
                    ...(vertexVisionModel ? { vertexVisionModel } : {}),
                }),
                signal: abort.signal,
            });
            flow.step('fetch:response', { ok: response.ok, status: response.status });

            if (!response.ok) {
                const detail = await getResponseDetail(response);
                if (response.status === 401) {
                    const suffix = detail ? `Unauthorized: ${detail}` : 'Unauthorized (sign in again).';
                    throw new Error(`Failed to analyze image: ${suffix} (url: ${url})`);
                }
                throw new Error(
                    detail
                        ? `Failed to analyze image: ${detail} (url: ${url})`
                        : `Failed to analyze image (url: ${url})`
                );
            }

            const data = await response.json();
            const meta = (data as any)?.meta;
            const vertex = meta?.vertex;
            flow.step('response:json', {
                analysisLength: typeof (data as any)?.analysis === 'string' ? (data as any).analysis.length : undefined,
                hasImageUrl: Boolean((data as any)?.imageUrl),
                imageUrl: redactUrlForLogs((data as any)?.imageUrl),
                imageUrlHasToken: typeof (data as any)?.imageUrl === 'string' ? (data as any).imageUrl.includes('token=') : undefined,
                imageUrlBucket: extractFirebaseBucketNameFromUrl((data as any)?.imageUrl),
                bytes: typeof meta?.bytes === 'number' ? meta.bytes : undefined,
                storagePath: typeof meta?.storagePath === 'string' ? meta.storagePath : undefined,
                vertexModelId: typeof vertex?.modelId === 'string' ? vertex.modelId : undefined,
                vertexLocation: typeof vertex?.location === 'string' ? vertex.location : undefined,
                vertexUsedFallback: typeof vertex?.usedFallback === 'boolean' ? vertex.usedFallback : undefined,
            });
            return data as VisionAnalysisResult;
        } catch (err: any) {
            setError(err.message);
            CrashlyticsService.logError(err, `Cloud Vision: ${requestId}`);
            flow.error('error', err instanceof Error ? { message: err.message, name: err.name } : String(err));
            throw err;
        } finally {
            abort?.cancel();
            setLoading(false);
            flow.end();
        }
    }, [setError, setLoading]);

    return { analyzeImageWithVision };
}
