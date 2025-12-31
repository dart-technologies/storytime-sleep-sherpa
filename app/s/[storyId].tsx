import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { joinUrl } from '../../lib/cloudFunctions';
import { formatCountLabel, formatCreatorAttribution, formatDurationLabel } from '../../lib/formatUtils';
import { getFirstParam } from '../../lib/routerParams';
import { trackStoryPlay } from '../../lib/storyCounts';
import type { SharedStory } from '../../lib/sharedStory';
import { getWebBaseUrlFromEnv } from '../../lib/shareLinks';
import { fetchSharedStory } from '../../lib/sharedStory';

type PageState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; story: SharedStory };

const DEFAULT_TESTFLIGHT_URL = 'https://testflight.apple.com/join/5X3eGRNA';

function formatShortDateLabel(timestampMs: number | undefined): string | null {
    if (typeof timestampMs !== 'number') return null;
    if (!Number.isFinite(timestampMs)) return null;
    try {
        const date = new Date(timestampMs);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return null;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.xl,
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
        gap: Theme.spacing.lg,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
        padding: Theme.spacing.md,
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
    },
    brandLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glass,
    },
    brandText: {
        flex: 1,
        gap: 2,
    },
    brandName: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
    },
    brandCta: {
        color: Theme.colors.textMuted,
        fontSize: 13,
        fontWeight: Theme.typography.weights.secondary,
    },
    cover: {
        width: '100%',
        aspectRatio: 1,
        maxHeight: 420,
        borderRadius: Theme.glass.borderRadius,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassSubtle,
        position: 'relative',
    },
    coverImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    coverBadge: {
        position: 'absolute',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: 'rgba(0,0,0,0.38)',
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
    },
    coverBadgeTop: {
        top: Theme.spacing.md,
    },
    coverBadgeBottom: {
        bottom: Theme.spacing.md,
    },
    coverBadgeLeft: {
        left: Theme.spacing.md,
    },
    coverBadgeRight: {
        right: Theme.spacing.md,
    },
    coverBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        maxWidth: 360,
    },
    coverBadgeTitle: {
        color: Theme.colors.white,
        fontSize: 13,
        fontWeight: Theme.typography.weights.primary,
    },
    coverBadgeMuted: {
        color: Theme.colors.textMuted,
        fontSize: 13,
        fontWeight: Theme.typography.weights.secondary,
    },
    coverBadgeStoryTitle: {
        color: Theme.colors.white,
        fontSize: 18,
        fontWeight: Theme.typography.weights.primary,
        letterSpacing: -0.3,
    },
    title: {
        fontSize: 28,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    attribution: {
        fontSize: 14,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: Theme.spacing.xs,
        fontWeight: Theme.typography.weights.secondary,
    },
    meta: {
        fontSize: 14,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassSubtle,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.md,
        gap: Theme.spacing.sm,
    },
    statValue: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
    },
    statDivider: {
        width: 1,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.7,
    },
    summary: {
        fontSize: 16,
        color: Theme.colors.text,
        lineHeight: 24,
    },
    error: {
        fontSize: 16,
        color: Theme.colors.error,
        textAlign: 'center',
        lineHeight: 24,
    },
    audio: {
        width: '100%',
    },
});

export default function SharedStoryPage() {
    const { storyId: storyIdParam } = useLocalSearchParams<{ storyId?: string | string[] }>();
    const storyId = useMemo(() => getFirstParam(storyIdParam), [storyIdParam]);
    const [state, setState] = useState<PageState>({ status: 'loading' });
    const playTrackedRef = useRef(false);
    const baseUrl = useMemo(() => getWebBaseUrlFromEnv(), []);
    const testFlightUrl = useMemo(() => {
        const raw = (process.env.EXPO_PUBLIC_TESTFLIGHT_URL || '').trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        return DEFAULT_TESTFLIGHT_URL;
    }, []);
    const canonicalUrl = useMemo(() => {
        if (!baseUrl || !storyId) return null;
        return joinUrl(baseUrl, `/s/${encodeURIComponent(storyId)}`);
    }, [baseUrl, storyId]);

    useEffect(() => {
        playTrackedRef.current = false;
    }, [storyId]);

    useEffect(() => {
        if (!storyId) {
            setState({ status: 'error', message: 'Missing story id.' });
            return;
        }

        const controller = new AbortController();
        setState({ status: 'loading' });

        fetchSharedStory(storyId, { signal: controller.signal })
            .then((story) => setState({ status: 'loaded', story }))
            .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                setState({ status: 'error', message: message || 'Could not load this story.' });
            });

        return () => controller.abort();
    }, [storyId]);

    const head = useMemo(() => {
        const fallbackImageUrl = baseUrl ? joinUrl(baseUrl, '/og.png') : null;
        if (state.status !== 'loaded') {
            return {
                title: 'Storytime',
                description: 'Open a shared Storytime link to listen to a sleep story in your browser.',
                imageUrl: fallbackImageUrl,
            };
        }

        const storyTitle = state.story.title || 'Untitled Story';
        const storyDescription = state.story.summary || 'Listen to a sleep story in your browser.';
        return {
            title: `${storyTitle} • Storytime`,
            description: storyDescription,
            imageUrl: state.story.coverImageUrl || fallbackImageUrl,
        };
    }, [baseUrl, state]);

    if (state.status === 'loading') {
        return (
            <View style={styles.container}>
                <Head>
                    <title>{head.title}</title>
                    <meta name="description" content={head.description} />
                    <meta property="og:title" content={head.title} />
                    <meta property="og:description" content={head.description} />
                    {head.imageUrl ? <meta property="og:image" content={head.imageUrl} /> : null}
                </Head>
                <ActivityIndicator size="large" color={Theme.colors.white} />
            </View>
        );
    }

    if (state.status === 'error') {
        return (
            <View style={styles.container}>
                <Head>
                    <title>{head.title}</title>
                    <meta name="description" content={head.description} />
                    <meta property="og:title" content={head.title} />
                    <meta property="og:description" content={head.description} />
                    {head.imageUrl ? <meta property="og:image" content={head.imageUrl} /> : null}
                </Head>
                <View style={styles.card}>
                    <Text style={styles.error}>{state.message}</Text>
                </View>
            </View>
        );
    }

    const { story } = state;
    const durationLabel = formatDurationLabel(story.duration);
    const creatorAttribution = formatCreatorAttribution(story.userName);
    const dateLabel = formatShortDateLabel(story.createdAt);
    const topRightLabel = [dateLabel, creatorAttribution].filter(Boolean).join(' • ');
    const playCountLabel = formatCountLabel(story.playCount);
    const remixCountLabel = formatCountLabel(story.remixCount);
    const favoritedCountLabel = formatCountLabel(story.favoritedCount);

    return (
        <View style={styles.container}>
            <Head>
                <title>{head.title}</title>
                <meta name="description" content={head.description} />
                <meta property="og:title" content={head.title} />
                <meta property="og:description" content={head.description} />
                {head.imageUrl ? <meta property="og:image" content={head.imageUrl} /> : null}
                {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
                {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
            </Head>
            <View style={styles.card}>
                <TouchableOpacity
                    accessibilityRole="link"
                    accessibilityLabel="Get Storytime on TestFlight"
                    onPress={() => Linking.openURL(testFlightUrl)}
                    style={styles.brandRow}
                >
                    <Image source={require('../../assets/images/icon.png')} style={styles.brandLogo} contentFit="cover" />
                    <View style={styles.brandText}>
                        <Text style={styles.brandName}>Storytime</Text>
                        <Text style={styles.brandCta}>Get the iOS beta on TestFlight</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.cover}>
                    {story.coverImageUrl ? (
                        <Image source={{ uri: story.coverImageUrl }} style={styles.coverImage} contentFit="cover" />
                    ) : null}

                    {story.personaName || durationLabel ? (
                        <View style={[styles.coverBadge, styles.coverBadgeTop, styles.coverBadgeLeft]}>
                            <View style={styles.coverBadgeRow}>
                                {story.personaName ? (
                                    <Text style={styles.coverBadgeTitle} numberOfLines={1}>
                                        {story.personaName}
                                    </Text>
                                ) : null}
                                {durationLabel ? (
                                    <Text style={styles.coverBadgeMuted} numberOfLines={1}>
                                        {story.personaName ? '• ' : ''}
                                        {durationLabel}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    {topRightLabel ? (
                        <View style={[styles.coverBadge, styles.coverBadgeTop, styles.coverBadgeRight]}>
                            <Text style={styles.coverBadgeMuted} numberOfLines={1}>
                                {topRightLabel}
                            </Text>
                        </View>
                    ) : null}

                    <View style={[styles.coverBadge, styles.coverBadgeBottom, styles.coverBadgeLeft]}>
                        <Text style={styles.coverBadgeStoryTitle} numberOfLines={2}>
                            {story.title || 'Untitled Story'}
                        </Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Ionicons name="headset-outline" size={18} color={Theme.colors.textMuted} />
                        <Text style={styles.statValue}>{playCountLabel}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Ionicons name="git-branch-outline" size={18} color={Theme.colors.textMuted} />
                        <Text style={styles.statValue}>{remixCountLabel}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Ionicons name="heart-outline" size={18} color={Theme.colors.textMuted} />
                        <Text style={styles.statValue}>{favoritedCountLabel}</Text>
                    </View>
                </View>

                {story.summary ? <Text style={styles.summary}>{story.summary}</Text> : null}

                {story.audioUrl ? (
                    <audio
                        controls
                        controlsList="nodownload"
                        preload="none"
                        src={story.audioUrl}
                        style={styles.audio}
                        onPlay={() => {
                            if (playTrackedRef.current) return;
                            playTrackedRef.current = true;
                            void trackStoryPlay(story.id, { source: 'web' });
                        }}
                    />
                ) : (
                    <Text style={styles.meta}>Audio is not available for this story.</Text>
                )}
            </View>
        </View>
    );
}
