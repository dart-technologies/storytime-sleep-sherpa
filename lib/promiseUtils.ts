export type SettledResult<T> =
    | { status: 'fulfilled'; value: T }
    | { status: 'rejected'; reason: unknown }
    | { status: 'timeout' };

export async function settleWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<SettledResult<T>> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<SettledResult<T>>((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
    });

    const wrapped = promise
        .then((value) => ({ status: 'fulfilled', value } as const))
        .catch((reason) => ({ status: 'rejected', reason } as const));

    const result = await Promise.race([wrapped, timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
}

export function sleep(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
