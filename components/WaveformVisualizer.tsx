import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

interface WaveformVisualizerProps {
    isPlaying: boolean;
    color?: string;
}

export default function WaveformVisualizer({ isPlaying, color = Theme.colors.primary }: WaveformVisualizerProps) {
    const barCount = 12;
    const bars = Array.from({ length: barCount });

    return (
        <View style={styles.container}>
            {bars.map((_, i) => (
                <WaveBar key={i} index={i} isPlaying={isPlaying} color={color} />
            ))}
        </View>
    );
}

function WaveBar({ index, isPlaying, color }: { index: number; isPlaying: boolean; color: string }) {
    const height = useSharedValue(10);

    useEffect(() => {
        if (isPlaying) {
            // Create a gentle, semi-randomized movement for each bar
            const duration = 1200 + Math.random() * 1500;
            const targetHeight = 15 + Math.random() * 35;

            height.value = withRepeat(
                withSequence(
                    withTiming(targetHeight, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
                    withTiming(10, { duration: duration / 2, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
        } else {
            height.value = withTiming(4);
        }
    }, [isPlaying, height]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        backgroundColor: color,
        opacity: interpolate(height.value, [4, 50], [0.3, 0.8]),
    }));

    return <Animated.View style={[styles.bar, animatedStyle]} />;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
    },
    bar: {
        width: 3,
        borderRadius: 1.5,
        marginHorizontal: 3,
    },
});
