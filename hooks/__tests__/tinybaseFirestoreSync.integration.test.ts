import { act, renderHook } from '@testing-library/react-native';
import { useAuth } from '../useAuth';

type Constraint =
    | { type: 'where'; field: string; op: string; value: any }
    | { type: 'orderBy'; field: string; direction?: string }
    | { type: 'limit'; n: number };

type QueryRef = { ref: any; constraints: Constraint[] };
type CollectionRef = { type: 'collection'; path: string };
type DocRef = { type: 'doc'; collection: CollectionRef; id: string; key: string };

type StoryDoc = Record<string, any>;

const mockStoryDocs = new Map<string, StoryDoc>();
const mockSnapshotListeners = new Set<{
    query: QueryRef;
    onNext: (snapshot: any) => void;
    onError?: (error: unknown) => void;
}>();

let mockNextId = 1;

const mockMatchesQuery = (data: StoryDoc | undefined, query: QueryRef): boolean => {
    if (!data) return false;
    const constraints = Array.isArray(query?.constraints) ? query.constraints : [];
    for (const constraint of constraints) {
        if (constraint?.type === 'where') {
            if (constraint.op !== '==') continue;
            if (data[constraint.field] !== constraint.value) return false;
        }
    }
    return true;
};

const mockNotifyListeners = (
    changeType: 'added' | 'modified' | 'removed',
    docRef: DocRef,
    data: StoryDoc | undefined,
) => {
    for (const listener of mockSnapshotListeners) {
        if (listener.query?.ref?.path !== docRef.collection.path) continue;
        if (!mockMatchesQuery(data, listener.query)) continue;
        listener.onNext({
            docChanges: () => [{
                type: changeType,
                doc: {
                    id: docRef.id,
                    data: () => data,
                },
            }],
        });
    }
};

// Mock useAuth
jest.mock('../useAuth', () => ({
    useAuth: jest.fn(),
}));

// Mock lib/firebase Firestore instance
jest.mock('../../lib/firebase', () => ({
    firestore: {},
}));

jest.mock('@react-native-firebase/firestore', () => ({
    collection: (_db: any, path: string, ...pathSegments: string[]): CollectionRef => ({
        type: 'collection',
        path: [path, ...pathSegments].join('/'),
    }),
    doc: (collectionRef: CollectionRef, id?: string): DocRef => ({
        type: 'doc',
        collection: collectionRef,
        id: id || `doc_${mockNextId++}`,
        key: `${collectionRef.path}/${id || `doc_${mockNextId - 1}`}`,
    }),
    where: (field: string, op: string, value: any): Constraint => ({ type: 'where', field, op, value }),
    orderBy: (field: string, direction?: string): Constraint => ({ type: 'orderBy', field, direction }),
    limit: (n: number): Constraint => ({ type: 'limit', n }),
    query: (ref: any, ...constraints: Constraint[]): QueryRef => ({ ref, constraints }),
    onSnapshot: (queryOrCollection: any, onNext: (snapshot: any) => void, onError?: (error: unknown) => void) => {
        const queryRef: QueryRef = queryOrCollection?.constraints
            ? queryOrCollection
            : { ref: queryOrCollection, constraints: [] };
        const entry = { query: queryRef, onNext, onError };
        mockSnapshotListeners.add(entry);
        return () => mockSnapshotListeners.delete(entry);
    },
    setDoc: async (docRef: DocRef, data: StoryDoc, options?: { merge?: boolean }) => {
        const previous = mockStoryDocs.get(docRef.key);
        const next = options?.merge ? { ...(previous || {}), ...data } : data;
        mockStoryDocs.set(docRef.key, next);
        mockNotifyListeners(previous ? 'modified' : 'added', docRef, next);
    },
    deleteDoc: async (docRef: DocRef) => {
        const previous = mockStoryDocs.get(docRef.key);
        mockStoryDocs.delete(docRef.key);
        if (previous) mockNotifyListeners('removed', docRef, previous);
    },
}));

import { dreamsStore, feedStore, useStoreSync } from '../useStore';
import { useStories } from '../useStories';

describe('TinyBase ↔ Firestore sync (integration)', () => {
    const mockUser = { uid: 'test-user-id', displayName: 'Test User' };

    beforeEach(() => {
        jest.clearAllMocks();
        mockStoryDocs.clear();
        mockSnapshotListeners.clear();
        mockNextId = 1;
        dreamsStore.delTable('myStories');
        dreamsStore.delTable('favorites');
        feedStore.delTable('featuredStories');
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    });

    it('saves a story and receives it via snapshot sync', async () => {
        renderHook(() => useStoreSync());
        const { result } = renderHook(() => useStories());

        let storyId: string | undefined;
        await act(async () => {
            storyId = await result.current.saveStory({
                personaId: 'p1',
                personaName: 'Sage',
                title: 'Remixable Story',
                summary: 'A calm bedtime journey.',
                isPublic: false,
            });
        });

        expect(typeof storyId).toBe('string');
        expect(storyId).toBeTruthy();
        expect(dreamsStore.hasRow('myStories', storyId as string)).toBe(true);

        const row = dreamsStore.getRow('myStories', storyId as string);
        expect(row.title).toBe('Remixable Story');
        expect(row.userId).toBe(mockUser.uid);
        expect(result.current.myStories.some((story) => story.id === storyId)).toBe(true);
    });
});
