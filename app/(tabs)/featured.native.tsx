import React from 'react';
import { StoryListScreen } from '../../components/StoryListScreen';
import { useStories } from '../../hooks/useStories';
import type { Story } from '../../lib/models/story';

function compareFeaturedStories(a: Story, b: Story) {
    const aPlays = typeof a.playCount === 'number' ? a.playCount : 0;
    const bPlays = typeof b.playCount === 'number' ? b.playCount : 0;
    if (bPlays !== aPlays) return bPlays - aPlays;
    return b.createdAt - a.createdAt;
}

export default function FeaturedScreen() {
    const { featuredStories, loading, refresh, toggleFavorite } = useStories();

    return (
        <StoryListScreen
            title="Featured"
            stories={featuredStories}
            loading={loading}
            refresh={refresh}
            toggleFavorite={toggleFavorite}
            showCreator={true}
            showPublicIcon={false}
            emptyTitle="No stories found"
            emptyText="The community is quiet tonight. Be the first to share!"
            favoritesFilterTestID="featured-filter-favorites"
            favoritesFilterLabelActive="Show all featured stories"
            favoritesFilterLabelInactive="Show favorited featured stories"
            sortComparator={compareFeaturedStories}
        />
    );
}
