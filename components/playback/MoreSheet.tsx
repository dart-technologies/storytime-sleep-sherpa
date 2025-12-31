import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Theme } from '../../constants/Theme';
import { formatCountLabel, formatCreatorAttribution } from '../../lib/formatUtils';
import { playbackStyles as styles } from '../screenStyles/playbackStyles';

export function MoreSheet({
    open,
    height,
    insetsBottom,
    title,
    metaLine1,
    metaLine2,
    creatorName,
    playCount,
    remixCount,
    favoritedCount,
    isFavorite,
    isPublic,
    canDelete,
    canTogglePublic,
    isDeleting,
    onRequestClose,
    onToggleFavorite,
    onTogglePublic,
    onSaveAudio,
    onShare,
    onDelete,
}: {
    open: boolean;
    height: number;
    insetsBottom: number;
    title: string;
    metaLine1: string;
    metaLine2: string;
    creatorName?: string;
    playCount?: number;
    remixCount?: number;
    favoritedCount?: number;
    isFavorite: boolean;
    isPublic: boolean;
    canDelete: boolean;
    canTogglePublic: boolean;
    isDeleting: boolean;
    onRequestClose: () => void;
    onToggleFavorite: () => void;
    onTogglePublic: () => void;
    onSaveAudio?: () => void;
    onShare: () => void;
    onDelete: () => void;
}) {
    const [mounted, setMounted] = useState(open);
    const progress = useSharedValue(0);
    const dragY = useSharedValue(0);
    const didReachCloseThresholdRef = useRef(false);
    const creatorAttribution = useMemo(() => formatCreatorAttribution(creatorName), [creatorName]);
    const playCountLabel = useMemo(() => formatCountLabel(playCount), [playCount]);
    const remixCountLabel = useMemo(() => formatCountLabel(remixCount), [remixCount]);
    const favoritedCountLabel = useMemo(() => formatCountLabel(favoritedCount), [favoritedCount]);

    useEffect(() => {
        if (open) {
            setMounted(true);
        }
    }, [open]);

    useEffect(() => {
        progress.value = withTiming(open ? 1 : 0, {
            duration: Theme.motion.duration.medium,
            easing: Easing.out(Easing.cubic),
        }, (finished) => {
            if (!finished) return;
            if (open) return;
            runOnJS(setMounted)(false);
        });
        if (open) {
            dragY.value = 0;
        }
    }, [open, dragY, progress]);

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value * (1 - Math.min(1, dragY.value / height)),
    }), [height]);

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: (1 - progress.value) * (height + 60) + dragY.value }],
    }), [height]);

    const handleAnimatedStyle = useAnimatedStyle(() => {
        const dragProgress = Math.min(1, dragY.value / 28);
        return {
            opacity: 0.7 + dragProgress * 0.3,
            transform: [
                { scaleX: 1 + dragProgress * 0.2 },
                { scaleY: 1 + dragProgress * 0.35 },
            ],
        };
    }, []);

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
            if (!open) return false;
            if (Math.abs(gesture.dx) > 18) return false;
            return gesture.dy > 8;
        },
        onPanResponderGrant: () => {
            didReachCloseThresholdRef.current = false;
        },
        onPanResponderMove: (_, gesture) => {
            if (!open) return;
            const nextDragY = Math.max(0, gesture.dy);
            dragY.value = nextDragY;
            if (nextDragY > 90 && !didReachCloseThresholdRef.current) {
                didReachCloseThresholdRef.current = true;
                void Haptics.selectionAsync();
            }
        },
        onPanResponderRelease: (_, gesture) => {
            if (!open) return;
            const shouldClose = gesture.dy > 90 || gesture.vy > 1.15;
            if (shouldClose) {
                runOnJS(onRequestClose)();
                return;
            }
            dragY.value = withTiming(0, { duration: Theme.motion.duration.fast, easing: Easing.out(Easing.cubic) });
        },
        onPanResponderTerminate: () => {
            dragY.value = withTiming(0, { duration: Theme.motion.duration.fast, easing: Easing.out(Easing.cubic) });
        },
    }), [dragY, onRequestClose, open]);

    const handleFavorite = () => {
        onToggleFavorite();
    };

    const handleShare = () => {
        onRequestClose();
        void onShare();
    };

    const handleSaveAudio = () => {
        if (!onSaveAudio) return;
        onRequestClose();
        void onSaveAudio();
    };

    const handleDelete = () => {
        onRequestClose();
        onDelete();
    };

    const handlePublicChange = (value: boolean) => {
        if (value === isPublic) return;
        void Haptics.selectionAsync();
        onTogglePublic();
    };

    if (!mounted) return null;

    return (
        <View pointerEvents="box-none" style={styles.moreSheetRoot}>
            <Animated.View pointerEvents="auto" style={[styles.moreSheetBackdrop, backdropAnimatedStyle]}>
                <TouchableOpacity
                    testID="playback-more-dismiss"
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss options"
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={onRequestClose}
                />
            </Animated.View>
            <Animated.View
                pointerEvents="auto"
                style={[styles.moreSheetCard, sheetAnimatedStyle]}
                {...panResponder.panHandlers}
            >
                <BlurView pointerEvents="none" intensity={Theme.blur.strong} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[styles.moreSheetContent, { paddingBottom: Theme.spacing.lg + insetsBottom }]}>
                    <Animated.View style={[styles.moreSheetHandle, handleAnimatedStyle]} />
                    <Text style={styles.moreSheetTitle} numberOfLines={2} ellipsizeMode="tail">
                        {title}
                    </Text>
                    {creatorAttribution ? (
                        <Text style={styles.moreSheetMeta} numberOfLines={1} ellipsizeMode="tail">
                            By {creatorAttribution}
                        </Text>
                    ) : null}
                    {metaLine1 ? (
                        <Text style={styles.moreSheetMeta} numberOfLines={1} ellipsizeMode="tail">
                            {metaLine1}
                        </Text>
                    ) : null}
                    {metaLine2 ? (
                        <Text style={[styles.moreSheetMeta, styles.moreSheetMetaLine2]} numberOfLines={1} ellipsizeMode="tail">
                            {metaLine2}
                        </Text>
                    ) : null}

                    <View style={styles.moreSheetStatsRow}>
                        <View style={styles.moreSheetStatItem}>
                            <Ionicons name="headset-outline" size={18} color={Theme.colors.textMuted} />
                            <Text style={styles.moreSheetStatValue}>{playCountLabel}</Text>
                        </View>
                        <View style={styles.moreSheetStatDivider} />
                        <View style={styles.moreSheetStatItem}>
                            <Ionicons name="git-branch-outline" size={18} color={Theme.colors.textMuted} />
                            <Text style={styles.moreSheetStatValue}>{remixCountLabel}</Text>
                        </View>
                        <View style={styles.moreSheetStatDivider} />
                        <TouchableOpacity
                            testID="playback-stat-favorite"
                            accessibilityRole="button"
                            accessibilityLabel={isFavorite ? 'Unfavorite story' : 'Favorite story'}
                            style={styles.moreSheetStatItem}
                            onPress={handleFavorite}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={isFavorite ? 'heart' : 'heart-outline'}
                                size={18}
                                color={isFavorite ? Theme.colors.error : Theme.colors.textMuted}
                            />
                            <Text style={styles.moreSheetStatValue}>{favoritedCountLabel}</Text>
                        </TouchableOpacity>
                    </View>

                    {canTogglePublic ? (
                        <View style={styles.moreSheetToggleRow}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={16}
                                color={isPublic ? Theme.colors.textMuted : Theme.colors.white}
                                style={{ opacity: 0.9 }}
                            />
                            <Switch
                                testID="playback-toggle-public"
                                accessibilityLabel={isPublic ? 'Make story private' : 'Make story public'}
                                value={isPublic}
                                onValueChange={handlePublicChange}
                                ios_backgroundColor={Theme.colors.glassBorder}
                                trackColor={{
                                    false: Theme.colors.glassBorder,
                                    true: Theme.colors.primarySoft,
                                }}
                                thumbColor={Platform.OS === 'android' ? Theme.colors.white : undefined}
                                style={Platform.OS === 'ios' ? styles.moreSheetToggleSwitch : undefined}
                            />
                            <Ionicons
                                name="globe-outline"
                                size={16}
                                color={isPublic ? Theme.colors.white : Theme.colors.textMuted}
                                style={{ opacity: 0.9 }}
                            />
                        </View>
                    ) : null}

                    <View style={styles.moreSheetActionsRow}>
                        {onSaveAudio ? (
                            <TouchableOpacity
                                testID="playback-action-save-audio"
                                accessibilityRole="button"
                                accessibilityLabel="Save audio file"
                                style={styles.moreSheetActionIconButton}
                                onPress={handleSaveAudio}
                            >
                                <Ionicons name="download-outline" size={24} color={Theme.colors.white} style={{ opacity: 0.9 }} />
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                            testID="playback-action-share"
                            accessibilityRole="button"
                            accessibilityLabel="Share story"
                            style={styles.moreSheetActionIconButton}
                            onPress={handleShare}
                        >
                            <Ionicons name="share-outline" size={24} color={Theme.colors.white} style={{ opacity: 0.9 }} />
                        </TouchableOpacity>

                        {canDelete ? (
                            <>
                                <TouchableOpacity
                                    testID="playback-action-delete"
                                    accessibilityRole="button"
                                    accessibilityLabel="Delete story"
                                    style={[
                                        styles.moreSheetActionIconButton,
                                        styles.moreSheetActionIconButtonDestructive,
                                        isDeleting && styles.moreSheetActionIconButtonDisabled,
                                    ]}
                                    onPress={handleDelete}
                                    disabled={isDeleting}
                                >
                                    <Ionicons name="trash-outline" size={24} color={Theme.colors.white} style={{ opacity: 0.95 }} />
                                </TouchableOpacity>
                            </>
                        ) : null}

                        <TouchableOpacity
                            testID="playback-action-cancel"
                            accessibilityRole="button"
                            accessibilityLabel="Close options"
                            style={styles.moreSheetActionIconButton}
                            onPress={onRequestClose}
                        >
                            <Ionicons name="close" size={26} color={Theme.colors.white} style={{ opacity: 0.9 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}
