import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Theme } from '../constants/Theme';
import { CrashlyticsService } from '../services/crashlytics';

// Global error handler for unhandled JS exceptions
if (typeof ErrorUtils !== 'undefined') {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
        CrashlyticsService.logError(error, `GlobalHandler: ${isFatal ? 'Fatal' : 'Non-Fatal'}`);
        if (defaultHandler) {
            defaultHandler(error, isFatal);
        }
    });
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Theme.colors.background },
                }}
            />
            <StatusBar style="light" />
        </SafeAreaProvider>
    );
}
