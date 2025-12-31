import { useCallback, useEffect, useRef, useState } from 'react';
import { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';

export type Rect = { x: number; y: number; width: number; height: number };

export function useCoverTransition({
    transitionFromRect,
    transitionCoverSource,
}: {
    transitionFromRect: Rect | null;
    transitionCoverSource: any;
}) {
    const artworkRef = useRef<any>(null);
    const [artworkRect, setArtworkRect] = useState<Rect | null>(null);
    const [isCoverTransitionActive, setIsCoverTransitionActive] = useState(false);
    const coverTransitionStartedRef = useRef(false);

    const overlayLeft = useSharedValue(0);
    const overlayTop = useSharedValue(0);
    const overlayWidth = useSharedValue(0);
    const overlayHeight = useSharedValue(0);
    const overlayOpacity = useSharedValue(0);

    const overlayStyle = useAnimatedStyle(() => ({
        left: overlayLeft.value,
        top: overlayTop.value,
        width: overlayWidth.value,
        height: overlayHeight.value,
        opacity: overlayOpacity.value,
    }), []);

    const handleArtworkLayout = useCallback(() => {
        if (!artworkRef.current) return;
        if (typeof artworkRef.current.measureInWindow !== 'function') return;
        artworkRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
            setArtworkRect({ x, y, width, height });
        });
    }, []);

    useEffect(() => {
        if (coverTransitionStartedRef.current) return;
        if (!transitionFromRect) return;
        if (!artworkRect) return;
        if (!transitionCoverSource) return;

        coverTransitionStartedRef.current = true;
        setIsCoverTransitionActive(true);

        overlayLeft.value = transitionFromRect.x;
        overlayTop.value = transitionFromRect.y;
        overlayWidth.value = transitionFromRect.width;
        overlayHeight.value = transitionFromRect.height;
        overlayOpacity.value = 1;

        const config = { duration: Theme.motion.duration.coverMove, easing: Easing.out(Easing.cubic) };
        overlayLeft.value = withTiming(artworkRect.x, config);
        overlayTop.value = withTiming(artworkRect.y, config);
        overlayWidth.value = withTiming(artworkRect.width, config);
        overlayHeight.value = withTiming(artworkRect.height, config);
        overlayOpacity.value = withDelay(Theme.motion.delay.coverFadeOut, withTiming(0, { duration: Theme.motion.duration.coverFade }, (finished) => {
            if (!finished) return;
            runOnJS(setIsCoverTransitionActive)(false);
        }));
    }, [
        artworkRect,
        overlayHeight,
        overlayLeft,
        overlayOpacity,
        overlayTop,
        overlayWidth,
        transitionCoverSource,
        transitionFromRect,
    ]);

    return {
        artworkRef,
        handleArtworkLayout,
        isCoverTransitionActive,
        overlayStyle,
    };
}

