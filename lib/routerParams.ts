export function getFirstParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
    return null;
}

export function getFirstParamOrUndefined(value: string | string[] | undefined): string | undefined {
    const resolved = getFirstParam(value);
    return resolved === null ? undefined : resolved;
}

export function parseFloatParam(value: string | string[] | undefined): number | null {
    const raw = getFirstParam(value);
    if (!raw) return null;
    const parsed = Number.parseFloat(raw.trim());
    return Number.isFinite(parsed) ? parsed : null;
}
