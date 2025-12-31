import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import type { GenerationPhase } from '../../hooks/intake/useIntakeFlow';
import { intakeStyles as styles } from '../screenStyles/intakeStyles';

const GENERATION_STEPS: Array<{ phase: Exclude<GenerationPhase, 'idle'>; label: string }> = [
    { phase: 'stoppingVoice', label: 'Generating…' },
    { phase: 'generatingStory', label: 'Generating…' },
    { phase: 'creatingCover', label: 'Creating…' },
    { phase: 'narratingAudio', label: 'Narrating…' },
    { phase: 'savingStory', label: 'Saving…' },
    { phase: 'openingPlayback', label: 'Opening…' },
];

export function GenerationProgressOverlay({
    visible,
    coverPreviewSource,
    coverPreviewRef,
    generationPhase,
}: {
    visible: boolean;
    coverPreviewSource: any;
    coverPreviewRef: React.RefObject<any>;
    generationPhase: GenerationPhase;
}) {
    const { currentLabel, progress } = useMemo(() => {
        const stepIndex = GENERATION_STEPS.findIndex((step) => step.phase === generationPhase);
        const resolvedIndex = stepIndex >= 0 ? stepIndex : 0;
        const completedSteps = Math.max(0, resolvedIndex);
        const total = GENERATION_STEPS.length;
        const denominator = Math.max(1, total - 1);
        const normalized = Math.min(1, Math.max(0, completedSteps / denominator));
        return {
            currentLabel: stepIndex >= 0 ? GENERATION_STEPS[stepIndex].label : 'Creating your dream…',
            progress: normalized,
        };
    }, [generationPhase]);

    const shimmerProgress = useSharedValue(0);
    const shimmerWidth = useSharedValue(260);

    useEffect(() => {
        if (!visible) {
            cancelAnimation(shimmerProgress);
            shimmerProgress.value = 0;
            return;
        }

        shimmerProgress.value = 0;
        shimmerProgress.value = withRepeat(
            withTiming(1, { duration: 1400, easing: Easing.linear }),
            -1,
            false
        );

        return () => {
            cancelAnimation(shimmerProgress);
        };
    }, [shimmerProgress, visible]);

    const shimmerAnimatedStyle = useAnimatedStyle(() => {
        const width = Math.max(0, shimmerWidth.value);
        const travel = width + 240;
        return {
            transform: [{ translateX: shimmerProgress.value * travel }],
        };
    }, []);

    if (!visible) return null;

    return (
        <View style={styles.overlay} pointerEvents="auto">
            <BlurView intensity={Theme.blur.medium} tint="dark" style={styles.overlayCard}>
                {coverPreviewSource ? (
                    <View ref={coverPreviewRef} collapsable={false}>
                        <Image source={coverPreviewSource as any} style={styles.overlayArtwork} contentFit="cover" transition={Theme.motion.imageTransition.fast} />
                    </View>
                ) : null}
                <Text style={styles.overlayTitle}>Crafting your dream</Text>

                <View
                    style={styles.overlayProgressPill}
                    onLayout={(event) => {
                        shimmerWidth.value = event.nativeEvent.layout.width;
                    }}
                >
                    <Text style={styles.overlayProgressText} numberOfLines={1} ellipsizeMode="tail">
                        {currentLabel}
                    </Text>
                    <Animated.View pointerEvents="none" style={[styles.overlayProgressShimmer, shimmerAnimatedStyle]}>
                        <LinearGradient
                            colors={[
                                'rgba(255,255,255,0)',
                                'rgba(255,255,255,0.22)',
                                'rgba(255,255,255,0)',
                            ]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                    </Animated.View>
                </View>

                <View style={styles.overlayProgressTrack}>
                    <View style={[styles.overlayProgressFill, { flex: progress }]} />
                    <View style={{ flex: 1 - progress }} />
                </View>
            </BlurView>
        </View>
    );
}
