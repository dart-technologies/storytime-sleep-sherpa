import type { ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

type GlassCardOptions = {
    borderRadius?: number;
    withShadow?: boolean;
    clip?: boolean;
};

export function createGlassCard(overrides: ViewStyle = {}, options: GlassCardOptions = {}): ViewStyle {
    const {
        borderRadius = Theme.glass.borderRadius,
        withShadow = true,
        clip = true,
    } = options;

    const base: ViewStyle = {
        borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
    };

    if (clip) {
        base.overflow = 'hidden';
    }

    if (withShadow) {
        Object.assign(base, Theme.shadow);
    }

    return { ...base, ...overrides };
}

export const overlayBadgeStyles = {
    container: createGlassCard(
        { backgroundColor: Theme.colors.atmosphereOverlay },
        { borderRadius: 16, withShadow: false }
    ),
    content: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 2,
        alignItems: 'flex-start',
    } satisfies ViewStyle,
} as const;

export const screenHeaderRow = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
} satisfies ViewStyle;
