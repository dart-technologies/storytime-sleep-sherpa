import { useEffect, useMemo, useRef } from 'react';
import { cacheAudio, clearOldCache, getCachedAudioPath } from '../../lib/audioCache';
import type { Story } from '../../lib/models/story';
import { getOfflineFavoriteAudioFileName } from '../../lib/offlineFavoritesDownloads';
import { useStoryTables } from '../stories/useStoryTables';
import { useOfflineFavoritesDownloadsEnabled } from './useOfflineFavoritesDownloadsEnabled';

function buildEligibleFavoritesKey(stories: Story[]): string {
    return stories
        .map((story) => `${story.id}:${story.audioUrl || ''}`)
        .sort()
        .join('|');
}

export function useOfflineFavoritesAutoDownload() {
    const { enabled } = useOfflineFavoritesDownloadsEnabled();
    const { myStories, featuredStories } = useStoryTables();

    const eligibleStories = useMemo(() => {
        const map = new Map<string, Story>();
        [...myStories, ...featuredStories].forEach((story) => {
            if (!story?.id) return;
            if (!story.audioUrl) return;
            if (!story.isFavorite) return;
            map.set(story.id, story);
        });
        return Array.from(map.values());
    }, [featuredStories, myStories]);

    const eligibleKey = useMemo(() => buildEligibleFavoritesKey(eligibleStories), [eligibleStories]);

    const syncInFlightRef = useRef(false);
    const resyncRequestedRef = useRef(false);
    const enabledRef = useRef(enabled);
    const eligibleStoriesRef = useRef<Story[]>(eligibleStories);
    const cancelledRef = useRef(false);

    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    useEffect(() => {
        eligibleStoriesRef.current = eligibleStories;
    }, [eligibleStories]);

    useEffect(() => {
        cancelledRef.current = false;
        return () => {
            cancelledRef.current = true;
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;
        if (!eligibleStories.length) return;

        if (syncInFlightRef.current) {
            resyncRequestedRef.current = true;
            return;
        }

        syncInFlightRef.current = true;

        void (async () => {
            try {
                do {
                    resyncRequestedRef.current = false;
                    const stories = eligibleStoriesRef.current;

                    for (const story of stories) {
                        if (cancelledRef.current) return;
                        if (!enabledRef.current) return;
                        const audioUrl = story.audioUrl;
                        if (!audioUrl) continue;
                        const fileName = getOfflineFavoriteAudioFileName(story.id);
                        const cached = await getCachedAudioPath(fileName);
                        if (cached) continue;
                        try {
                            await cacheAudio(audioUrl, fileName);
                        } catch {
                            // ignore individual download failures
                        }
                    }

                    await clearOldCache(500);
                } while (resyncRequestedRef.current && enabledRef.current && !cancelledRef.current);
            } finally {
                syncInFlightRef.current = false;
            }
        })();
    }, [eligibleKey, eligibleStories.length, enabled]);
}
