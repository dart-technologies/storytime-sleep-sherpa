import * as Updates from 'expo-updates';
import React, { useEffect } from 'react';
import { useOfflineFavoritesAutoDownload } from '../hooks/offline/useOfflineFavoritesAutoDownload';
import { useStoreSync } from '../hooks/useStore';
import { getPublicEnvBool } from '../lib/env';
import { ElevenLabsProvider } from '../lib/elevenlabs';
import { AudioProvider } from './AudioProvider';
import ConnectivityBanner from './ConnectivityBanner';
import EnvValidator from './EnvValidator';
import { ElevenLabsConversationProvider } from './ElevenLabsConversationProvider';
import { ErrorProvider, useError } from './ErrorProvider';

function UpdateHandler() {
    const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
    const { showToast } = useError();

    useEffect(() => {
        if (isUpdateAvailable) {
            showToast({ message: 'A new update is available. Downloading...', type: 'info' });
        }
        if (isUpdatePending) {
            showToast({ message: 'Update installed. Restart to apply.', type: 'success' });
        }
    }, [isUpdateAvailable, isUpdatePending, showToast]);

    return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
    useStoreSync();
    useOfflineFavoritesAutoDownload();
    const allowMixingWithOthers = getPublicEnvBool('EXPO_PUBLIC_ELEVENLABS_ALLOW_MIXING_WITH_OTHERS', false);
    return (
        <ErrorProvider>
            <UpdateHandler />
            <EnvValidator />
            <ConnectivityBanner />
            <AudioProvider>
                <ElevenLabsProvider audioSessionConfig={{ allowMixingWithOthers }}>
                    <ElevenLabsConversationProvider>
                        {children}
                    </ElevenLabsConversationProvider>
                </ElevenLabsProvider>
            </AudioProvider>
        </ErrorProvider>
    );
}
