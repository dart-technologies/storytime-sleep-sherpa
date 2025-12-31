import { StyleSheet } from 'react-native';
import { Theme } from '../../constants/Theme';
import { createGlassCard, overlayBadgeStyles } from './sharedStyles';

export const libraryStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: Theme.spacing.lg,
        paddingBottom: Theme.spacing.md,
    },
    title: {
        fontSize: 34,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        marginBottom: Theme.spacing.lg,
        letterSpacing: -0.5,
    },
    chaosBadge: {
        color: Theme.colors.error,
        fontSize: 14,
    },
    tabBar: {
        ...createGlassCard(
            {
                flexDirection: 'row',
                padding: 4,
                marginTop: Theme.spacing.lg,
            },
            { borderRadius: 14, withShadow: false }
        ),
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: Theme.colors.glassStrong,
    },
    tabText: {
        color: Theme.colors.textMuted,
        fontWeight: Theme.typography.weights.secondary,
        fontSize: 14,
    },
    activeTabText: {
        color: Theme.colors.white,
    },
    listContainer: {
        padding: Theme.spacing.lg,
        paddingBottom: 120,
    },
    storyCardContainer: createGlassCard({ marginBottom: Theme.spacing.md }),
    storyCardBlur: {
        padding: Theme.spacing.sm,
    },
    storyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Theme.spacing.sm,
    },
    storyHeaderLeft: {
        flex: 1,
        paddingRight: Theme.spacing.md,
    },
    storyHeaderRight: {
        alignItems: 'flex-end',
    },
    personaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    personaAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        marginRight: 8,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    personaBadge: {
        backgroundColor: Theme.colors.glass,
        color: Theme.colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: Theme.typography.weights.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    date: {
        color: Theme.colors.textMuted,
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
    },
    storyBody: {
        gap: Theme.spacing.md,
        marginTop: Theme.spacing.md,
    },
    coverImageContainer: createGlassCard(
        {
            width: '100%',
            aspectRatio: 1,
            backgroundColor: Theme.colors.glass,
        },
        { borderRadius: 20, withShadow: false }
    ),
    coverImage: {
        ...StyleSheet.absoluteFillObject,
    },
    coverOverlayBadge: {
        ...overlayBadgeStyles.container,
        position: 'absolute',
        maxWidth: '78%',
    },
    coverOverlayTopBadge: {
        height: 42,
    },
    coverOverlayLeft: {
        top: Theme.spacing.sm,
        left: Theme.spacing.sm,
    },
    coverOverlayRight: {
        top: Theme.spacing.sm,
        right: Theme.spacing.sm,
    },
    coverOverlayContent: overlayBadgeStyles.content,
    coverOverlayTopContent: {
        ...overlayBadgeStyles.content,
        paddingVertical: 0,
        flex: 1,
        justifyContent: 'center',
    },
    coverOverlayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    coverOverlayRightContent: {
        alignItems: 'flex-end',
    },
    coverOverlayMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
    },
    coverOverlayTitle: {
        color: Theme.colors.white,
        fontSize: 13,
        fontWeight: Theme.typography.weights.primary,
    },
    coverOverlayMeta: {
        color: Theme.colors.textMuted,
        fontSize: 11,
        fontWeight: Theme.typography.weights.secondary,
        flexShrink: 1,
    },
    coverOverlayBottomLeft: {
        bottom: Theme.spacing.sm,
        left: Theme.spacing.sm,
        maxWidth: '78%',
    },
    coverOverlayBottomRight: {
        bottom: Theme.spacing.sm,
        right: Theme.spacing.sm,
        maxWidth: '48%',
    },
    coverOverlayStoryTitle: {
        color: Theme.colors.white,
        fontSize: 18,
        fontWeight: Theme.typography.weights.primary,
        letterSpacing: -0.3,
    },
    coverOverlayDuration: {
        color: Theme.colors.textMuted,
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
    },
    narratorAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    storyText: {
        gap: 4,
    },
    storyTitle: {
        color: Theme.colors.white,
        fontSize: 22,
        fontWeight: Theme.typography.weights.primary,
        letterSpacing: -0.3,
    },
    storyMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    storyMetaText: {
        color: Theme.colors.textMuted,
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
    },
    storyActionCountsRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderTopWidth: 1,
        borderTopColor: Theme.colors.glassBorder,
        paddingTop: Theme.spacing.sm,
        marginTop: Theme.spacing.sm,
    },
    storyActionCountItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.sm,
    },
    storyActionCountItemDisabled: {
        opacity: 0.35,
    },
    storyActionCountTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    storyActionCountValue: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
    },
    storyActionCountDivider: {
        width: 1,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.7,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 40,
    },
    emptyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Theme.colors.glass,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    emptyTitle: {
        color: Theme.colors.white,
        fontSize: 22,
        fontWeight: Theme.typography.weights.extraBold,
        marginBottom: 12,
    },
    emptyText: {
        color: Theme.colors.textMuted,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    createFirstButton: {
        marginTop: 32,
        backgroundColor: Theme.colors.white,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 30,
        ...Theme.shadow,
    },
    createFirstButtonText: {
        color: Theme.colors.black,
        fontWeight: Theme.typography.weights.extraBold,
        fontSize: 16,
    },
    floatingVoiceBtn: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: Theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...Theme.shadow,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        zIndex: 10,
    },
    activeVoiceBtn: {
        backgroundColor: Theme.colors.primary,
        borderColor: Theme.colors.white,
    },
    voiceOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    voiceIndicator: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Theme.colors.primaryWash,
        borderWidth: 3,
        borderColor: Theme.colors.primary,
        marginBottom: 32,
    },
    voiceText: {
        color: Theme.colors.white,
        fontSize: 24,
        fontWeight: Theme.typography.weights.black,
        marginBottom: 12,
    },
    queryPreview: {
        color: Theme.colors.primary,
        fontSize: 20,
        fontWeight: Theme.typography.weights.bold,
        fontStyle: 'italic',
        marginBottom: 48,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    stopButton: {
        backgroundColor: Theme.colors.error,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 32,
        ...Theme.shadow,
    },
    stopButtonText: {
        color: Theme.colors.white,
        fontWeight: Theme.typography.weights.extraBold,
        fontSize: 16,
    },
});
