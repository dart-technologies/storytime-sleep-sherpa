import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, FlatList, LayoutAnimation, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useStableCallback } from '../../hooks/useStableCallback';
import { useVoiceNavigation } from '../../hooks/useVoiceNavigation';
import type { Story } from '../../lib/models/story';
import StorySkeleton from '../StorySkeleton';
import { libraryStyles as styles } from '../screenStyles/libraryStyles';
import { StoryCard } from './StoryCard';

export type StoryFeedEmptyAction = {
    label: string;
    onPress: () => void;
};

export type StoryFeedProps = {
    stories: Story[];
    loading: boolean;
    onRefresh: () => void;
    showCreator: boolean;
    showPublicIcon?: boolean;
    onPlay: (storyId: string) => void;
    onRemix: (storyId: string, title: string, narrative: string) => void;
    onFavorite: (storyId: string, current: boolean) => void;
    emptyTitle: string;
    emptyText: string;
    emptyAction?: StoryFeedEmptyAction;
};

export function StoryFeed({
    stories,
    loading,
    onRefresh,
    showCreator,
    showPublicIcon = true,
    onPlay,
    onRemix,
    onFavorite,
    emptyTitle,
    emptyText,
    emptyAction,
}: StoryFeedProps) {
    const {
        searchQuery,
        isListening,
        stopVoiceSearch,
        status: voiceStatus,
    } = useVoiceNavigation(stories);

    const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const filteredStories = useMemo(() => {
        if (!normalizedQuery) return stories;
        return stories.filter(story =>
            story.title.toLowerCase().includes(normalizedQuery) ||
            story.summary.toLowerCase().includes(normalizedQuery) ||
            (story.narrative || '').toLowerCase().includes(normalizedQuery) ||
            story.personaName.toLowerCase().includes(normalizedQuery)
        );
    }, [stories, normalizedQuery]);

    const emptyBreathingProgress = useRef(new Animated.Value(0)).current;
    const emptyBreathingAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (!emptyBreathingAnimationRef.current) {
            emptyBreathingAnimationRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(emptyBreathingProgress, {
                        toValue: 1,
                        duration: 1600,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(emptyBreathingProgress, {
                        toValue: 0,
                        duration: 1600,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
        }

        const animation = emptyBreathingAnimationRef.current;
        const shouldAnimate = filteredStories.length === 0 && !(loading && stories.length === 0);

        if (shouldAnimate) {
            animation.start();
            return () => animation.stop();
        }

        animation.stop();
        emptyBreathingProgress.setValue(0);
    }, [emptyBreathingProgress, filteredStories.length, loading, stories.length]);

    const emptyBreathingStyle = useMemo(() => ({
        opacity: emptyBreathingProgress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
        transform: [
            {
                scale: emptyBreathingProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
            },
        ],
    }), [emptyBreathingProgress]);

    useEffect(() => {
        LayoutAnimation.configureNext({
            duration: Theme.motion.duration.medium,
            create: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
            update: {
                type: LayoutAnimation.Types.easeInEaseOut,
            },
            delete: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
        });
    }, [normalizedQuery]);

    const onFavoriteStable = useStableCallback(onFavorite);

    const renderStoryItem = useCallback(({ item }: { item: Story }) => (
        <StoryCard
            id={item.id}
            personaId={item.personaId}
            personaName={item.personaName}
            isPublic={item.isPublic}
            createdAt={item.createdAt}
            coverImageUrl={item.coverImageUrl}
            title={item.title}
            summary={item.summary}
            narrative={item.narrative}
            durationSec={item.duration}
            isFavorite={Boolean(item.isFavorite)}
            canFavorite={true}
            playCount={item.playCount}
            remixCount={item.remixCount}
            favoritedCount={item.favoritedCount}
            creatorName={item.userName}
            showCreator={showCreator}
            showPublicIcon={showPublicIcon}
            onPlay={onPlay}
            onRemix={onRemix}
            onFavorite={onFavoriteStable}
        />
    ), [onFavoriteStable, onPlay, onRemix, showCreator, showPublicIcon]);

    const keyExtractor = useCallback((item: Story) => item.id, []);

    const refreshStable = useStableCallback(onRefresh);

    const refreshControl = useMemo(() => (
        <RefreshControl refreshing={loading} onRefresh={refreshStable} tintColor={Theme.colors.white} />
    ), [loading, refreshStable]);

    const stopVoiceSearchStable = useStableCallback(stopVoiceSearch);

    const listEmptyComponent = useMemo(() => (
        <View style={styles.emptyContainer}>
            <Animated.View style={[styles.emptyCircle, emptyBreathingStyle]}>
                <Ionicons name="moon-outline" size={48} color={Theme.colors.glassBorder} />
            </Animated.View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>
            {emptyAction ? (
                <TouchableOpacity style={styles.createFirstButton} onPress={emptyAction.onPress}>
                    <Text style={styles.createFirstButtonText}>{emptyAction.label}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    ), [emptyAction, emptyBreathingStyle, emptyText, emptyTitle]);

    return (
        <>
            {loading && stories.length === 0 ? (
                <View style={styles.listContainer}>
                    <StorySkeleton />
                    <StorySkeleton />
                    <StorySkeleton />
                </View>
            ) : (
                <FlatList
                    data={filteredStories}
                    renderItem={renderStoryItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={refreshControl}
                    ListEmptyComponent={listEmptyComponent}
                />
            )}

            {isListening ? (
                <BlurView intensity={Theme.blur.strong} tint="dark" style={styles.voiceOverlay}>
                    <View style={styles.voiceIndicator} />
                    <Text style={styles.voiceText}>
                        {voiceStatus === 'connected' ? 'Sage is listening...' : 'Sage is connecting...'}
                    </Text>
                    {searchQuery ? <Text style={styles.queryPreview}>&quot;{searchQuery}&quot;</Text> : null}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Stop listening"
                        style={styles.stopButton}
                        onPress={() => void stopVoiceSearchStable()}
                    >
                        <Text style={styles.stopButtonText}>Stop Listening</Text>
                    </TouchableOpacity>
                </BlurView>
            ) : null}
        </>
    );
}
