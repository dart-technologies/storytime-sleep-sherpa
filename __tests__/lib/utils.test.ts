
import { extractFirebaseBucketNameFromUrl, redactUrlForLogs } from '../../lib/urlUtils';

describe('lib/urlUtils', () => {
    describe('redactUrlForLogs', () => {
        it('returns undefined for non-string inputs', () => {
            expect(redactUrlForLogs(null)).toBeUndefined();
            expect(redactUrlForLogs(123)).toBeUndefined();
            expect(redactUrlForLogs({})).toBeUndefined();
        });

        it('returns undefined for empty strings', () => {
            expect(redactUrlForLogs('')).toBeUndefined();
            expect(redactUrlForLogs('   ')).toBeUndefined();
        });

        it('strips query parameters from valid URLs', () => {
            expect(redactUrlForLogs('https://example.com/api?token=secret')).toBe('https://example.com/api');
            expect(redactUrlForLogs('https://example.com/path/to/resource?foo=bar&baz=qux')).toBe('https://example.com/path/to/resource');
        });

        it('strips hash fragments from valid URLs', () => {
            expect(redactUrlForLogs('https://example.com/api#section')).toBe('https://example.com/api');
        });

        it('handles URLs without query params gracefully', () => {
            expect(redactUrlForLogs('https://example.com/api')).toBe('https://example.com/api');
        });

        it('falls back to string splitting for invalid URLs', () => {
            // This mimics specific behavior in the try/catch block of the implementation
            expect(redactUrlForLogs('not-a-valid-url?secret=123')).toBe('not-a-valid-url');
        });
    });

    describe('extractFirebaseBucketNameFromUrl', () => {
        it('returns undefined for non-string inputs', () => {
            expect(extractFirebaseBucketNameFromUrl(null)).toBeUndefined();
        });

        it('returns undefined for empty strings', () => {
            expect(extractFirebaseBucketNameFromUrl('   ')).toBeUndefined();
        });

        it('extracts bucket name from standard Firebase Storage URL', () => {
            const url = 'https://firebasestorage.googleapis.com/v0/b/my-project.appspot.com/o/folder%2Fimage.jpg';
            expect(extractFirebaseBucketNameFromUrl(url)).toBe('my-project.appspot.com');
        });

        it('handles encoded bucket names', () => {
            const url = 'https://firebasestorage.googleapis.com/v0/b/my%2Dproject.appspot.com/o/file.png';
            expect(extractFirebaseBucketNameFromUrl(url)).toBe('my-project.appspot.com');
        });

        it('returns undefined if format does not match', () => {
            expect(extractFirebaseBucketNameFromUrl('https://example.com/foo.jpg')).toBeUndefined();
        });

        it('handles raw input gracefully in catch block', () => {
            // e.g. if decodeURIComponent somehow failed, though hard to trigger with valid regex match
            // We can at least ensure it handles the match if decoding isn't needed
            const url = 'https://firebasestorage.googleapis.com/v0/b/simple-bucket/o/foo';
            expect(extractFirebaseBucketNameFromUrl(url)).toBe('simple-bucket');
        });
    });
});
