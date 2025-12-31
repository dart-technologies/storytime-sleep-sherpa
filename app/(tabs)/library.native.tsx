import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StoryListScreen } from '../../components/StoryListScreen';
import { useStories } from '../../hooks/useStories';
import type { Story } from '../../lib/models/story';

function compareMyDreamStories(a: Story, b: Story) {
    const aCreatedAt = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const bCreatedAt = typeof b.createdAt === 'number' ? b.createdAt : 0;
    if (bCreatedAt !== aCreatedAt) return bCreatedAt - aCreatedAt;
    return (b.id || '').localeCompare(a.id || '');
}

export default function LibraryScreen() {
    const { myStories, loading, refresh, toggleFavorite } = useStories();
    const router = useRouter();

    const handleCreateFirstDream = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/create');
    }, [router]);

    return (
        <StoryListScreen
            title="Stories"
            stories={myStories}
            loading={loading}
            refresh={refresh}
            toggleFavorite={toggleFavorite}
            showCreator={false}
            emptyTitle="No dreams found"
            emptyText="Your subconscious is waiting for that first spark of a story."
            emptyAction={{ label: 'Create Your First Dream', onPress: handleCreateFirstDream }}
            favoritesFilterTestID="library-filter-favorites"
            favoritesFilterLabelActive="Show all dreams"
            favoritesFilterLabelInactive="Show favorited dreams"
            sortComparator={compareMyDreamStories}
        />
    );
}
