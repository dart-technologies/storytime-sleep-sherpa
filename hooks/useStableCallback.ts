import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
    const callbackRef = useRef(callback);

    useIsomorphicLayoutEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, []);
}
