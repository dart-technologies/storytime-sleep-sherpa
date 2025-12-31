const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

let base64Lookup: Uint8Array | null = null;

function getBase64Lookup(): Uint8Array {
    if (base64Lookup) return base64Lookup;
    const lookup = new Uint8Array(256);
    lookup.fill(255);
    for (let i = 0; i < BASE64_ALPHABET.length; i++) {
        lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
    }
    lookup['='.charCodeAt(0)] = 0;
    base64Lookup = lookup;
    return lookup;
}

export function base64ToBytes(base64: string): Uint8Array {
    const trimmed = String(base64 || '').trim();
    if (!trimmed) return new Uint8Array(0);

    const atobFn = (globalThis as any).atob as ((input: string) => string) | undefined;
    if (typeof atobFn === 'function') {
        const binary = atobFn(trimmed);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i) & 0xff;
        }
        return bytes;
    }

    const clean = trimmed.replace(/\s+/g, '');
    const len = clean.length;
    if (len % 4 !== 0) {
        throw new Error('Invalid base64 length');
    }

    const lookup = getBase64Lookup();

    let padding = 0;
    if (len >= 2 && clean[len - 1] === '=') padding++;
    if (len >= 2 && clean[len - 2] === '=') padding++;

    const outLen = (len * 3) / 4 - padding;
    const out = new Uint8Array(outLen);

    let outIndex = 0;
    for (let i = 0; i < len; i += 4) {
        const c0 = lookup[clean.charCodeAt(i)];
        const c1 = lookup[clean.charCodeAt(i + 1)];
        const c2 = lookup[clean.charCodeAt(i + 2)];
        const c3 = lookup[clean.charCodeAt(i + 3)];
        if (c0 === 255 || c1 === 255 || c2 === 255 || c3 === 255) {
            throw new Error('Invalid base64 character');
        }
        const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
        if (outIndex < outLen) out[outIndex++] = (triple >> 16) & 0xff;
        if (outIndex < outLen) out[outIndex++] = (triple >> 8) & 0xff;
        if (outIndex < outLen) out[outIndex++] = triple & 0xff;
    }

    return out;
}

export function parseAgentPcmSampleRate(format: unknown): number | null {
    if (typeof format !== 'string') return null;
    const trimmed = format.trim().toLowerCase();
    const match = trimmed.match(/^pcm_(\d{4,6})$/);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function writeAscii(view: DataView, offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i) & 0xff);
    }
}

export function createWavHeader(params: {
    dataSize: number;
    sampleRate: number;
    numChannels?: number;
    bitsPerSample?: number;
}): Uint8Array {
    const numChannels = params.numChannels ?? 1;
    const bitsPerSample = params.bitsPerSample ?? 16;

    const dataSize = Math.max(0, params.dataSize | 0);
    const sampleRate = Math.max(1, params.sampleRate | 0);

    const blockAlign = Math.max(1, (numChannels * bitsPerSample) / 8);
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    return new Uint8Array(buffer);
}

