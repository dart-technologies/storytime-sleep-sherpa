export type AbortSignalHandle = {
    signal: AbortSignal;
    cancel: () => void;
};

export type AiRequestStateSetters = {
    setLoading: (value: boolean) => void;
    setError: (value: string | null) => void;
};

export async function getResponseDetail(response: Response): Promise<string> {
    if (typeof (response as any).text !== 'function') return '';

    const bodyText = await response.text().catch(() => '');
    const trimmed = bodyText.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('<')) {
        const contentType =
            typeof (response as any).headers?.get === 'function'
                ? ((response as any).headers.get('content-type') || '')
                : '';
        const prefix = trimmed.slice(0, 80).replace(/\s+/g, ' ');
        const details = [contentType ? `content-type: ${contentType}` : null, `body: ${prefix}…`]
            .filter(Boolean)
            .join(', ');
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

export function createAbortSignal(timeoutMs: number): AbortSignalHandle {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        cancel: () => clearTimeout(timeoutId),
    };
}

