import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Theme } from '../constants/Theme';

const DEFAULT_TOAST_DURATION_MS = Theme.motion.duration.toastHold + Theme.motion.duration.toast * 2;

interface ToastOptions {
    message: string;
    type?: 'error' | 'info' | 'success';
    duration?: number;
}

interface ErrorContextType {
    showToast: (options: ToastOptions) => void;
    clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastOptions | null>(null);

    const showToast = useCallback(({ message, type = 'error', duration = DEFAULT_TOAST_DURATION_MS }: ToastOptions) => {
        setToast({ message, type, duration });

        // Use a simple fade for now, will integrate Reanimated/EtherealToast component later
    }, []);

    const clearError = useCallback(() => {
        setToast(null);
    }, []);

    const value = useMemo(() => ({
        showToast,
        clearError,
    }), [showToast, clearError]);

    return (
        <ErrorContext.Provider value={value}>
            {children}
            {toast && (
                <EtherealToast
                    message={toast.message}
                    type={toast.type}
                    durationMs={toast.duration ?? DEFAULT_TOAST_DURATION_MS}
                    onDismiss={clearError}
                />
            )}
        </ErrorContext.Provider>
    );
}

// Internal Toast Component for Phase 12 implementation
function EtherealToast({ message, type = 'error', durationMs, onDismiss }: { message: string; type?: string; durationMs: number; onDismiss: () => void }) {
    const opacity = useMemo(() => new Animated.Value(0), []);

    React.useEffect(() => {
        const fadeMs = Theme.motion.duration.toast;
        const holdMs = Math.max(0, durationMs - fadeMs * 2);
        Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: fadeMs, useNativeDriver: true }),
            Animated.delay(holdMs),
            Animated.timing(opacity, { toValue: 0, duration: fadeMs, useNativeDriver: true }),
        ]).start(() => onDismiss());
    }, [durationMs, onDismiss, opacity]);

    return (
        <Animated.View style={[styles.toastContainer, { opacity, backgroundColor: type === 'error' ? Theme.colors.errorScrim : Theme.colors.surface }]}>
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        padding: 16,
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        ...Theme.shadow,
        zIndex: 9999,
    },
    toastText: {
        color: Theme.colors.text,
        fontSize: 14,
        textAlign: 'center',
        fontFamily: 'System',
    },
});

export function useError() {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
}

export function useOptionalError() {
    return useContext(ErrorContext);
}
