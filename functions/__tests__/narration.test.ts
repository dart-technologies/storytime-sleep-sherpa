import { sanitizeNarrationText } from '../src/utils/narration';

describe('sanitizeNarrationText', () => {
    it('normalizes newlines and strips pause markers', () => {
        const input = [
            'Line1\r\nLine2\\nLine3',
            '',
            '[PAUSE]',
            '(pause)',
            '<pause/>',
            '{pause}',
            '— pause —',
            '*pause*',
            '_pause_',
            'pause',
            'PAUSE:',
            'Please pause and rest.',
            'Applause stays.',
        ].join('\n');

        const output = sanitizeNarrationText(input);

        expect(output).toMatch(/^Line1\nLine2\nLine3/);
        expect(output).toContain('...');
        expect(output).not.toMatch(/\[(?:\s*)pause(?:\s*)\]/i);
        expect(output).not.toMatch(/\(\s*pause\s*\)/i);
        expect(output).not.toMatch(/<\s*pause/i);
        expect(output).not.toMatch(/<break/i);
        expect(output).not.toMatch(/\{\s*pause\s*\}/i);
        expect(output).not.toMatch(/\bpaus(?:e|es|ed|ing)\b/i);
        expect(output).not.toMatch(/^\s*pause/i);
        expect(output).toContain('Applause stays.');
    });

    it('collapses repeated pauses into a single ellipsis', () => {
        expect(sanitizeNarrationText('[PAUSE] [PAUSE] pause paused pausing pauses')).toBe('');
    });
});
