import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';
import { useAudioSettings } from './AudioProvider';

interface AtmosphereViewProps {
    type?: 'luna' | 'kai' | 'river';
}

export const AtmosphereView = React.memo(function AtmosphereView({ type = 'luna' }: AtmosphereViewProps) {
    const { isLowEnergyMode } = useAudioSettings();
    const pulse = useSharedValue(0);

    useEffect(() => {
        if (isLowEnergyMode) {
            pulse.value = 0;
            return;
        }

        pulse.value = withRepeat(
            withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, [pulse, isLowEnergyMode]);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            pulse.value,
            [0, 1],
            type === 'luna'
                ? [Theme.colors.background, Theme.colors.atmosphereLuna]
                : type === 'kai'
                    ? [Theme.colors.background, Theme.colors.atmosphereKai]
                    : [Theme.colors.background, Theme.colors.atmosphereRiver]
        );

        return {
            backgroundColor,
        };
    });

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.blurOverlay} />
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
    blurOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Theme.colors.atmosphereOverlay,
    },
});
