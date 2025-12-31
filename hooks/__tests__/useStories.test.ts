import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../useAuth';
import { useStories } from '../useStories';

const mockShowToast = jest.fn();
jest.mock('../../components/ErrorProvider', () => ({
    useOptionalError: () => ({ showToast: (...args: any[]) => mockShowToast(...args) }),
}));

// Mock useAuth
jest.mock('../useAuth', () => ({
    useAuth: jest.fn(),
}));

// Mock useStore
jest.mock('../useStore', () => ({
    useDreamsTable: jest.fn(),
    dreamsStore: {
        setRow: jest.fn(),
        delRow: jest.fn(),
        getTable: jest.fn(() => ({})),
        hasRow: jest.fn((tableId: string, rowId: string) => tableId === 'myStories' && rowId === '123'),
        getRow: jest.fn(() => ({ id: '123', isFavorite: false })),
    },
    feedStore: {
        setRow: jest.fn(),
        delRow: jest.fn(),
        getTable: jest.fn(() => ({})),
    },
}));

import { useTable } from 'tinybase/ui-react';
import { dreamsStore, feedStore, useDreamsTable } from '../useStore';

// Mock tinybase UI
jest.mock('tinybase/ui-react', () => ({
    useTable: jest.fn(),
}));

// Mock lib/firebase Firestore instance
jest.mock('../../lib/firebase', () => ({
    firestore: {},
}));

// Mock Firebase Firestore (modular)
const mockCollection = jest.fn().mockReturnValue('storiesRef');
const mockDoc = jest.fn().mockReturnValue({ id: 'new-id' });
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn((...args: any[]) => args);
const mockWhere = jest.fn((...args: any[]) => args);
const mockOrderBy = jest.fn((...args: any[]) => args);
const mockLimit = jest.fn((...args: any[]) => args);

jest.mock('@react-native-firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
}));

describe('useStories', () => {
    const mockUser = { uid: 'test-user-id', displayName: 'Test User' };

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
        mockGetDocs.mockReset();
    });

    it('should return my stories from the store', () => {
        const mockStories = [
            { id: '1', title: 'Story 1', summary: 'A short summary', narrative: '...', userId: 'test-user-id' },
        ];

        // Setup useDreamsTable to return our mock stories for 'myStories'
        (useDreamsTable as jest.Mock).mockImplementation((tableId: string) => {
            if (tableId === 'myStories') return { '1': mockStories[0] };
            return {};
        });

        // Mock useTable for public stories
        (useTable as jest.Mock).mockReturnValue({});

        const { result } = renderHook(() => useStories());

        expect(result.current.myStories).toHaveLength(1);
        expect(result.current.myStories[0].title).toBe('Story 1');
    });

    it('should save a new story', async () => {
        const storyData = {
            personaId: 'agent-1',
            personaName: 'Agent 1',
            title: 'New Story',
            summary: 'A short summary',
            isPublic: false,
        };

        mockSetDoc.mockResolvedValueOnce(undefined);
        (useDreamsTable as jest.Mock).mockReturnValue({});
        (useTable as jest.Mock).mockReturnValue({});

        const { result } = renderHook(() => useStories());

        let newId;
        await act(async () => {
            newId = await result.current.saveStory(storyData);
        });

        expect(newId).toBe('new-id');
        expect(mockSetDoc).toHaveBeenCalledWith({ id: 'new-id' }, expect.objectContaining({
            userId: mockUser.uid,
            title: 'New Story',
        }));
    });

    it('should throw error if saving without user', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });
        const { result } = renderHook(() => useStories());

        await act(async () => {
            await expect(result.current.saveStory({} as any)).rejects.toThrow('User must be authenticated');
        });
    });

    it('should handle Firestore save error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        mockSetDoc.mockRejectedValueOnce(new Error('Firestore Error'));
        const { result } = renderHook(() => useStories());

        await act(async () => {
            await expect(result.current.saveStory({} as any)).rejects.toThrow('Firestore Error');
        });

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('should toggle favorite', async () => {
        const { result } = renderHook(() => useStories());

        await act(async () => {
            await result.current.toggleFavorite('123', false);
        });

        expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ likedAt: expect.any(Number) }), { merge: true });
    });

    it('refreshes my stories, featured stories, and favorites', async () => {
        (useDreamsTable as jest.Mock).mockReturnValue({});
        (useTable as jest.Mock).mockReturnValue({});

        mockGetDocs
            .mockResolvedValueOnce({
                docs: [{ id: 'my-1', data: () => ({ title: 'Mine', createdAt: 1 }) }],
            })
            .mockResolvedValueOnce({
                docs: [{ id: 'feat-1', data: () => ({ title: 'Featured', playCount: 10, createdAt: 2 }) }],
            })
            .mockResolvedValueOnce({
                docs: [{ id: 'my-1', data: () => ({ likedAt: 123 }) }],
            });

        const { result } = renderHook(() => useStories());

        act(() => {
            result.current.refresh();
        });

        await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(3));
        await waitFor(() => expect((dreamsStore.setRow as jest.Mock)).toHaveBeenCalledWith('myStories', 'my-1', expect.any(Object)));
        await waitFor(() => expect((feedStore.setRow as jest.Mock)).toHaveBeenCalledWith('featuredStories', 'feat-1', expect.any(Object)));
        await waitFor(() => expect((dreamsStore.setRow as jest.Mock)).toHaveBeenCalledWith('favorites', 'my-1', expect.any(Object)));
    });

    it('falls back when the featured query requires an index', async () => {
        (useDreamsTable as jest.Mock).mockReturnValue({});
        (useTable as jest.Mock).mockReturnValue({});

        mockGetDocs
            .mockResolvedValueOnce({ docs: [] })
            .mockRejectedValueOnce(Object.assign(new Error('requires an index'), { code: 'firestore/failed-precondition' }))
            .mockResolvedValueOnce({ docs: [{ id: 'feat-1', data: () => ({ title: 'Fallback', createdAt: 1 }) }] })
            .mockResolvedValueOnce({ docs: [] });

        const { result } = renderHook(() => useStories());

        act(() => {
            result.current.refresh();
        });

        await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(4));
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    });

    it('surfaces refresh errors', async () => {
        (useDreamsTable as jest.Mock).mockReturnValue({});
        (useTable as jest.Mock).mockReturnValue({});

        mockGetDocs.mockRejectedValueOnce(new Error('boom'));

        const { result } = renderHook(() => useStories());

        act(() => {
            result.current.refresh();
        });

        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    });
});
