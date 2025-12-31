import { Platform } from 'react-native';

type CrashlyticsModule = typeof import('@react-native-firebase/crashlytics');
type CrashlyticsInstance = ReturnType<CrashlyticsModule['getCrashlytics']>;

let crashlyticsModule: CrashlyticsModule | null | undefined;

function getCrashlyticsModule(): CrashlyticsModule | null {
    if (crashlyticsModule !== undefined) return crashlyticsModule;

    if (Platform.OS === 'web') {
        crashlyticsModule = null;
        return crashlyticsModule;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        crashlyticsModule = require('@react-native-firebase/crashlytics') as CrashlyticsModule;
        return crashlyticsModule;
    } catch {
        crashlyticsModule = null;
        return crashlyticsModule;
    }
}

function getCrashlyticsInstance(): CrashlyticsInstance | null {
    const mod = getCrashlyticsModule();
    if (!mod) return null;
    return mod.getCrashlytics();
}

/**
 * Crashlytics Service for Storytime
 * Centralizes error reporting and stability monitoring.
 */
export const CrashlyticsService = {
    /**
     * Log a non-fatal error
     */
    logError: (error: Error, context?: string) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();

        if (context) {
            console.error(`[Crashlytics] ${context}: ${error.message}`);
        }

        if (!instance || !mod) return;

        if (context) {
            mod.log(instance, `Context: ${context}`);
        }
        mod.recordError(instance, error);
    },

    /**
     * Set attributes for the current session (e.g. active persona)
     */
    setPersonaContext: (personaId: string) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        mod.setAttributes(instance, {
            active_persona: personaId,
        });
    },

    /**
     * Explicitly enable/disable collection
     */
    setCollectionEnabled: async (enabled: boolean) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        await mod.setCrashlyticsCollectionEnabled(instance, enabled);
    },

    /**
     * Log a custom breadcrumb
     */
    logBreadcrumb: (message: string) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        mod.log(instance, message);
    },

    /**
     * Set the user ID for the current session
     */
    setUserId: (userId: string | null) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        mod.setUserId(instance, userId || '');
    },

    /**
     * Log a non-fatal error for testing
     */
    logNonFatal: (message: string) => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        const error = new Error(message);
        mod.recordError(instance, error);
    },

    /**
     * Force a native crash (use for testing only)
     */
    crash: () => {
        const instance = getCrashlyticsInstance();
        const mod = getCrashlyticsModule();
        if (!instance || !mod) return;

        mod.crash(instance);
    },
};
