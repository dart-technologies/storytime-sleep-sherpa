import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import { playbackStyles as styles } from '../screenStyles/playbackStyles';

export function PlaybackArtwork({
    artworkRef,
    onArtworkLayout,
    artworkSource,
    narratorAvatarSource,
    placeholderLetter,
    summary,
    artworkSize,
    isPlaying,
    breathingColor,
    isCoverTransitionActive,
}: {
    artworkRef: React.RefObject<any>;
    onArtworkLayout: () => void;
    artworkSource: any;
    narratorAvatarSource: any;
    placeholderLetter: string;
    summary: string;
    artworkSize: number;
    isPlaying: boolean;
    breathingColor: string;
    isCoverTransitionActive: boolean;
}) {
    const glowProgress = useSharedValue(0);

    useEffect(() => {
        if (isPlaying) {
            glowProgress.value = withRepeat(
                withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
                -1,
                true
            );
            return;
        }

        cancelAnimation(glowProgress);
        glowProgress.value = withTiming(0, { duration: Theme.motion.duration.fast, easing: Easing.out(Easing.cubic) });
    }, [glowProgress, isPlaying]);

    const glowAnimatedStyle = useAnimatedStyle(() => {
        const t = glowProgress.value;
        return {
            opacity: 0.4 + t * 0.6,
            transform: [{ scale: 1 + t * 0.012 }],
            shadowOpacity: 0.25 + t * 0.5,
            shadowRadius: 14 + t * 22,
        };
    }, []);

    return (
        <View style={styles.body}>
            <View style={styles.artworkContainer}>
                {isPlaying ? (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.artworkGlowFrame,
                            { shadowColor: breathingColor },
                            glowAnimatedStyle,
                        ]}
                    >
                        <LinearGradient
                            colors={[
                                applyAlpha(breathingColor, 0.0),
                                applyAlpha(breathingColor, 0.08),
                                applyAlpha(breathingColor, 0.22),
                                applyAlpha(breathingColor, 0.08),
                                applyAlpha(breathingColor, 0.0),
                            ]}
                            start={{ x: 0.05, y: 0.2 }}
                            end={{ x: 0.95, y: 0.8 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                    </Animated.View>
                ) : null}
                <View
                    ref={artworkRef}
                    collapsable={false}
                    onLayout={onArtworkLayout}
                    style={[
                        styles.artwork,
                        { width: artworkSize, height: artworkSize },
                        isPlaying ? { borderColor: applyAlpha(breathingColor, 0.65) } : null,
                    ]}
                >
                    {artworkSource ? (
                        <Image
                            source={artworkSource}
                            style={[styles.personaAvatar, isCoverTransitionActive && { opacity: 0 }]}
                            contentFit="cover"
                            transition={Theme.motion.imageTransition.slow}
                        />
                    ) : (
                        <Text style={styles.artworkText}>{placeholderLetter}</Text>
                    )}
                </View>
            </View>

            <View style={styles.summaryRow}>
                {narratorAvatarSource ? (
                    <Image
                        source={narratorAvatarSource}
                        style={styles.summaryAvatar}
                        contentFit="cover"
                        transition={Theme.motion.imageTransition.fast}
                    />
                ) : (
                    <View style={styles.summaryAvatarPlaceholder}>
                        <Text style={styles.summaryAvatarText}>{placeholderLetter}</Text>
                    </View>
                )}
                <Text style={styles.summary} numberOfLines={4} ellipsizeMode="clip">
                    {summary}
                </Text>
            </View>
        </View>
    );
}

function applyAlpha(color: string, alpha: number): string {
    const normalized = String(color || '').trim();
    if (!normalized) return color;
    if (!normalized.startsWith('#')) return color;

    const hex = normalized.slice(1);
    const full = hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex;
    if (full.length !== 6) return color;

    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    if (![r, g, b].every(Number.isFinite)) return color;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
