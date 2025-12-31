import { StyleSheet } from 'react-native';
import { Theme } from '../../constants/Theme';
import { createGlassCard, screenHeaderRow } from './sharedStyles';

export const playbackStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    safeArea: {
        flex: 1,
    },
    header: screenHeaderRow,
    headerTitle: {
        color: Theme.colors.white,
        fontSize: 17,
        fontWeight: Theme.typography.weights.bold,
        opacity: 0.9,
        flex: 1,
        flexShrink: 1,
        textAlign: 'center',
        marginHorizontal: Theme.spacing.sm,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRightSpacer: {
        width: 32,
        height: 32,
    },
    body: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Theme.spacing.lg,
        paddingTop: Theme.spacing.sm,
        paddingBottom: Theme.spacing.md,
    },
    artworkContainer: {
        position: 'relative',
        marginBottom: Theme.spacing.lg,
    },
    artwork: createGlassCard({
        width: 320,
        height: 320,
        backgroundColor: Theme.colors.glass,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    artworkGlowFrame: {
        position: 'absolute',
        top: -14,
        left: -14,
        right: -14,
        bottom: -14,
        borderRadius: Theme.glass.borderRadius + 14,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
    },
    personaAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: Theme.glass.borderRadius,
        opacity: 0.8,
    },
    transitionCover: createGlassCard({ position: 'absolute' }, { withShadow: false, clip: false }),
    artworkText: {
        color: Theme.colors.white,
        fontSize: 100,
        fontWeight: Theme.typography.weights.bold,
        opacity: 0.1,
    },
    storyTitle: {
        color: Theme.colors.white,
        fontSize: 28,
        fontWeight: Theme.typography.weights.black,
        textAlign: 'center',
        marginBottom: Theme.spacing.xl,
        letterSpacing: -0.5,
    },
    summaryRow: createGlassCard(
        {
            width: '100%',
            maxWidth: 520,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.md,
            marginTop: Theme.spacing.md,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            backgroundColor: Theme.colors.glassSubtle,
        },
        { withShadow: false }
    ),
    summaryAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    summaryAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryAvatarText: {
        color: Theme.colors.textMuted,
        fontSize: 14,
        fontWeight: Theme.typography.weights.primary,
    },
    summary: {
        flex: 1,
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.base,
        lineHeight: 24,
        textAlign: 'left',
        fontWeight: Theme.typography.weights.secondary,
    },
    footer: {
        paddingHorizontal: Theme.spacing.lg,
        paddingBottom: Theme.spacing.lg,
        paddingTop: Theme.spacing.md,
        alignItems: 'center',
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 520,
        overflow: 'visible',
        position: 'relative',
    },
    playButtonShadow: {
        width: 152,
        height: 152,
        borderRadius: 76,
        ...Theme.shadow,
    },
    playButtonShadowActive: {
        shadowColor: Theme.colors.primary,
        shadowOpacity: 0.6,
    },
    playButton: createGlassCard(
        {
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
        },
        { borderRadius: 76, withShadow: false }
    ),
    playButtonActive: {
        borderColor: Theme.colors.primary,
    },
    playButtonBackdrop: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 76,
        overflow: 'hidden',
    },
    playButtonTint: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 76,
        backgroundColor: Theme.colors.glassStrong,
    },
    playButtonInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    },
    playButtonContentFrame: {
        width: 122,
        height: 122,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    playButtonContentOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waveformButtonContent: {
        transform: [{ scale: 1.0 }],
    },
    playButtonDisabled: {
        opacity: 0.5,
    },
    moreButtonContainer: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingRight: Theme.spacing.xs,
    },
    moreButton: createGlassCard(
        {
            width: 46,
            height: 46,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
        },
        { borderRadius: 23, withShadow: false }
    ),
    moreButtonBackdrop: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 23,
        overflow: 'hidden',
    },
    moreButtonTint: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 23,
        backgroundColor: Theme.colors.glass,
    },
    moreSheetRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        justifyContent: 'flex-end',
    },
    moreSheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Theme.colors.scrim,
    },
    moreSheetCard: createGlassCard(
        {
            marginHorizontal: Theme.spacing.md,
            marginBottom: Theme.spacing.md,
        },
        { withShadow: false }
    ),
    moreSheetContent: {
        padding: Theme.spacing.lg,
    },
    moreSheetHandle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.7,
        alignSelf: 'center',
        marginBottom: Theme.spacing.md,
    },
    moreSheetTitle: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.extraBold,
        textAlign: 'center',
    },
    moreSheetMeta: {
        marginTop: Theme.spacing.sm,
        color: Theme.colors.textMuted,
        fontSize: 13,
        fontWeight: Theme.typography.weights.semibold,
        textAlign: 'center',
        lineHeight: 18,
    },
    moreSheetMetaLine2: {
        marginTop: 6,
    },
    moreSheetStatsRow: createGlassCard(
        {
            flexDirection: 'row',
            alignItems: 'stretch',
            backgroundColor: Theme.colors.glassSubtle,
            marginTop: Theme.spacing.md,
        },
        { withShadow: false }
    ),
    moreSheetStatItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.md,
        gap: Theme.spacing.sm,
    },
    moreSheetStatValue: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.base,
        fontWeight: Theme.typography.weights.primary,
    },
    moreSheetStatDivider: {
        width: 1,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.7,
    },
    moreSheetToggleRow: createGlassCard(
        {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Theme.spacing.sm,
            backgroundColor: Theme.colors.glassSubtle,
            marginTop: Theme.spacing.md,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
        },
        { withShadow: false }
    ),
    moreSheetToggleSwitch: {
        transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
    },
    moreSheetActionsRow: {
        marginTop: Theme.spacing.md,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
    },
    moreSheetActionIconButton: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreSheetActionIconButtonDestructive: {
        backgroundColor: Theme.colors.errorWash,
        borderColor: Theme.colors.errorBorderSoft,
    },
    moreSheetActionIconButtonDisabled: {
        opacity: 0.5,
    },
    controlButton: {
        opacity: 0.7,
    },
    errorText: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        textAlign: 'center',
        marginTop: 100,
    },
});
