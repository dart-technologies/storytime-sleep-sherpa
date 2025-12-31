import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../lib/firebase';
import { ensureUserTimeZone, fetchDailyCreateState, incrementDailyCreateCount, type DailyCreateState } from '../lib/dailyCreateCap';

type State =
    | { status: 'loading' }
    | { status: 'loaded'; data: DailyCreateState }
    | { status: 'error'; message: string };

export function useDailyCreateCap() {
    const [state, setState] = useState<State>({ status: 'loading' });
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            setState({
                status: 'loaded',
                data: {
                    timeZone: null,
                    todayKey: '',
                    countToday: 0,
                    limit: 1,
                    remaining: 1,
                },
            });
            return;
        }

        setState({ status: 'loading' });
        try {
            await ensureUserTimeZone(uid);
            const data = await fetchDailyCreateState(uid);
            if (!mountedRef.current) return;
            setState({ status: 'loaded', data });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!mountedRef.current) return;
            setState({ status: 'error', message: message || 'Could not load daily cap.' });
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const increment = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const next = await incrementDailyCreateCount(uid);
        if (!mountedRef.current) return;
        setState({ status: 'loaded', data: next });
    }, []);

    const data = useMemo(() => {
        if (state.status === 'loaded') return state.data;
        if (state.status === 'loading') {
            return {
                timeZone: null,
                todayKey: '',
                countToday: 0,
                limit: 1,
                remaining: 1,
            };
        }
        return {
            timeZone: null,
            todayKey: '',
            countToday: 0,
            limit: 1,
            remaining: 1,
        };
    }, [state]);

    return useMemo(() => ({
        ...data,
        loading: state.status === 'loading',
        error: state.status === 'error' ? state.message : null,
        refresh,
        increment,
    }), [data, refresh, increment, state]);
}
