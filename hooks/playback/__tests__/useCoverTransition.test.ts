import { act, renderHook } from '@testing-library/react-native';
import { useCoverTransition } from '../useCoverTransition';

jest.mock('react-native-reanimated', () => ({
    Easing: {
        cubic: () => 0,
        out: (fn: any) => fn,
    },
    runOnJS: (fn: any) => fn,
    useSharedValue: (initial: any) => ({ value: initial }),
    useAnimatedStyle: (factory: any) => factory(),
    withDelay: (_delay: number, value: any) => value,
    withTiming: (toValue: any, _config: any, callback?: (finished: boolean) => void) => {
        callback?.(true);
        return toValue;
    },
}));

describe('hooks/playback/useCoverTransition', () => {
    it('no-ops when artwork ref is missing measureInWindow', () => {
        const { result } = renderHook(() => useCoverTransition({
            transitionFromRect: { x: 1, y: 2, width: 3, height: 4 },
            transitionCoverSource: { uri: 'cover' },
        }));

        act(() => {
            result.current.artworkRef.current = {};
            result.current.handleArtworkLayout();
        });

        expect(result.current.isCoverTransitionActive).toBe(false);
    });

    it('runs the transition once when both rects are available', () => {
        const { result } = renderHook(() => useCoverTransition({
            transitionFromRect: { x: 1, y: 2, width: 3, height: 4 },
            transitionCoverSource: { uri: 'cover' },
        }));

        act(() => {
            result.current.artworkRef.current = {
                measureInWindow: (cb: any) => cb(10, 20, 100, 200),
            };
            result.current.handleArtworkLayout();
        });

        expect(result.current.isCoverTransitionActive).toBe(false);

        act(() => {
            result.current.handleArtworkLayout();
        });

        expect(result.current.isCoverTransitionActive).toBe(false);
    });

    it('does not start when transitionFromRect is missing', () => {
        const { result } = renderHook(() => useCoverTransition({
            transitionFromRect: null,
            transitionCoverSource: { uri: 'cover' },
        }));

        act(() => {
            result.current.artworkRef.current = {
                measureInWindow: (cb: any) => cb(10, 20, 100, 200),
            };
            result.current.handleArtworkLayout();
        });

        expect(result.current.isCoverTransitionActive).toBe(false);
    });
});

