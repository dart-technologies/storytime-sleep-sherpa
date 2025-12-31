import { enhanceNarrationText, finalizeForProvider } from '../ssmlUtils';

describe('lib/ssmlUtils', () => {
    it('enhanceNarrationText injects pauses and breaths by default', () => {
        const result = enhanceNarrationText('Hello there. How are you?');
        expect(result).toContain('[LONG_PAUSE]');
        expect(result).toContain('[BREATH]');
    });

    it('enhanceNarrationText respects options', () => {
        const result = enhanceNarrationText('Hello there.', { pacing: 'dreamy', injectBreaths: false, whisperMode: true });
        expect(result).toContain('[WHISPER]');
        expect(result).toContain('[PAUSE]');
        expect(result).not.toContain('[BREATH]');
    });

    it('finalizeForProvider converts placeholders for ElevenLabs', () => {
        const input = '[WHISPER] Hi. [PAUSE] [LONG_PAUSE] [BREATH] [/WHISPER]';
        const output = finalizeForProvider(input, 'elevenlabs');
        expect(output).toContain('... ...');
        expect(output).toContain('(soft breath)');
        expect(output).not.toContain('[WHISPER]');
    });

    it('finalizeForProvider strips placeholders for Gemini', () => {
        const input = 'Hi [PAUSE] there [BREATH]';
        const output = finalizeForProvider(input, 'gemini');
        expect(output).toBe('Hi  there');
    });
});

