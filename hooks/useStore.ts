import { collection, limit, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import { useEffect } from 'react';
import { createStore } from 'tinybase';
import { firestore as db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { sanitizeForTinyBaseRow } from './stories/storyRowUtils';

// Initialize partitioned stores
const dreamsStore = createStore();
const feedStore = createStore();

export { useRow as useDreamsRow, useTable as useDreamsTable } from 'tinybase/ui-react';
export { dreamsStore, feedStore };

function applySnapshotToTable(store: typeof dreamsStore, tableName: string, snapshot: any) {
    snapshot.docChanges().forEach((change: any) => {
        const docId = change.doc.id;
        if (change.type === 'removed') {
            store.delRow(tableName, docId);
            return;
        }
        const sanitized = sanitizeForTinyBaseRow(change.doc.data());
        store.setRow(tableName, docId, { ...sanitized, id: docId });
    });
}

function logFirestoreSyncError(label: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof (error as any)?.code === 'string' ? (error as any).code : undefined;
    console.error(label, { code, message });
    if (code === 'firestore/permission-denied' || message.includes('permission-denied')) {
        console.error(
            '[Firestore] permission-denied: deploy `firestore.rules`/`firestore.indexes.json` (e.g. `firebase deploy --only firestore:rules,firestore:indexes`) and check App Check enforcement.'
        );
    }
}

function isMissingIndexError(error: unknown): boolean {
    const code = typeof (error as any)?.code === 'string' ? (error as any).code : '';
    const message = error instanceof Error ? error.message : String(error);
    return code === 'firestore/failed-precondition' || message.toLowerCase().includes('requires an index');
}

export function useStoreSync() {
    const { user } = useAuth();

    useEffect(() => {
        dreamsStore.delTable('myStories');
        dreamsStore.delTable('favorites');
        feedStore.delTable('featuredStories');

        const storiesRef = collection(db, 'stories');

        let didFallbackFeatured = false;
        let unsubscribeFeaturedStories = () => {};

        const subscribeFeaturedStories = (fallback: boolean) => onSnapshot(
            query(
                storiesRef,
                where('isFeatured', '==', true),
                where('isPublic', '==', true),
                ...(fallback ? [orderBy('createdAt', 'desc')] : [orderBy('playCount', 'desc'), orderBy('createdAt', 'desc')]),
                limit(20),
            ),
            (snapshot) => {
                applySnapshotToTable(feedStore, 'featuredStories', snapshot);
            },
            (error) => {
                if (!fallback && !didFallbackFeatured && isMissingIndexError(error)) {
                    didFallbackFeatured = true;
                    try {
                        unsubscribeFeaturedStories();
                    } catch {
                        // ignore
                    }
                    unsubscribeFeaturedStories = subscribeFeaturedStories(true);
                    return;
                }
                logFirestoreSyncError('Error syncing featured stories:', error);
            },
        );

        unsubscribeFeaturedStories = subscribeFeaturedStories(false);

        if (!user) {
            return () => {
                unsubscribeFeaturedStories();
            };
        }

        const unsubscribeMyStories = onSnapshot(
            query(
                storiesRef,
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc'),
            ),
            (snapshot) => {
                applySnapshotToTable(dreamsStore, 'myStories', snapshot);
            },
            (error) => {
                logFirestoreSyncError('Error syncing my stories:', error);
            },
        );

        const unsubscribeFavorites = onSnapshot(
            collection(db, 'users', user.uid, 'favorites'),
            (snapshot) => {
                applySnapshotToTable(dreamsStore, 'favorites', snapshot);
            },
            (error) => {
                logFirestoreSyncError('Error syncing favorites:', error);
            },
        );

        return () => {
            unsubscribeMyStories();
            unsubscribeFeaturedStories();
            unsubscribeFavorites();
        };
    }, [user?.uid]);

    return { dreamsStore, feedStore };
}
