import { useTable } from 'tinybase/ui-react';
import type { Story } from '../../lib/models/story';
import { dreamsStore, feedStore, useDreamsTable } from '../useStore';
import { normalizeStoryGeneration } from './storyRowUtils';

function mapStoryRow(row: any, favoriteIds: Set<string>): Story {
    const id = typeof row?.id === 'string' ? row.id : '';
    const isFavorite = Boolean(id && favoriteIds.has(id));

    return {
        ...row,
        generation: normalizeStoryGeneration(row?.generation),
        summary:
            typeof row?.summary === 'string' && row.summary.trim()
                ? row.summary
                : typeof row?.narrative === 'string'
                    ? row.narrative.slice(0, 140)
                    : '',
        narrative: typeof row?.narrative === 'string' && row.narrative.trim() ? row.narrative : undefined,
        isFavorite,
    } as Story;
}

export function useStoryTables() {
    const myStoriesTable = useDreamsTable('myStories', dreamsStore);
    const featuredStoriesTable = useTable('featuredStories', feedStore);
    const favoritesTable = useDreamsTable('favorites', dreamsStore);

    const favoriteIds = new Set(Object.keys(favoritesTable));

    const myStories = Object.values(myStoriesTable).map((row) => mapStoryRow(row, favoriteIds));
    const featuredStories = Object.values(featuredStoriesTable).map((row) => mapStoryRow(row, favoriteIds));

    return { myStories, featuredStories };
}
