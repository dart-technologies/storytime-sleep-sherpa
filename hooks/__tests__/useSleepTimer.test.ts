import { renderHook, act } from '@testing-library/react-native';
import { useSleepTimer } from '../useSleepTimer';

// Mock NodeJS.Timeout
jest.useFakeTimers();

describe('useSleepTimer', () => {
    let mockPlayer: any;

    beforeEach(() => {
        mockPlayer = {
            volume: 1.0,
            pause: jest.fn(),
            play: jest.fn(),
        };
    });

    it('should initialize with null timeLeft and isActive false', () => {
        const { result } = renderHook(() => useSleepTimer(null));
        expect(result.current.timeLeft).toBe(null);
        expect(result.current.isActive).toBe(false);
    });

    it('should start timer with specified minutes', () => {
        const { result } = renderHook(() => useSleepTimer(mockPlayer));

        act(() => {
            result.current.startTimer(10);
        });

        expect(result.current.timeLeft).toBe(600);
        expect(result.current.isActive).toBe(true);
        expect(result.current.minutesLeft).toBe(10);
    });

    it('should decrement time every second', () => {
        const { result } = renderHook(() => useSleepTimer(mockPlayer));

        act(() => {
            result.current.startTimer(1);
        });

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.timeLeft).toBe(59);
    });

    it('should pause player and stop timer when time reaches 0', () => {
        const { result } = renderHook(() => useSleepTimer(mockPlayer));

        act(() => {
            result.current.startTimer(1); // 60 seconds
        });

        act(() => {
            jest.advanceTimersByTime(60000);
        });

        expect(result.current.timeLeft).toBe(null);
        expect(result.current.isActive).toBe(false);
        expect(mockPlayer.pause).toHaveBeenCalled();
    });

    it('should fade volume in the last 60 seconds', () => {
        const { result } = renderHook(() => useSleepTimer(mockPlayer));

        act(() => {
            result.current.startTimer(1); // 60 seconds
        });

        // Advance 30 seconds, volume should be 0.5 (30/60 * 1.0)
        act(() => {
            jest.advanceTimersByTime(30000);
        });

        expect(result.current.timeLeft).toBe(30);
        expect(mockPlayer.volume).toBeCloseTo(0.5);

        // Advance 15 more seconds (45 total), volume should be 0.25 (15/60 * 1.0)
        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(result.current.timeLeft).toBe(15);
        expect(mockPlayer.volume).toBeCloseTo(0.25);
    });

    it('should stop timer manually', () => {
        const { result } = renderHook(() => useSleepTimer(mockPlayer));

        act(() => {
            result.current.startTimer(10);
        });

        act(() => {
            result.current.stopTimer();
        });

        expect(result.current.timeLeft).toBe(null);
        expect(result.current.isActive).toBe(false);
    });
});
