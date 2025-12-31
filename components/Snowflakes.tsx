import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';
import { useAudioSettings } from './AudioProvider';

const { width, height } = Dimensions.get('window');

const SNOWFLAKE_COUNT = 15;
const MINIMAL_SNOWFLAKE_COUNT = 5;

const Snowflakes = React.memo(function Snowflakes() {
    const { isLowEnergyMode } = useAudioSettings();
    const count = isLowEnergyMode ? MINIMAL_SNOWFLAKE_COUNT : SNOWFLAKE_COUNT;
    const snowflakes = useMemo(() => Array.from({ length: count }), [count]);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {snowflakes.map((_, i) => (
                <Snowflake key={i} index={i} />
            ))}
        </View>
    );
});

const Snowflake = React.memo(function Snowflake({ index: _index }: { index: number }) {
    const translateY = useSharedValue(-20);
    const config = useMemo(() => {
        return {
            startX: Math.random() * width,
            opacity: 0.3 + Math.random() * 0.5,
            size: 2 + Math.random() * 4,
            fallDuration: 5000 + Math.random() * 10000,
            fallDelay: Math.random() * 5000,
            driftDistance: (Math.random() - 0.5) * 40,
            driftDuration: 2200 + Math.random() * 2800,
        };
    }, []);

    const translateX = useSharedValue(config.startX);
    const opacity = useSharedValue(config.opacity);
    const size = config.size;

    useEffect(() => {
        translateY.value = withDelay(
            config.fallDelay,
            withRepeat(
                withTiming(height + 20, {
                    duration: config.fallDuration,
                    easing: Easing.linear,
                }),
                -1,
                false
            )
        );

        // Subtle side-to-side drift
        translateX.value = withRepeat(
            withTiming(config.startX + config.driftDistance, {
                duration: config.driftDuration,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            true
        );
    }, [config, translateX, translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.snowflake,
                { width: size, height: size, borderRadius: size / 2 },
                animatedStyle
            ]}
        />
    );
});

export default Snowflakes;

const styles = StyleSheet.create({
    snowflake: {
        backgroundColor: Theme.colors.white,
        position: 'absolute',
        top: 0,
        left: 0,
    },
});
