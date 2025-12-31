import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../constants/Theme';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Theme.spacing.xl,
        backgroundColor: Theme.colors.background,
    },
    card: {
        width: '100%',
        maxWidth: 720,
        padding: Theme.spacing.xl,
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.glass.borderColor,
        backgroundColor: Theme.glass.backgroundColor,
    },
    title: {
        fontSize: 32,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        textAlign: 'center',
        marginBottom: Theme.spacing.md,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default function WebHome() {
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Storytime</Text>
                <Text style={styles.subtitle}>
                    Open a shared Storytime link to listen to a sleep story in your browser.
                </Text>
            </View>
        </View>
    );
}
