import React, { useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

export default function StorySkeleton() {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        const pulseDurationMs = Theme.motion.duration.skeletonPulse;
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: pulseDurationMs }),
                withTiming(0.3, { duration: pulseDurationMs })
            ),
            -1,
            true
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <View style={styles.container}>
            <BlurView intensity={Theme.blur.subtle} tint="dark" style={styles.content}>
                <View style={styles.header}>
                    <Animated.View style={[styles.badge, animatedStyle]} />
                    <Animated.View style={[styles.date, animatedStyle]} />
                </View>
                <Animated.View style={[styles.title, animatedStyle]} />
                <Animated.View style={[styles.text, animatedStyle]} />
                <Animated.View style={[styles.textShort, animatedStyle]} />
                <View style={styles.footer}>
                    <Animated.View style={[styles.button, animatedStyle]} />
                    <Animated.View style={[styles.button, animatedStyle]} />
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: Theme.glass.borderRadius,
        marginBottom: Theme.spacing.md,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassUltraSubtle,
    },
    content: {
        padding: Theme.spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.md,
    },
    badge: {
        width: 80,
        height: 20,
        borderRadius: 4,
        backgroundColor: Theme.colors.glassBorder,
    },
    date: {
        width: 60,
        height: 16,
        borderRadius: 4,
        backgroundColor: Theme.colors.glassBorder,
    },
    title: {
        width: '70%',
        height: 24,
        borderRadius: 4,
        backgroundColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.sm,
    },
    text: {
        width: '100%',
        height: 16,
        borderRadius: 4,
        backgroundColor: Theme.colors.glassBorder,
        marginBottom: 8,
    },
    textShort: {
        width: '40%',
        height: 16,
        borderRadius: 4,
        backgroundColor: Theme.colors.glassBorder,
        marginBottom: Theme.spacing.lg,
    },
    footer: {
        flexDirection: 'row',
        gap: 16,
    },
    button: {
        width: 80,
        height: 32,
        borderRadius: 16,
        backgroundColor: Theme.colors.glassBorder,
    }
});
