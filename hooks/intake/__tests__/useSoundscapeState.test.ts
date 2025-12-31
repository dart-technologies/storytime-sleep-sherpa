import { act, renderHook, waitFor } from '@testing-library/react-native';
import { personas } from '../../../lib/personas';
import { useSoundscapeState } from '../useSoundscapeState';

const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: (...args: any[]) => mockImpactAsync(...args),
    ImpactFeedbackStyle: { Light: 'Light' },
}));

const mockGetDefaultSoundscapeId = jest.fn(() => 'falling-snow');
const mockGetSoundscapeAsset = jest.fn((_id: string) => 123);
jest.mock('../../../lib/assetMapper', () => ({
    getDefaultSoundscapeId: () => mockGetDefaultSoundscapeId(),
    getSoundscapeAsset: (id: string) => mockGetSoundscapeAsset(id),
}));

describe('hooks/intake/useSoundscapeState', () => {
    const persona = personas.find((p) => p.id === 'luna') || personas[0];

    const setAmbientSound = jest.fn();
    const pauseAmbient = jest.fn();
    const resumeAmbient = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetDefaultSoundscapeId.mockReturnValue('falling-snow');
        mockGetSoundscapeAsset.mockReturnValue(456);
    });

    it('sets default soundscape and ambient sound for persona', async () => {
        const { result } = renderHook(() => useSoundscapeState({
            persona,
            isSessionActive: false,
            setAmbientSound,
            pauseAmbient,
            resumeAmbient,
        }));

        await waitFor(() => {
            expect(result.current.soundscapeId).toBe('falling-snow');
        });

        expect(setAmbientSound).toHaveBeenCalledWith(456);
        expect(result.current.isSoundscapeEnabled).toBe(true);
    });

    it('pauses and resumes ambient sound around voice sessions', async () => {
        const { rerender } = renderHook((props: { active: boolean }) => useSoundscapeState({
            persona,
            isSessionActive: props.active,
            setAmbientSound,
            pauseAmbient,
            resumeAmbient,
        }), { initialProps: { active: false } });

        rerender({ active: true });
        await waitFor(() => expect(pauseAmbient).toHaveBeenCalled());

        rerender({ active: false });
        await waitFor(() => expect(resumeAmbient).toHaveBeenCalled());
    });

    it('allows selecting and disabling soundscapes', async () => {
        const { result } = renderHook(() => useSoundscapeState({
            persona,
            isSessionActive: false,
            setAmbientSound,
            pauseAmbient,
            resumeAmbient,
        }));

        act(() => {
            result.current.handleSelectSoundscape('crackling-fireplace' as any);
        });

        expect(mockImpactAsync).toHaveBeenCalled();
        expect(setAmbientSound).toHaveBeenCalledWith(456);
        expect(result.current.soundscapeId).toBe('crackling-fireplace');
        expect(result.current.isSoundscapeEnabled).toBe(true);

        act(() => {
            result.current.handleDisableSoundscape();
        });

        expect(setAmbientSound).toHaveBeenCalledWith(null);
        expect(result.current.isSoundscapeEnabled).toBe(false);
    });

    it('toggles the soundscape menu', () => {
        const { result } = renderHook(() => useSoundscapeState({
            persona,
            isSessionActive: false,
            setAmbientSound,
            pauseAmbient,
            resumeAmbient,
        }));

        act(() => {
            result.current.toggleSoundscapeMenu();
        });
        expect(result.current.isSoundscapeMenuOpen).toBe(true);

        act(() => {
            result.current.closeSoundscapeMenu();
        });
        expect(result.current.isSoundscapeMenuOpen).toBe(false);
    });
});
