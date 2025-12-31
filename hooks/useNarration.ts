import { useState } from 'react';
import { getNarrateCloudEndpointFromEnv, resolveCloudFunctionUrlFromEnv } from '../lib/cloudFunctions';
import { createFlowLogger, createRequestId } from '../lib/debugLogger';
import { getFirebaseIdToken } from '../lib/firebase';

async function getResponseDetail(response: Response): Promise<string> {
    if (typeof (response as any).text !== 'function') return '';

    const bodyText = await response.text().catch(() => '');
    const trimmed = bodyText.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('<')) {
        const contentType =
            typeof (response as any).headers?.get === 'function' ? ((response as any).headers.get('content-type') || '') : '';
        const prefix = trimmed.slice(0, 80).replace(/\s+/g, ' ');
        const details = [contentType ? `content-type: ${contentType}` : null, `body: ${prefix}…`].filter(Boolean).join(', ');
        return `Received HTML (unexpected). This usually means the app is calling the wrong URL or an upstream auth/proxy page (${details}).`;
    }

    try {
        const data = JSON.parse(trimmed);
        const message = data?.detail?.message || data?.error || data?.message;
        if (typeof message === 'string' && message.trim()) return message.trim();
    } catch {
        // not JSON
    }

    return trimmed.slice(0, 200);
}

function createAbortSignal(timeoutMs: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        cancel: () => clearTimeout(timeoutId),
    };
}

export function useNarration() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const narrateStory = async (params: {
        text: string;
        voiceId: string;
        personaId?: string;
        requestId?: string;
        idToken?: string;
    }): Promise<{ audioUrl: string; requestId?: string }> => {
        setLoading(true);
        setError(null);

        const requestId = params.requestId || createRequestId('narrate');
        const flow = createFlowLogger('Cloud Narrate', {
            requestId,
            meta: {
                personaId: params.personaId || null,
                voiceId: params.voiceId,
                textLength: typeof params.text === 'string' ? params.text.length : 0,
                hasSuppliedToken: Boolean(params.idToken),
            },
        });

        let abort: ReturnType<typeof createAbortSignal> | null = null;
        try {
            const { idToken: suppliedToken, ...bodyParams } = params;
            const endpoint = getNarrateCloudEndpointFromEnv();
            const url = resolveCloudFunctionUrlFromEnv(endpoint, 'EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE');
            flow.step('resolveUrl', { url });

            let idToken = typeof suppliedToken === 'string' ? suppliedToken.trim() : '';
            if (idToken) {
                flow.step('getFirebaseIdToken:provided', { tokenLength: idToken.length });
            } else {
                flow.step('getFirebaseIdToken:begin');
                idToken = await getFirebaseIdToken();
                flow.step('getFirebaseIdToken:done', { tokenLength: idToken.length });
            }

            abort = createAbortSignal(240_000);
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
                    throw new Error(`Failed to narrate story: ${suffix} (url: ${url})`);
                }
                throw new Error(
                    detail
                        ? `Failed to narrate story: ${detail} (url: ${url})`
                        : `Failed to narrate story (url: ${url})`
                );
            }

            const data = await response.json();
            flow.step('response:json', {
                hasAudioUrl: Boolean(data?.audioUrl),
                bytes: typeof data?.meta?.bytes === 'number' ? data.meta.bytes : undefined,
            });

            if (typeof data?.audioUrl !== 'string' || !data.audioUrl.trim()) {
                throw new Error('Narration succeeded but no audioUrl returned');
            }

            return { audioUrl: data.audioUrl, requestId: data?.requestId };
        } catch (err: any) {
            setError(err.message);
            flow.error('error', err instanceof Error ? { message: err.message, name: err.name } : String(err));
            throw err;
        } finally {
            abort?.cancel();
            setLoading(false);
            flow.end();
        }
    };

    return { narrateStory, loading, error };
}
