import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../constants/Theme';
import { useStableCallback } from '../hooks/useStableCallback';
import type { Story } from '../lib/models/story';
import { AnalyticsService } from '../services/analytics';
import { TabHeader } from './TabHeader';
import { StoryFeed, type StoryFeedEmptyAction } from './library/StoryFeed';
import { libraryStyles as styles } from './screenStyles/libraryStyles';

type Props = {
    title: string;
    stories: Story[];
    loading: boolean;
    refresh: () => void;
    toggleFavorite: (storyId: string, current: boolean) => void | Promise<void>;
    showCreator: boolean;
    showPublicIcon?: boolean;
    emptyTitle: string;
    emptyText: string;
    emptyAction?: StoryFeedEmptyAction;
    favoritesFilterTestID: string;
    favoritesFilterLabelActive: string;
    favoritesFilterLabelInactive: string;
    sortComparator?: (a: Story, b: Story) => number;
};

export function StoryListScreen({
    title,
    stories,
    loading,
    refresh,
    toggleFavorite,
    showCreator,
    showPublicIcon = true,
    emptyTitle,
    emptyText,
    emptyAction,
    favoritesFilterTestID,
    favoritesFilterLabelActive,
    favoritesFilterLabelInactive,
    sortComparator,
}: Props) {
    const router = useRouter();
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const visibleStories = useMemo(() => {
        const source = showFavoritesOnly ? stories.filter((story) => Boolean(story.isFavorite)) : stories;
        if (!sortComparator) return source;
        const sorted = [...source];
        sorted.sort(sortComparator);
        return sorted;
    }, [showFavoritesOnly, sortComparator, stories]);

    const refreshStable = useStableCallback(refresh);
    const toggleFavoriteStable = useStableCallback(toggleFavorite);

    const handlePlay = useCallback((storyId: string) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/library/[storyId]', params: { storyId } });
    }, [router]);

    const handleRemix = useCallback((storyId: string, title: string, narrative: string) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/(tabs)/create',
            params: { remixId: storyId, remixTitle: title, remixContext: narrative },
        });
    }, [router]);

    const handleFavorite = useCallback((storyId: string, current: boolean) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void toggleFavoriteStable(storyId, current);
        AnalyticsService.trackFavorite(storyId, !current);
    }, [toggleFavoriteStable]);

    const handleFavoritesOnlyChange = useCallback((value: boolean) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowFavoritesOnly(value);
    }, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <TabHeader
                title={title}
                right={(
                    <View style={toggleStyles.container}>
                        <Switch
                            testID={favoritesFilterTestID}
                            accessibilityLabel={showFavoritesOnly ? favoritesFilterLabelActive : favoritesFilterLabelInactive}
                            value={showFavoritesOnly}
                            onValueChange={handleFavoritesOnlyChange}
                            ios_backgroundColor={Theme.colors.glassBorder}
                            trackColor={{
                                false: Theme.colors.glassBorder,
                                true: Theme.colors.primarySoft,
                            }}
                            thumbColor={Platform.OS === 'android' ? Theme.colors.white : undefined}
                            style={Platform.OS === 'ios' ? toggleStyles.switch : undefined}
                        />
                        <Ionicons
                            name={showFavoritesOnly ? 'heart' : 'heart-outline'}
                            size={16}
                            color={showFavoritesOnly ? Theme.colors.error : Theme.colors.textMuted}
                            style={{ opacity: 0.9 }}
                        />
                    </View>
                )}
            />

            <StoryFeed
                stories={visibleStories}
                loading={loading}
                onRefresh={refreshStable}
                showCreator={showCreator}
                showPublicIcon={showPublicIcon}
                onPlay={handlePlay}
                onRemix={handleRemix}
                onFavorite={handleFavorite}
                emptyTitle={emptyTitle}
                emptyText={emptyText}
                emptyAction={emptyAction}
            />
        </SafeAreaView>
    );
}

const toggleStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    switch: {
        transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
    },
});
