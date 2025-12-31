import { settleWithTimeout, sleep } from '../promiseUtils';

describe('lib/promiseUtils', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('settles fulfilled promises before timeout', async () => {
        const result = await settleWithTimeout(Promise.resolve(42), 1000);
        expect(result).toEqual({ status: 'fulfilled', value: 42 });
    });

    it('settles rejected promises before timeout', async () => {
        const error = new Error('nope');
        const result = await settleWithTimeout(Promise.reject(error), 1000);
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
            expect(result.reason).toBe(error);
        }
    });

    it('times out when the promise does not settle', async () => {
        jest.useFakeTimers();
        const never = new Promise<number>(() => {});
        const pending = settleWithTimeout(never, 1000);

        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        const result = await pending;
        expect(result).toEqual({ status: 'timeout' });
    });

    it('sleep resolves after the given duration', async () => {
        jest.useFakeTimers();
        const promise = sleep(250);

        let done = false;
        promise.then(() => {
            done = true;
        });

        jest.advanceTimersByTime(249);
        await Promise.resolve();
        expect(done).toBe(false);

        jest.advanceTimersByTime(1);
        await Promise.resolve();
        expect(done).toBe(true);
    });
});

