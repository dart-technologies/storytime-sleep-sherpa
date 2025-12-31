import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioCacheStats, getCachedAudioPath } from '../../lib/audioCache';
import { formatBytes } from '../../lib/formatUtils';
import { estimateAudioBytes, getOfflineFavoriteAudioFileName } from '../../lib/offlineFavoritesDownloads';
import type { Story } from '../../lib/models/story';
import { useStoryTables } from '../stories/useStoryTables';

type CacheState = {
    eligibleCount: number;
    cachedEligibleCount: number;
    estimatedBytes: number;
    cachedBytes: number;
};

function buildEligibleFavorites(stories: Story[]): Story[] {
    const map = new Map<string, Story>();
    stories.forEach((story) => {
        if (!story?.id) return;
        if (!story.isFavorite) return;
        if (!story.audioUrl) return;
        map.set(story.id, story);
    });
    return Array.from(map.values());
}

export function useOfflineFavoritesDownloadsStats() {
    const { myStories, featuredStories } = useStoryTables();
    const eligibleStories = useMemo(
        () => buildEligibleFavorites([...myStories, ...featuredStories]),
        [featuredStories, myStories]
    );

    const eligibleKey = useMemo(
        () => eligibleStories.map((story) => `${story.id}:${story.audioUrl || ''}:${story.duration || 0}`).sort().join('|'),
        [eligibleStories]
    );

    const [state, setState] = useState<CacheState>({
        eligibleCount: eligibleStories.length,
        cachedEligibleCount: 0,
        estimatedBytes: 0,
        cachedBytes: 0,
    });

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const eligibleCount = eligibleStories.length;
        const estimatedBytes = eligibleStories.reduce((sum, story) => sum + estimateAudioBytes(story.duration), 0);

        const { totalBytes: cachedBytes } = await getAudioCacheStats();

        const cachedEligibleFlags = await Promise.all(eligibleStories.map(async (story) => {
            try {
                const fileName = getOfflineFavoriteAudioFileName(story.id);
                const cachedPath = await getCachedAudioPath(fileName);
                return Boolean(cachedPath);
            } catch {
                return false;
            }
        }));

        const cachedEligibleCount = cachedEligibleFlags.filter(Boolean).length;

        if (!mountedRef.current) return;
        setState({
            eligibleCount,
            cachedEligibleCount,
            estimatedBytes,
            cachedBytes,
        });
    }, [eligibleStories]);

    useEffect(() => {
        void refresh();
    }, [eligibleKey, refresh]);

    const summary = useMemo(() => {
        const eligible = state.eligibleCount;
        const cached = state.cachedEligibleCount;
        const est = formatBytes(state.estimatedBytes);
        const cache = formatBytes(state.cachedBytes);
        return `${eligible} eligible • ${cached} cached • ~${est} est. • ${cache} on device`;
    }, [state.cachedBytes, state.cachedEligibleCount, state.eligibleCount, state.estimatedBytes]);

    return useMemo(() => ({
        eligibleStories,
        ...state,
        summary,
        refresh,
    }), [eligibleStories, refresh, state, summary]);
}

