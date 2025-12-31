import { act, renderHook } from '@testing-library/react-native';
import { usePerformanceOptimization } from '../usePerformanceOptimization';

describe('hooks/usePerformanceOptimization', () => {
    it('toggles low energy mode and updates complexity level', () => {
        const { result } = renderHook(() => usePerformanceOptimization());

        expect(result.current.isLowEnergyMode).toBe(false);
        expect(result.current.complexityLevel).toBe('full');

        act(() => {
            result.current.toggleLowEnergyMode();
        });

        expect(result.current.isLowEnergyMode).toBe(true);
        expect(result.current.complexityLevel).toBe('minimal');

        act(() => {
            result.current.toggleLowEnergyMode();
        });

        expect(result.current.isLowEnergyMode).toBe(false);
        expect(result.current.complexityLevel).toBe('full');
    });
});

