import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import WaveformVisualizer from '../WaveformVisualizer';
import { playbackStyles as styles } from '../screenStyles/playbackStyles';

export function PlaybackFooter({
    isPlaying,
    hasAudio,
    onTogglePlay,
    onMore,
    insetsBottom,
    logLayoutOnce,
}: {
    isPlaying: boolean;
    hasAudio: boolean;
    onTogglePlay: () => void;
    onMore: () => void;
    insetsBottom: number;
    logLayoutOnce?: (key: string, event: LayoutChangeEvent) => void;
}) {
    const playToggleProgress = useSharedValue(isPlaying ? 1 : 0);

    useEffect(() => {
        playToggleProgress.value = withTiming(isPlaying ? 1 : 0, {
            duration: Theme.motion.duration.medium,
            easing: Easing.inOut(Easing.cubic),
        });
    }, [isPlaying, playToggleProgress]);

    const playIconAnimatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - playToggleProgress.value,
        transform: [{ scale: 1 - playToggleProgress.value * 0.08 }],
    }), [playToggleProgress]);

    const waveformAnimatedStyle = useAnimatedStyle(() => ({
        opacity: playToggleProgress.value,
        transform: [{ scale: 0.92 + playToggleProgress.value * 0.08 }],
    }), [playToggleProgress]);

    const safeLogLayoutOnce = logLayoutOnce || (() => undefined);

    return (
        <View style={[styles.footer, { paddingBottom: Math.max(Theme.spacing.lg, insetsBottom + Theme.spacing.sm) }]}>
            <View style={styles.footerRow}>
                <View style={[styles.playButtonShadow, isPlaying && styles.playButtonShadowActive]}>
                    <TouchableOpacity
                        testID="playback-toggle-play"
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? 'Pause story' : 'Play story'}
                        style={[
                            styles.playButton,
                            isPlaying && styles.playButtonActive,
                            !hasAudio && styles.playButtonDisabled,
                        ]}
                        onPress={onTogglePlay}
                        activeOpacity={0.85}
                    >
                        <BlurView pointerEvents="none" intensity={Theme.blur.strong} tint="dark" style={styles.playButtonBackdrop} />
                        <View pointerEvents="none" style={styles.playButtonTint} />
                        <View
                            pointerEvents="none"
                            style={styles.playButtonInner}
                            onLayout={(event) => safeLogLayoutOnce(`playButtonInner:${isPlaying ? 'playing' : 'paused'}`, event)}
                        >
                            <View
                                style={styles.playButtonContentFrame}
                                onLayout={(event) => safeLogLayoutOnce(`playButtonFrame:${isPlaying ? 'playing' : 'paused'}`, event)}
                            >
                                <Animated.View
                                    pointerEvents="none"
                                    style={[styles.playButtonContentOverlay, styles.waveformButtonContent, waveformAnimatedStyle]}
                                >
                                    <View onLayout={(event) => safeLogLayoutOnce('waveform', event)}>
                                        <WaveformVisualizer isPlaying={isPlaying} color={Theme.colors.white} />
                                    </View>
                                </Animated.View>
                                <Animated.View pointerEvents="none" style={[styles.playButtonContentOverlay, playIconAnimatedStyle]}>
                                    <View onLayout={(event) => safeLogLayoutOnce('playIcon', event)}>
                                        <Ionicons
                                            name="play"
                                            size={62}
                                            color={hasAudio ? Theme.colors.white : Theme.colors.textMuted}
                                            style={{
                                                opacity: hasAudio ? 0.95 : 0.7,
                                                transform: [{ translateX: -2 }],
                                            }}
                                        />
                                    </View>
                                </Animated.View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.moreButtonContainer}>
                    <TouchableOpacity
                        testID="playback-more"
                        accessibilityRole="button"
                        accessibilityLabel="More options"
                        onPress={onMore}
                        style={styles.moreButton}
                        activeOpacity={0.85}
                    >
                        <BlurView pointerEvents="none" intensity={Theme.blur.soft} tint="dark" style={styles.moreButtonBackdrop} />
                        <View pointerEvents="none" style={styles.moreButtonTint} />
                        <Ionicons name="ellipsis-horizontal" size={22} color={Theme.colors.white} style={{ opacity: 0.9 }} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
