export function normalizeOneLine(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

