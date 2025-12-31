import { act, renderHook } from '@testing-library/react-native';
import { useAuth } from '../../useAuth';
import { useStoryCRUD } from '../useStoryCRUD';

jest.mock('../../useAuth', () => ({
    useAuth: jest.fn(),
}));

const mockShowToast = jest.fn();
jest.mock('../../../components/ErrorProvider', () => ({
    useOptionalError: () => ({ showToast: mockShowToast }),
}));

const mockSetRow = jest.fn();
const mockDelRow = jest.fn();
const mockHasRow = jest.fn();
const mockGetRow = jest.fn();
jest.mock('../../useStore', () => ({
    dreamsStore: {
        setRow: (...args: any[]) => mockSetRow(...args),
        delRow: (...args: any[]) => mockDelRow(...args),
        hasRow: (...args: any[]) => mockHasRow(...args),
        getRow: (...args: any[]) => mockGetRow(...args),
    },
}));

jest.mock('../../../lib/firebase', () => ({
    firestore: {},
}));

const mockCollection = jest.fn().mockReturnValue('storiesRef');
const mockDoc = jest.fn((...args: any[]) => ({ id: args[1] || 'new-id' }));
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
}));

describe('hooks/stories/useStoryCRUD', () => {
    const mockUser = { uid: 'test-user-id', displayName: 'Test User' };

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
        mockHasRow.mockReturnValue(true);
        mockGetRow.mockReturnValue({ id: '123', isFavorite: false });
        mockSetDoc.mockResolvedValue(undefined);
        mockDeleteDoc.mockResolvedValue(undefined);
    });

    it('throws if saving without user', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });
        const { result } = renderHook(() => useStoryCRUD());
        await act(async () => {
            await expect(result.current.saveStory({} as any)).rejects.toThrow('User must be authenticated');
        });
    });

    it('saves a new story and writes to Firestore', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        let storyId: any;
        await act(async () => {
            storyId = await result.current.saveStory({
                personaId: 'luna',
                personaName: 'Luna',
                title: 'New Story',
                summary: 'A short summary',
                isPublic: false,
            } as any);
        });

        expect(storyId).toBe('new-id');
        expect(mockSetRow).toHaveBeenCalledWith('myStories', 'new-id', expect.objectContaining({ id: 'new-id' }));
        expect(mockSetDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id' }), expect.any(Object));
    });

    it('toggles favorite for any story', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.toggleFavorite('s1', false);
        });

        expect(mockSetDoc).toHaveBeenCalled();
    });

    it('toggles favorite and persists to Firestore', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.toggleFavorite('123', false);
        });

        expect(mockSetRow).toHaveBeenCalledWith('favorites', '123', expect.any(Object));
        expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ likedAt: expect.any(Number) }), { merge: true });
    });

    it('updates story visibility and writes to Firestore', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.setStoryPublic('123', true);
        });

        expect(mockSetRow).toHaveBeenCalledWith('myStories', '123', expect.objectContaining({ id: '123', isPublic: true }));
        expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ isPublic: true }), { merge: true });
    });

    it('clears featured flag when making story private', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.setStoryPublic('123', false);
        });

        expect(mockSetDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ isPublic: false, isFeatured: false }),
            { merge: true }
        );
    });

    it('updates cover image and merges to Firestore', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.updateStoryCoverImage('123', 'https://cover.png');
        });

        expect(mockSetRow).toHaveBeenCalledWith('myStories', '123', expect.any(Object));
        expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ coverImageUrl: 'https://cover.png' }), { merge: true });
    });

    it('deletes story only for owned stories', async () => {
        mockHasRow.mockReturnValueOnce(false);
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.deleteStory('nope');
        });

        expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('deletes story and calls Firestore delete', async () => {
        const { result } = renderHook(() => useStoryCRUD());

        await act(async () => {
            await result.current.deleteStory('123');
        });

        expect(mockDelRow).toHaveBeenCalledWith('myStories', '123');
        expect(mockDeleteDoc).toHaveBeenCalled();
    });
});
