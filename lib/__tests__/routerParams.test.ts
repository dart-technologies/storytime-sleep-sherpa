import { getFirstParam, getFirstParamOrUndefined, parseFloatParam } from '../routerParams';

describe('lib/routerParams', () => {
    describe('getFirstParam', () => {
        it('returns null for undefined', () => {
            expect(getFirstParam(undefined)).toBeNull();
        });

        it('returns the string when provided', () => {
            expect(getFirstParam('hello')).toBe('hello');
        });

        it('returns the first array entry when provided', () => {
            expect(getFirstParam(['a', 'b'])).toBe('a');
        });

        it('returns null for an empty array', () => {
            expect(getFirstParam([])).toBeNull();
        });
    });

    describe('getFirstParamOrUndefined', () => {
        it('returns undefined for missing values', () => {
            expect(getFirstParamOrUndefined(undefined)).toBeUndefined();
            expect(getFirstParamOrUndefined([])).toBeUndefined();
        });

        it('returns the resolved value otherwise', () => {
            expect(getFirstParamOrUndefined('x')).toBe('x');
            expect(getFirstParamOrUndefined(['y'])).toBe('y');
        });
    });

    describe('parseFloatParam', () => {
        it('parses numeric params', () => {
            expect(parseFloatParam('1.25')).toBe(1.25);
            expect(parseFloatParam(['2'])).toBe(2);
        });

        it('returns null when invalid', () => {
            expect(parseFloatParam(undefined)).toBeNull();
            expect(parseFloatParam('')).toBeNull();
            expect(parseFloatParam('nope')).toBeNull();
        });
    });
});

