export function sanitizeNarrationText(text: string): string {
    const pause = '...';
    const longPause = '... ...';
    const normalizedNewlines = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n');

    return normalizedNewlines
        // Explicit pause markers from the story generator.
        .replace(/\[\s*pause\s*\]/gi, pause)

        // Common "stage direction" pause variants.
        .replace(/<\s*pause\s*\/?\s*>/gi, pause)
        .replace(/<break[^>]*>/gi, pause)
        .replace(/\{\s*pause\s*\}/gi, pause)
        .replace(/\(\s*pause\s*\)/gi, pause)
        .replace(/[-—–]\s*pause\s*[-—–]/gi, pause)
        .replace(/[*_]\s*pause\s*[*_]/gi, pause)
        .replace(/^\s*pause\s*[:.!\-–—]?\s*$/gim, pause)
        .replace(/^\s*pause\s*[:.!\-–—]\s*/gim, `${pause} `)

        // Some voices will read "pause" literally; strip it as a last resort.
        .replace(/\bpaus(?:e|es|ed|ing)\b/gi, pause)

        // Normalize ellipses.
        .replace(/\u2026/g, pause)
        .replace(/\.{3,}/g, pause)

        // Collapse consecutive pauses.
        .replace(/(?:\s*\.{3}\s*){2,}/g, `${longPause} `)
        .replace(/^(?:\s*\.{3}\s*)+/i, '')
        .replace(/(?:\s*\.{3}\s*)+$/i, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
