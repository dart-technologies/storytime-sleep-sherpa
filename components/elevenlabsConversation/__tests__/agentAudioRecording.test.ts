import { base64ToBytes, createWavHeader, parseAgentPcmSampleRate } from '../agentAudioRecording';

function ascii(bytes: Uint8Array, start: number, length: number): string {
    return String.fromCharCode(...Array.from(bytes.slice(start, start + length)));
}

describe('components/elevenlabsConversation/agentAudioRecording', () => {
    const originalAtob = (globalThis as any).atob;

    beforeEach(() => {
        (globalThis as any).atob = undefined;
    });

    afterAll(() => {
        (globalThis as any).atob = originalAtob;
    });

    it('decodes base64 to bytes', () => {
        expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
    });

    it('parses PCM sample rate from ElevenLabs formats', () => {
        expect(parseAgentPcmSampleRate('pcm_24000')).toBe(24000);
        expect(parseAgentPcmSampleRate('PCM_8000')).toBe(8000);
        expect(parseAgentPcmSampleRate('ulaw_8000')).toBeNull();
        expect(parseAgentPcmSampleRate(null)).toBeNull();
    });

    it('creates a standard PCM WAV header', () => {
        const header = createWavHeader({ dataSize: 4, sampleRate: 8000 });
        expect(header).toHaveLength(44);
        expect(ascii(header, 0, 4)).toBe('RIFF');
        expect(ascii(header, 8, 4)).toBe('WAVE');
        expect(ascii(header, 12, 4)).toBe('fmt ');
        expect(ascii(header, 36, 4)).toBe('data');

        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        expect(view.getUint32(4, true)).toBe(40);
        expect(view.getUint32(24, true)).toBe(8000);
        expect(view.getUint32(40, true)).toBe(4);
        expect(view.getUint16(34, true)).toBe(16);
        expect(view.getUint16(22, true)).toBe(1);
    });
});

