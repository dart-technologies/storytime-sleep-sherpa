export function redactUrlForLogs(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    try {
        const url = new URL(trimmed);
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return trimmed.split('?')[0].split('#')[0];
    }
}

export function extractFirebaseBucketNameFromUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(/\/v0\/b\/([^/]+)\/o\//i);
    if (!match) return undefined;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

