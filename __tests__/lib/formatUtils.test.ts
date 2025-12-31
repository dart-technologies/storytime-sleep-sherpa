
import { formatBytes, formatCountLabel, formatCreatorAttribution, formatDateLabel, formatDurationLabel } from '../../lib/formatUtils';

describe('lib/formatUtils', () => {
    describe('formatDurationLabel', () => {
        it('returns null for invalid inputs', () => {
            expect(formatDurationLabel(-1)).toBeNull();
            expect(formatDurationLabel(0)).toBeNull();

            expect(formatDurationLabel(NaN)).toBeNull();
            // @ts-expect-error Testing runtime check
            expect(formatDurationLabel('123')).toBeNull();
            expect(formatDurationLabel(undefined)).toBeNull();
        });

        it('formats seconds correctly (< 60s)', () => {
            expect(formatDurationLabel(30)).toBe('30s');
            expect(formatDurationLabel(59)).toBe('59s');
            expect(formatDurationLabel(0.5)).toBe('1s'); // Rounds to 1
            expect(formatDurationLabel(0.6)).toBe('1s');
        });

        it('formats exact minutes', () => {
            expect(formatDurationLabel(60)).toBe('1m');
            expect(formatDurationLabel(120)).toBe('2m');
        });

        it('formats minutes and seconds', () => {
            expect(formatDurationLabel(65)).toBe('1m 5s');
            expect(formatDurationLabel(90)).toBe('1m 30s');
            expect(formatDurationLabel(3605)).toBe('1h');
        });
    });

    describe('formatCountLabel', () => {
        it('returns 0 for invalid values', () => {
            expect(formatCountLabel(undefined)).toBe('0');
            expect(formatCountLabel(NaN)).toBe('0');
            expect(formatCountLabel(Infinity)).toBe('0');
            expect(formatCountLabel(-10)).toBe('0');
        });

        it('floors and formats small values', () => {
            expect(formatCountLabel(1)).toBe('1');
            expect(formatCountLabel(12.9)).toBe('12');
            expect(formatCountLabel(999)).toBe('999');
        });

        it('formats large values with Intl when available', () => {
            const label = formatCountLabel(1500);
            expect(label).not.toBe('0');
            expect(label).toEqual(expect.any(String));
        });

        it('falls back when Intl formatting fails', () => {
            const originalNumberFormat = Intl.NumberFormat;
            const originalToLocaleString = Number.prototype.toLocaleString;

            try {
                (Intl as any).NumberFormat = () => {
                    throw new Error('Intl unavailable');
                };
                (Number.prototype as any).toLocaleString = jest.fn(() => '1500');
                expect(formatCountLabel(1500)).toBe('1500');
            } finally {
                (Intl as any).NumberFormat = originalNumberFormat;
                (Number.prototype as any).toLocaleString = originalToLocaleString;
            }
        });
    });

    describe('formatDateLabel', () => {
        it('returns null for invalid inputs', () => {
            expect(formatDateLabel(undefined)).toBeNull();
            expect(formatDateLabel(NaN)).toBeNull();
            // @ts-expect-error Testing runtime check
            expect(formatDateLabel('123')).toBeNull();
        });

        it('formats valid timestamps', () => {
            const label = formatDateLabel(Date.now());
            expect(label).toEqual(expect.any(String));
            expect(label?.length).toBeGreaterThan(0);
        });
    });

    describe('formatCreatorAttribution', () => {
        it('returns null for empty display names', () => {
            expect(formatCreatorAttribution('')).toBeNull();
            expect(formatCreatorAttribution('   ')).toBeNull();
            expect(formatCreatorAttribution(null)).toBeNull();
        });

        it('formats first name plus last initial', () => {
            expect(formatCreatorAttribution('Michael Chen')).toBe('Michael C');
            expect(formatCreatorAttribution('Michael C')).toBe('Michael C');
            expect(formatCreatorAttribution('Madonna')).toBe('Madonna');
            expect(formatCreatorAttribution('Anne-Marie O\'Connor')).toBe('Anne-Marie O');
        });
    });

    describe('formatBytes', () => {
        it('formats bytes into human readable labels', () => {
            expect(formatBytes(undefined)).toBe('0 B');
            expect(formatBytes(12)).toBe('12 B');
            expect(formatBytes(1024)).toBe('1.0 KB');
            expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
        });
    });
});
