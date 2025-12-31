import { renderHook } from '@testing-library/react-native';
import { useAuth } from '../useAuth';
import { dreamsStore, feedStore, useStoreSync } from '../useStore';

// Mock useAuth
jest.mock('../useAuth', () => ({
    useAuth: jest.fn(),
}));

// Mock lib/firebase Firestore instance
jest.mock('../../lib/firebase', () => ({
    firestore: {},
}));

// Mock Firestore (modular)
const mockOnSnapshot = jest.fn();
const mockUnsubscribe = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

mockCollection.mockReturnValue('storiesRef');
mockQuery.mockImplementation((ref, ...constraints) => ({ ref, constraints }));
mockWhere.mockImplementation((field, op, value) => ({ field, op, value }));
mockOrderBy.mockImplementation((field, direction) => ({ field, direction }));
mockLimit.mockImplementation((n) => ({ n }));
mockOnSnapshot.mockReturnValue(mockUnsubscribe);

jest.mock('@react-native-firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

describe('useStoreSync', () => {
    const mockUser = { uid: 'test-user-id' };

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
        // Clear the partitioned stores between tests
        dreamsStore.delTable('myStories');
        dreamsStore.delTable('favorites');
        feedStore.delTable('featuredStories');
    });

    it('should subscribe to firestore when user is authenticated', () => {
        renderHook(() => useStoreSync());

        expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'stories');
        expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users', mockUser.uid, 'favorites');
        expect(mockOrderBy).toHaveBeenCalledWith('playCount', 'desc');
        expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
    });

    it('should unsubscribe on unmount', () => {
        const { unmount } = renderHook(() => useStoreSync());
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
    });

    it('should update store when snapshot changes', () => {
        const snapshotCallbacks: any[] = [];
        mockOnSnapshot.mockImplementation((_query, onNext) => {
            snapshotCallbacks.push(onNext);
            return mockUnsubscribe;
        });

        renderHook(() => useStoreSync());

        expect(snapshotCallbacks).toHaveLength(3);

        const mockDoc = {
            id: 'doc-1',
            data: () => ({
                title: 'Test Story',
                userId: 'test-user-id',
                createdAt: 123456789,
                complex: { key: 'value' },
            }),
        };

        const mockSnapshot = {
            docChanges: () => [{ type: 'added', doc: mockDoc }],
        };

        // Trigger the myStories callback
        snapshotCallbacks[1](mockSnapshot);
        const myStories = dreamsStore.getTable('myStories');
        expect(myStories['doc-1']).toBeDefined();
        expect(myStories['doc-1'].title).toBe('Test Story');

        // Trigger the featuredStories callback
        snapshotCallbacks[0](mockSnapshot);
        const featuredStories = feedStore.getTable('featuredStories');
        expect(featuredStories['doc-1']).toBeDefined();

        // Trigger the favorites callback
        snapshotCallbacks[2](mockSnapshot);
        const favorites = dreamsStore.getTable('favorites');
        expect(favorites['doc-1']).toBeDefined();
    });

    it('should remove rows when documents are removed', () => {
        const snapshotCallbacks: any[] = [];
        mockOnSnapshot.mockImplementation((_query, onNext) => {
            snapshotCallbacks.push(onNext);
            return mockUnsubscribe;
        });

        renderHook(() => useStoreSync());
        expect(snapshotCallbacks).toHaveLength(3);

        const mockDoc = {
            id: 'doc-1',
            data: () => ({ title: 'Test Story' }),
        };

        snapshotCallbacks[1]({ docChanges: () => [{ type: 'added', doc: mockDoc }] });
        expect(dreamsStore.hasRow('myStories', 'doc-1')).toBe(true);

        snapshotCallbacks[1]({ docChanges: () => [{ type: 'removed', doc: mockDoc }] });
        expect(dreamsStore.hasRow('myStories', 'doc-1')).toBe(false);
    });

    it('should subscribe only to featured stories when user is not authenticated', () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });
        renderHook(() => useStoreSync());

        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });
});
