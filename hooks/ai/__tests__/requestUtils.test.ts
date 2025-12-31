import { createAbortSignal, getResponseDetail } from '../requestUtils';

describe('hooks/ai/requestUtils', () => {
    describe('getResponseDetail', () => {
        it('returns empty string when response has no text()', async () => {
            await expect(getResponseDetail({} as any)).resolves.toBe('');
        });

        it('extracts a helpful message from HTML responses', async () => {
            const response = {
                text: jest.fn().mockResolvedValue('<html>forbidden</html>'),
                headers: { get: jest.fn().mockReturnValue('text/html') },
            } as any;

            const detail = await getResponseDetail(response);
            expect(detail).toContain('Received HTML');
            expect(detail).toContain('content-type: text/html');
            expect(detail).toContain('body: <html>forbidden</html>');
        });

        it('extracts a message from JSON error payloads', async () => {
            const response = {
                text: jest.fn().mockResolvedValue(JSON.stringify({ detail: { message: 'Bad request' } })),
                headers: { get: jest.fn().mockReturnValue('application/json') },
            } as any;

            await expect(getResponseDetail(response)).resolves.toBe('Bad request');
        });

        it('falls back to trimmed text for non-JSON payloads', async () => {
            const response = {
                text: jest.fn().mockResolvedValue('Something went wrong'),
                headers: { get: jest.fn().mockReturnValue('text/plain') },
            } as any;

            await expect(getResponseDetail(response)).resolves.toBe('Something went wrong');
        });
    });

    describe('createAbortSignal', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('aborts after the timeout', () => {
            const handle = createAbortSignal(50);
            expect(handle.signal.aborted).toBe(false);
            jest.advanceTimersByTime(50);
            expect(handle.signal.aborted).toBe(true);
        });

        it('can cancel the timeout', () => {
            const handle = createAbortSignal(50);
            handle.cancel();
            jest.advanceTimersByTime(50);
            expect(handle.signal.aborted).toBe(false);
        });
    });
});

