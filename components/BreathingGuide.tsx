import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

interface BreathingGuideProps {
    variant?: 'rings' | 'glow';
    duration?: number;
    color?: string;
    size?: number;
    ringWidth?: number;
    minScale?: number;
    maxScale?: number;
    minOpacity?: number;
    maxOpacity?: number;
}

export function BreathingGuide({
    variant = 'rings',
    duration = 10000, // 10s for full breath cycle
    color = Theme.colors.primaryWash,
    size = 200,
    ringWidth = 2.5,
    minScale = 0.7,
    maxScale = 1.05,
    minOpacity = 0.35,
    maxOpacity = 0.85,
}: BreathingGuideProps) {
    const scale = useSharedValue(minScale);
    const opacity = useSharedValue(minOpacity);

    useEffect(() => {
        scale.value = withRepeat(
            withTiming(maxScale, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
        opacity.value = withRepeat(
            withTiming(maxOpacity, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, [duration, maxOpacity, maxScale, minOpacity, minScale, opacity, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const innerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value * 0.7 }],
        opacity: opacity.value * 0.4,
    }));

    if (variant === 'glow') {
        const glowColors = [
            applyAlpha(color, 0.12),
            applyAlpha(color, 0.85),
            applyAlpha(color, 0.18),
        ] as const;

        return (
            <View style={[styles.container, { width: size, height: size }]}>
                <Animated.View style={[
                    styles.glowShadow,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        shadowColor: color,
                        shadowOpacity: 0.75,
                        shadowRadius: 58,
                        elevation: 12,
                    },
                    animatedStyle
                ]}>
                    <View style={[styles.glowFill, { borderRadius: size / 2, backgroundColor: applyAlpha(color, 0.14) }]}>
                        <LinearGradient
                            colors={glowColors}
                            start={{ x: 0.15, y: 0.1 }}
                            end={{ x: 0.95, y: 0.9 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                    </View>
                </Animated.View>
                <Animated.View style={[
                    styles.glowShadow,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        shadowColor: color,
                        shadowOpacity: 0.22,
                        shadowRadius: 30,
                        elevation: 6,
                    },
                    innerAnimatedStyle
                ]}>
                    <View style={[styles.glowFill, { borderRadius: size / 2, backgroundColor: applyAlpha(color, 0.08) }]}>
                        <LinearGradient
                            colors={[
                                applyAlpha(color, 0.0),
                                applyAlpha(color, 0.26),
                                applyAlpha(color, 0.0),
                            ] as const}
                            start={{ x: 0.0, y: 0.5 }}
                            end={{ x: 1.0, y: 0.5 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                    </View>
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Animated.View style={[
                styles.ring,
                { width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth: ringWidth },
                animatedStyle
            ]} />
            <Animated.View style={[
                styles.ring,
                { width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth: ringWidth },
                innerAnimatedStyle
            ]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ring: {
        position: 'absolute',
    },
    glowShadow: {
        position: 'absolute',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.38,
        shadowRadius: 30,
    },
    glowFill: {
        flex: 1,
        overflow: 'hidden',
    },
});

function applyAlpha(color: string, alpha: number): string {
    if (color.startsWith('#')) {
        const normalized = color.slice(1);
        const full = normalized.length === 3
            ? normalized.split('').map((c) => c + c).join('')
            : normalized;
        if (full.length !== 6) return color;

        const r = Number.parseInt(full.slice(0, 2), 16);
        const g = Number.parseInt(full.slice(2, 4), 16);
        const b = Number.parseInt(full.slice(4, 6), 16);
        if (![r, g, b].every(Number.isFinite)) return color;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (color.startsWith('rgba(')) {
        const match = color.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/);
        if (!match) return color;
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }

    if (color.startsWith('rgb(')) {
        const match = color.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
        if (!match) return color;
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }

    return color;
}
