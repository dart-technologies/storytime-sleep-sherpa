import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearOfflineFavoritesAudioCache } from '../../lib/audioCache';
import {
    getOfflineFavoritesDownloadsEnabled,
    setOfflineFavoritesDownloadsEnabled,
    subscribeOfflineFavoritesDownloadsEnabled,
} from '../../lib/offlineFavoritesDownloads';

export function useOfflineFavoritesDownloadsEnabled() {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        void getOfflineFavoritesDownloadsEnabled()
            .then((value) => {
                if (!mounted) return;
                setEnabled(value);
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        const unsubscribe = subscribeOfflineFavoritesDownloadsEnabled((value) => {
            if (!mounted) return;
            setEnabled(value);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const update = useCallback(async (next: boolean) => {
        setEnabled(next);
        if (!next) {
            await clearOfflineFavoritesAudioCache();
        }
        await setOfflineFavoritesDownloadsEnabled(next);
    }, []);

    return useMemo(() => ({
        enabled,
        loading,
        setEnabled: update,
    }), [enabled, loading, update]);
}
