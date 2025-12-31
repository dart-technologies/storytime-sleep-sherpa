import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../constants/Theme';

export type TabHeaderProps = {
    title: string;
    subtitle?: string;
    inset?: 'screen' | 'none';
    left?: React.ReactNode;
    right?: React.ReactNode;
    children?: React.ReactNode;
};

export function TabHeader({
    title,
    subtitle,
    inset = 'screen',
    left,
    right,
    children,
}: TabHeaderProps) {
    return (
        <View style={[styles.container, inset === 'screen' ? styles.containerInset : null]}>
            <View style={styles.titleRow}>
                {left ? <View style={styles.left}>{left}</View> : null}
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                {right ? <View style={styles.right}>{right}</View> : null}
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children ? <View style={styles.children}>{children}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: Theme.spacing.lg,
        paddingBottom: Theme.spacing.md,
    },
    containerInset: {
        paddingHorizontal: Theme.spacing.lg,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    title: {
        flex: 1,
        fontSize: 34,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: Theme.colors.textMuted,
        marginTop: Theme.spacing.xs,
        fontWeight: Theme.typography.weights.secondary,
    },
    left: {
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    right: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    children: {
        marginTop: Theme.spacing.md,
    },
});
