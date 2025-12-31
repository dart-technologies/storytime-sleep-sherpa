import { registerGlobals } from '@livekit/react-native';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from '../components/AppProviders';
import { Theme } from '../constants/Theme';
import { useAuth } from '../hooks/useAuth';
import { getAllPersonaAssets } from '../lib/assetMapper';
import { installLiveKitWorkarounds } from '../lib/livekitWorkarounds';

registerGlobals({ autoConfigureAudioSession: false });
installLiveKitWorkarounds();

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: Theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default function RootLayout() {
    const { user, loading } = useAuth();
    const [assetsLoading, setAssetsLoading] = useState(true);

    useEffect(() => {
        async function loadAssets() {
            try {
                const assets = getAllPersonaAssets();
                await Asset.loadAsync(assets);
            } catch (e) {
                console.warn('Failed to pre-load assets:', e);
            } finally {
                setAssetsLoading(false);
            }
        }
        loadAssets();
    }, []);

    if (loading || assetsLoading) {
        return (
            <SafeAreaProvider>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Theme.colors.white} />
                </View>
                <StatusBar style="light" />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <AppProviders>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        animation: 'fade',
                        animationDuration: Theme.motion.duration.medium,
                        contentStyle: { backgroundColor: Theme.colors.background },
                    }}
                >
                    {!user ? (
                        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                    ) : (
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    )}
                </Stack>
            </AppProviders>
            <StatusBar style="light" />
        </SafeAreaProvider>
    );
}
