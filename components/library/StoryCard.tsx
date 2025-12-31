import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { getPersonaAvatar } from '../../lib/assetMapper';
import { formatCountLabel, formatCreatorAttribution, formatDurationLabel } from '../../lib/formatUtils';
import { libraryStyles as styles } from '../screenStyles/libraryStyles';

export type StoryCardProps = {
    id: string;
    personaId: string;
    personaName: string;
    isPublic: boolean;
    createdAt: number;
    coverImageUrl?: string;
    title: string;
    summary: string;
    narrative?: string;
    durationSec?: number;
    isFavorite: boolean;
    canFavorite: boolean;
    playCount?: number;
    remixCount?: number;
    favoritedCount?: number;
    creatorName?: string;
    showCreator?: boolean;
    showPublicIcon?: boolean;
    onPlay: (storyId: string) => void;
    onRemix: (storyId: string, title: string, narrative: string) => void;
    onFavorite: (storyId: string, current: boolean) => void;
};

export const StoryCard = React.memo(function StoryCard(props: StoryCardProps) {
    const {
        id,
        personaId,
        personaName,
        isPublic,
        createdAt,
        coverImageUrl,
        title,
        summary,
        narrative,
        durationSec,
        isFavorite,
        canFavorite,
        playCount,
        remixCount,
        favoritedCount,
        creatorName,
        showCreator,
        showPublicIcon = true,
        onPlay,
        onRemix,
        onFavorite,
    } = props;

    const dateLabel = useMemo(() => {
        try {
            const date = new Date(createdAt);
            if (Number.isNaN(date.getTime())) return new Date(createdAt).toLocaleDateString();
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return new Date(createdAt).toLocaleDateString();
        }
    }, [createdAt]);
    const durationLabel = useMemo(() => formatDurationLabel(durationSec), [durationSec]);
    const avatar = useMemo(() => getPersonaAvatar(personaId as any), [personaId]);
    const coverSource = coverImageUrl ? { uri: coverImageUrl } : avatar;

    const playCountLabel = useMemo(() => formatCountLabel(playCount), [playCount]);
    const remixCountLabel = useMemo(() => formatCountLabel(remixCount), [remixCount]);
    const favoritedCountLabel = useMemo(() => formatCountLabel(favoritedCount), [favoritedCount]);

    const creatorAttribution = useMemo(
        () => formatCreatorAttribution(creatorName),
        [creatorName]
    );
    const showCreatorRow = Boolean(showCreator && creatorAttribution);
    const topRightLabel = useMemo(() => {
        if (showCreatorRow) return `${dateLabel} • ${creatorAttribution}`;
        return dateLabel;
    }, [creatorAttribution, dateLabel, showCreatorRow]);

    const handlePlay = useCallback(() => {
        onPlay(id);
    }, [onPlay, id]);

    const handleRemix = useCallback(() => {
        onRemix(id, title, narrative || summary);
    }, [onRemix, id, narrative, summary, title]);

    const handleFavorite = useCallback(() => {
        onFavorite(id, isFavorite);
    }, [onFavorite, id, isFavorite]);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePlay}
            style={styles.storyCardContainer}
            testID={`library-story-card-${id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open story ${title}`}
        >
            <BlurView intensity={Theme.blur.soft} tint="dark" style={styles.storyCardBlur}>
                <View style={styles.coverImageContainer}>
                    {coverSource ? (
                        <Image
                            source={coverSource}
                            style={styles.coverImage}
                            contentFit="cover"
                            transition={Theme.motion.imageTransition.fast}
                        />
                    ) : null}

                    <BlurView
                        intensity={Theme.blur.strong}
                        tint="dark"
                        style={[styles.coverOverlayBadge, styles.coverOverlayTopBadge, styles.coverOverlayLeft]}
                    >
                        <View style={[styles.coverOverlayTopContent, styles.coverOverlayRow]}>
                            <Image
                                source={avatar}
                                style={styles.narratorAvatar}
                                contentFit="cover"
                                transition={Theme.motion.imageTransition.fast}
                            />
                            <Text style={styles.coverOverlayTitle} numberOfLines={1}>{personaName}</Text>
                            {durationLabel ? (
                                <Text style={styles.coverOverlayDuration} numberOfLines={1}>• {durationLabel}</Text>
                            ) : null}
                        </View>
                    </BlurView>

                    <BlurView
                        intensity={Theme.blur.strong}
                        tint="dark"
                        style={[styles.coverOverlayBadge, styles.coverOverlayTopBadge, styles.coverOverlayRight]}
                    >
                        <View style={[styles.coverOverlayTopContent, styles.coverOverlayRightContent]}>
                            <View style={styles.coverOverlayMetaRow}>
                                <Text style={styles.coverOverlayMeta} numberOfLines={1}>{topRightLabel}</Text>
                                {isPublic && showPublicIcon ? (
                                    <Ionicons name="globe-outline" size={16} color={Theme.colors.textMuted} />
                                ) : null}
                            </View>
                        </View>
                    </BlurView>

                    <BlurView intensity={Theme.blur.strong} tint="dark" style={[styles.coverOverlayBadge, styles.coverOverlayBottomLeft]}>
                        <View style={styles.coverOverlayContent}>
                            <Text style={styles.coverOverlayStoryTitle} numberOfLines={2}>{title}</Text>
                        </View>
                    </BlurView>
                </View>

                <View style={styles.storyActionCountsRow}>
                    <TouchableOpacity
                        testID={`library-story-listen-${id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Listen to story ${title}`}
                        style={styles.storyActionCountItem}
                        onPress={handlePlay}
                    >
                        <View style={styles.storyActionCountTopRow}>
                            <Ionicons name="headset-outline" size={20} color={Theme.colors.textMuted} />
                            <Text style={styles.storyActionCountValue}>{playCountLabel}</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.storyActionCountDivider} />

                    <TouchableOpacity
                        testID={`library-story-remix-${id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remix story ${title}`}
                        style={styles.storyActionCountItem}
                        onPress={handleRemix}
                    >
                        <View style={styles.storyActionCountTopRow}>
                            <Ionicons name="git-branch-outline" size={20} color={Theme.colors.textMuted} />
                            <Text style={styles.storyActionCountValue}>{remixCountLabel}</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.storyActionCountDivider} />

                    <TouchableOpacity
                        testID={`library-story-favorite-${id}`}
                        accessibilityRole="button"
                        accessibilityLabel={isFavorite ? `Unfavorite story ${title}` : `Favorite story ${title}`}
                        accessibilityState={!canFavorite ? { disabled: true } : undefined}
                        style={[styles.storyActionCountItem, !canFavorite && styles.storyActionCountItemDisabled]}
                        onPress={handleFavorite}
                        disabled={!canFavorite}
                    >
                        <View style={styles.storyActionCountTopRow}>
                            <Ionicons
                                name={isFavorite ? 'heart' : 'heart-outline'}
                                size={20}
                                color={isFavorite ? Theme.colors.error : Theme.colors.textMuted}
                            />
                            <Text style={styles.storyActionCountValue}>{favoritedCountLabel}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </BlurView>
        </TouchableOpacity>
    );
});
