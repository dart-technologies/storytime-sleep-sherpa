export function getRequestId(req: any): string {
    const fromHeader =
        (typeof req?.get === 'function' ? req.get('X-Storytime-Request-Id') : undefined) ||
        req?.headers?.['x-storytime-request-id'];
    if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();
    return `fn_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

