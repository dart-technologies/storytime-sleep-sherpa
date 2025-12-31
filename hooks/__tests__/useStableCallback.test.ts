import { act, renderHook } from '@testing-library/react-native';
import { useStableCallback } from '../useStableCallback';

describe('hooks/useStableCallback', () => {
    it('keeps a stable identity and calls the latest callback', () => {
        const calls: string[] = [];

        const { result, rerender } = renderHook(
            ({ callback }: { callback: (value: string) => void }) => useStableCallback(callback),
            {
                initialProps: {
                    callback: (value: string) => calls.push(`a:${value}`),
                },
            }
        );

        const stable = result.current;

        act(() => {
            stable('one');
        });

        expect(calls).toEqual(['a:one']);

        rerender({
            callback: (value: string) => calls.push(`b:${value}`),
        });

        expect(result.current).toBe(stable);

        act(() => {
            stable('two');
        });

        expect(calls).toEqual(['a:one', 'b:two']);
    });
});
