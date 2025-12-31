import { collection, getDocs, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalError } from '../components/ErrorProvider';
import { firestore as db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useStoryCRUD } from './stories/useStoryCRUD';
import { sanitizeForTinyBaseRow } from './stories/storyRowUtils';
import { useStoryTables } from './stories/useStoryTables';
import { dreamsStore, feedStore } from './useStore';

function isMissingIndexError(error: unknown): boolean {
    const code = typeof (error as any)?.code === 'string' ? (error as any).code : '';
    const message = error instanceof Error ? error.message : String(error);
    return code === 'firestore/failed-precondition' || message.toLowerCase().includes('requires an index');
}

function replaceTableFromDocs(
    store: typeof dreamsStore | typeof feedStore,
    tableName: string,
    docs: Array<{ id: string; data: () => Record<string, any> }>
) {
    const nextIds = new Set<string>();

    docs.forEach((doc) => {
        nextIds.add(doc.id);
        const data = doc.data() || {};
        store.setRow(tableName, doc.id, sanitizeForTinyBaseRow({ ...data, id: doc.id }));
    });

    const existing = store.getTable(tableName);
    Object.keys(existing).forEach((id) => {
        if (!nextIds.has(id)) {
            store.delRow(tableName, id);
        }
    });
}

export function useStories() {
    const { myStories, featuredStories } = useStoryTables();
    const { saveStory, updateStoryCoverImage, deleteStory, toggleFavorite, setStoryPublic } = useStoryCRUD();
    const { user } = useAuth();
    const errorContext = useOptionalError();

    const [refreshing, setRefreshing] = useState(false);
    const refreshInFlightRef = useRef(false);
    const warnedIndexRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = useCallback(() => {
        if (!user) return;
        if (refreshInFlightRef.current) return;

        refreshInFlightRef.current = true;
        setRefreshing(true);

        void (async () => {
            try {
                const storiesRef = collection(db, 'stories');

                const myStoriesSnapshot = await getDocs(query(
                    storiesRef,
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc'),
                ));
                replaceTableFromDocs(dreamsStore, 'myStories', myStoriesSnapshot.docs as any);

                let featuredSnapshot: any;
                try {
                    featuredSnapshot = await getDocs(query(
                        storiesRef,
                        where('isFeatured', '==', true),
                        where('isPublic', '==', true),
                        orderBy('playCount', 'desc'),
                        orderBy('createdAt', 'desc'),
                        limit(20),
                    ));
                } catch (error) {
                    if (!isMissingIndexError(error)) throw error;

                    featuredSnapshot = await getDocs(query(
                        storiesRef,
                        where('isFeatured', '==', true),
                        where('isPublic', '==', true),
                        orderBy('createdAt', 'desc'),
                        limit(20),
                    ));

                    if (!warnedIndexRef.current) {
                        warnedIndexRef.current = true;
                        errorContext?.showToast({
                            type: 'info',
                            message: 'Featured is using newest stories while Firestore indexes finish building.',
                        });
                    }
                }

                replaceTableFromDocs(feedStore, 'featuredStories', featuredSnapshot.docs as any);

                const favoritesSnapshot = await getDocs(collection(db, 'users', user.uid, 'favorites'));
                replaceTableFromDocs(dreamsStore, 'favorites', favoritesSnapshot.docs as any);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errorContext?.showToast({
                    type: 'error',
                    message: message || 'Could not refresh stories.',
                });
            } finally {
                refreshInFlightRef.current = false;
                if (mountedRef.current) setRefreshing(false);
            }
        })();
    }, [errorContext, user]);

    const loading = useMemo(() => refreshing, [refreshing]);

    return {
        myStories,
        featuredStories,
        loading,
        saveStory,
        updateStoryCoverImage,
        deleteStory,
        toggleFavorite,
        setStoryPublic,
        refresh,
    };
}
