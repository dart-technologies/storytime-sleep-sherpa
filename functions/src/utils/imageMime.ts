export function inferImageMimeTypeFromBase64(base64Data: string): 'image/png' | 'image/jpeg' {
    const trimmed = String(base64Data || '').trim();
    if (trimmed.startsWith('iVBORw0KGgo')) return 'image/png';
    if (trimmed.startsWith('/9j/')) return 'image/jpeg';
    return 'image/jpeg';
}

export type DetectedImageMimeType = 'image/png' | 'image/jpeg' | 'image/heic' | 'image/avif' | 'application/octet-stream';

export function detectImageMimeTypeFromBytes(bytes: Buffer): DetectedImageMimeType {
    if (bytes.length >= 8) {
        const isPng =
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47 &&
            bytes[4] === 0x0d &&
            bytes[5] === 0x0a &&
            bytes[6] === 0x1a &&
            bytes[7] === 0x0a;
        if (isPng) return 'image/png';
    }

    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        return 'image/jpeg';
    }

    if (
        bytes.length >= 12 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
    ) {
        const brand = bytes.subarray(8, 12).toString('ascii');
        if (brand === 'avif' || brand === 'avis') return 'image/avif';
        if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
    }

    return 'application/octet-stream';
}

