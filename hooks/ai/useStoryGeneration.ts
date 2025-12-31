import { useCallback } from 'react';
import { getGeminiCloudEndpointsFromEnv, resolveCloudFunctionUrlFromEnv } from '../../lib/cloudFunctions';
import { createFlowLogger, createRequestId } from '../../lib/debugLogger';
import { getFirebaseIdToken } from '../../lib/firebase';
import { Persona } from '../../lib/personas';
import { AiRequestStateSetters, createAbortSignal, getResponseDetail } from './requestUtils';
import { CrashlyticsService } from '../../services/crashlytics';

export type GenerateAIBasedStoryParams = {
    persona: Persona;
    durationSec: number;
    convoHistory?: any[];
    imageContext?: string;
    requestId?: string;
    vertexTextModel?: string;
    idToken?: string;
};

export type GeneratedStoryResult = {
    title?: string;
    summary?: string;
    narrative?: string;
    meta?: unknown;
    [key: string]: unknown;
};

export function useStoryGeneration({ setLoading, setError }: AiRequestStateSetters) {
    const generateAIBasedStory = useCallback(async (params: GenerateAIBasedStoryParams): Promise<GeneratedStoryResult> => {
        setLoading(true);
        setError(null);
        const requestId = params.requestId || createRequestId('generate');
        const flow = createFlowLogger('Cloud Generate', {
            requestId,
            meta: {
                personaId: params.persona?.id,
                durationSec: params.durationSec,
                convoHistoryCount: Array.isArray(params.convoHistory) ? params.convoHistory.length : 0,
                hasImageContext: Boolean(params.imageContext),
                vertexTextModel: params.vertexTextModel || null,
                hasSuppliedToken: Boolean(params.idToken),
            },
        });
        let abort: ReturnType<typeof createAbortSignal> | null = null;
        try {
            const { idToken: suppliedToken, ...bodyParams } = params;
            const { generate } = getGeminiCloudEndpointsFromEnv();
            const url = resolveCloudFunctionUrlFromEnv(generate, 'EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE');
            flow.step('resolveUrl', { url });

            let idToken = typeof suppliedToken === 'string' ? suppliedToken.trim() : '';
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
                body: JSON.stringify(bodyParams),
                signal: abort.signal,
            });
            flow.step('fetch:response', { ok: response.ok, status: response.status });

            if (!response.ok) {
                const detail = await getResponseDetail(response);
                if (response.status === 401) {
                    const suffix = detail ? `Unauthorized: ${detail}` : 'Unauthorized (sign in again).';
                    throw new Error(`Failed to generate story: ${suffix} (url: ${url})`);
                }
                throw new Error(
                    detail
                        ? `Failed to generate story: ${detail} (url: ${url})`
                        : `Failed to generate story (url: ${url})`
                );
            }

            const data = await response.json();
            flow.step('response:json', {
                title: (data as any)?.title,
                narrativeLength: typeof (data as any)?.narrative === 'string' ? (data as any).narrative.length : undefined,
                vertex: (data as any)?.meta?.vertex,
            });
            return data as GeneratedStoryResult;
        } catch (err: any) {
            setError(err.message);
            CrashlyticsService.logError(err, `Cloud Generate: ${requestId}`);
            flow.error('error', err instanceof Error ? { message: err.message, name: err.name } : String(err));
            throw err;
        } finally {
            abort?.cancel();
            setLoading(false);
            flow.end();
        }
    }, [setError, setLoading]);

    return { generateAIBasedStory };
}

