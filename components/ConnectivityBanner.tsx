import { BlurView } from 'expo-blur';
import * as Network from 'expo-network';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { Theme } from '../constants/Theme';

export default function ConnectivityBanner() {
    const networkState = Network.useNetworkState();
    const isConnected = networkState.isInternetReachable ?? networkState.isConnected ?? true;

    if (isConnected) return null;

    return (
        <Animated.View
            entering={SlideInUp.duration(Theme.motion.duration.slow)}
            exiting={SlideOutUp.duration(Theme.motion.duration.slow)}
            style={styles.container}
        >
            <BlurView intensity={Theme.blur.tabBar} tint="dark" style={styles.blur}>
                <View style={styles.content}>
                    <View style={styles.indicator} />
                    <Text style={styles.text}>Offline Mode</Text>
                    <Text style={styles.subtext}>Some features may be unavailable</Text>
                </View>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        paddingTop: 40, // Status bar height approx
    },
    blur: {
        backgroundColor: Theme.colors.errorBanner,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.errorBorderSoft,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Theme.colors.error,
    },
    text: {
        color: Theme.colors.white,
        fontWeight: 'bold',
        fontSize: 14,
    },
    subtext: {
        color: Theme.colors.textMuted,
        fontSize: 12,
    }
});
