import { useCallback } from 'react';
import { getGeminiCloudEndpointsFromEnv, resolveCloudFunctionUrlFromEnv } from '../../lib/cloudFunctions';
import { createFlowLogger, createRequestId } from '../../lib/debugLogger';
import { getFirebaseIdToken } from '../../lib/firebase';
import { Persona } from '../../lib/personas';
import { AiRequestStateSetters, createAbortSignal, getResponseDetail } from './requestUtils';
import { CrashlyticsService } from '../../services/crashlytics';

export type GenerateStoryIllustrationParams = {
    title: string;
    summary: string;
    persona: Persona;
    requestId?: string;
    vertexImageModel?: string;
    idToken?: string;
};

export function useIllustration({ setLoading, setError }: AiRequestStateSetters) {
    const generateStoryIllustration = useCallback(async (params: GenerateStoryIllustrationParams): Promise<string> => {
        setLoading(true);
        setError(null);
        const requestId = params.requestId || createRequestId('illustrate');
        const flow = createFlowLogger('Cloud Illustrate', {
            requestId,
            meta: {
                personaId: params.persona?.id,
                titleLength: typeof params.title === 'string' ? params.title.length : 0,
                summaryLength: typeof params.summary === 'string' ? params.summary.length : 0,
                vertexImageModel: params.vertexImageModel || null,
                hasSuppliedToken: Boolean(params.idToken),
            },
        });
        let abort: ReturnType<typeof createAbortSignal> | null = null;
        try {
            const { idToken: suppliedToken, ...bodyParams } = params;
            const { illustrate } = getGeminiCloudEndpointsFromEnv();
            const url = resolveCloudFunctionUrlFromEnv(illustrate, 'EXPO_PUBLIC_CLOUD_FUNCTION_ILLUSTRATE');
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
                body: JSON.stringify({
                    title: bodyParams.title,
                    summary: bodyParams.summary,
                    personaId: bodyParams.persona.id,
                    personaName: bodyParams.persona.name,
                    vertexImageModel: typeof bodyParams.vertexImageModel === 'string' ? bodyParams.vertexImageModel : undefined,
                }),
                signal: abort.signal,
            });
            flow.step('fetch:response', { ok: response.ok, status: response.status });

            if (!response.ok) {
                const detail = await getResponseDetail(response);
                if (response.status === 401) {
                    const suffix = detail ? `Unauthorized: ${detail}` : 'Unauthorized (sign in again).';
                    throw new Error(`Failed to generate illustration: ${suffix} (url: ${url})`);
                }
                throw new Error(
                    detail
                        ? `Failed to generate illustration: ${detail} (url: ${url})`
                        : `Failed to generate illustration (url: ${url})`
                );
            }

            const data = await response.json();
            flow.step('response:json', { hasImageUrl: Boolean((data as any)?.imageUrl) });
            return (data as any).imageUrl as string;
        } catch (err: any) {
            setError(err.message);
            CrashlyticsService.logError(err, `Cloud Illustrate: ${requestId}`);
            flow.error('error', err instanceof Error ? { message: err.message, name: err.name } : String(err));
            throw err;
        } finally {
            abort?.cancel();
            setLoading(false);
            flow.end();
        }
    }, [setError, setLoading]);

    return { generateStoryIllustration };
}

