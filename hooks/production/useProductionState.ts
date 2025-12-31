import { useCallback, useRef, useState } from 'react';
import type { ProductionPhase, ProductionState } from '../useStoryProduction';

export function useProductionState() {
    const [state, setState] = useState<ProductionState>({
        phase: 'idle',
        progress: 0,
        error: null,
        storyId: null,
        requestId: null,
    });

    const isCancelledRef = useRef(false);

    const setPhase = useCallback((phase: ProductionPhase, onPhaseChange?: (phase: ProductionPhase) => void) => {
        if (isCancelledRef.current) return;
        setState(prev => ({ ...prev, phase, error: null }));
        onPhaseChange?.(phase);
    }, []);

    const setRequestId = useCallback((requestId: string) => {
        if (isCancelledRef.current) return;
        const trimmed = String(requestId || '').trim();
        setState(prev => ({ ...prev, requestId: trimmed || null }));
    }, []);

    const markCompleted = useCallback((storyId: string) => {
        setState(prev => ({ ...prev, storyId, phase: 'completed' }));
    }, []);

    const markError = useCallback((message: string) => {
        setState(prev => ({ ...prev, phase: 'error', error: message }));
    }, []);

    const cancel = useCallback(() => {
        isCancelledRef.current = true;
        setState(prev => ({ ...prev, phase: 'idle', error: 'Cancelled', requestId: null }));
    }, []);

    const reset = useCallback(() => {
        isCancelledRef.current = false;
        setState({ phase: 'idle', progress: 0, error: null, storyId: null, requestId: null });
    }, []);

    return {
        state,
        setState,
        isCancelledRef,
        setPhase,
        setRequestId,
        markCompleted,
        markError,
        cancel,
        reset,
    };
}
