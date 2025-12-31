import {
    omitUndefined,
    sanitizeFirestoreValue,
    sanitizeForTinyBaseRow,
    normalizeStoryGeneration,
} from '../storyRowUtils';

describe('hooks/stories/storyRowUtils', () => {
    it('omitUndefined removes undefined keys', () => {
        const result = omitUndefined({ a: 1, b: undefined, c: null } as any);
        expect(result).toEqual({ a: 1, c: null });
    });

    it('sanitizeFirestoreValue drops undefined and non-finite numbers', () => {
        expect(sanitizeFirestoreValue(undefined)).toBeUndefined();
        expect(sanitizeFirestoreValue(null)).toBeNull();
        expect(sanitizeFirestoreValue('ok')).toBe('ok');
        expect(sanitizeFirestoreValue(true)).toBe(true);
        expect(sanitizeFirestoreValue(3)).toBe(3);
        expect(sanitizeFirestoreValue(Number.NaN)).toBeUndefined();
        expect(sanitizeFirestoreValue(Number.POSITIVE_INFINITY)).toBeUndefined();
    });

    it('sanitizeFirestoreValue recursively sanitizes arrays and objects', () => {
        const value = {
            ok: 'yes',
            nope: undefined,
            arr: [1, undefined, null, { x: 'y', z: undefined }],
        };

        expect(sanitizeFirestoreValue(value)).toEqual({
            ok: 'yes',
            arr: [1, null, { x: 'y' }],
        });
    });

    it('sanitizeForTinyBaseRow stringifies non-primitives and ignores non-serializable', () => {
        const circular: any = {};
        circular.self = circular;

        const row = sanitizeForTinyBaseRow({
            title: 'T',
            count: 2,
            enabled: false,
            nullable: null,
            undef: undefined,
            obj: { a: 1 },
            circular,
        });

        expect(row).toEqual(expect.objectContaining({
            title: 'T',
            count: 2,
            enabled: false,
            obj: JSON.stringify({ a: 1 }),
        }));
        expect(row).not.toHaveProperty('nullable');
        expect(row).not.toHaveProperty('undef');
        expect(row).not.toHaveProperty('circular');
    });

    it('normalizeStoryGeneration accepts objects or JSON strings', () => {
        expect(normalizeStoryGeneration(undefined)).toBeUndefined();
        expect(normalizeStoryGeneration('')).toBeUndefined();

        const obj = { version: 1, source: 'create', durationSec: 300, convoHistory: [] };
        expect(normalizeStoryGeneration(obj)).toBe(obj);

        const parsed = normalizeStoryGeneration(JSON.stringify(obj));
        expect(parsed).toEqual(obj);

        expect(normalizeStoryGeneration('{nope')).toBeUndefined();
    });
});

