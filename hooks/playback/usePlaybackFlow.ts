import { setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type LayoutChangeEvent, Platform, Share, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { usePlayback } from '../usePlayback';
import { useStories } from '../useStories';
import { getPersonaAvatar, getSoundscapeAsset, SOUNDSCAPE_OPTIONS } from '../../lib/assetMapper';
import { cacheAudio, getCachedAudioPath } from '../../lib/audioCache';
import { createFlowLogger, isVerboseDebugLoggingEnabled } from '../../lib/debugLogger';
import { formatDateLabel, formatDurationLabel } from '../../lib/formatUtils';
import { getOfflineFavoriteAudioFileName } from '../../lib/offlineFavoritesDownloads';
import { personas } from '../../lib/personas';
import { getFirstParamOrUndefined, parseFloatParam } from '../../lib/routerParams';
import { getStoryShareUrl } from '../../lib/shareLinks';
import { trackStoryPlay } from '../../lib/storyCounts';
import { AnalyticsService } from '../../services/analytics';
import { useOfflineFavoritesDownloadsEnabled } from '../offline/useOfflineFavoritesDownloadsEnabled';
import { useCoverTransition, type Rect } from './useCoverTransition';

function getExportAudioFileName(narrator: string | undefined, title: string, storyId: string): string {
    const safeNarrator = String(narrator || '')
        .trim()
        .replace(/[^A-Za-z0-9 _-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/ /g, '_')
        .slice(0, 32);

    const safeTitle = String(title || '')
        .trim()
        .replace(/[^A-Za-z0-9 _-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/ /g, '_')
        .slice(0, 48);

    const safeId = String(storyId || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 32);

    const base = [safeTitle || 'dream', safeId].filter(Boolean).join('_').slice(0, 96);
    return `Storytime-Sleep-Sherpa_${safeNarrator || 'Narrator'}_${base}.mp3`;
}

type Params = {
    storyId: string | string[] | undefined;
    autoplay: string | string[] | undefined;
    personaId: string | string[] | undefined;
    coverUri: string | string[] | undefined;
    coverX: string | string[] | undefined;
    coverY: string | string[] | undefined;
    coverW: string | string[] | undefined;
    coverH: string | string[] | undefined;
};

export function usePlaybackFlow({ storyId, autoplay, personaId, coverUri, coverX, coverY, coverW, coverH }: Params) {
    const router = useRouter();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const { myStories, featuredStories, deleteStory, toggleFavorite, setStoryPublic } = useStories();
    const [isDeleting, setIsDeleting] = useState(false);

    const debugLayoutLogger = useMemo(() => {
        if (!isVerboseDebugLoggingEnabled()) return null;
        if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return null;
        return createFlowLogger('Playback Layout');
    }, []);

    useEffect(() => () => {
        debugLayoutLogger?.end();
    }, [debugLayoutLogger]);

    const layoutLoggedRef = useRef<Record<string, boolean>>({});
    const logLayoutOnce = useCallback((key: string, event: LayoutChangeEvent) => {
        if (!debugLayoutLogger) return;
        if (layoutLoggedRef.current[key]) return;
        layoutLoggedRef.current[key] = true;
        debugLayoutLogger.log('layout', { key, ...event.nativeEvent.layout });
    }, [debugLayoutLogger]);

    const normalizedStoryId = useMemo(
        () => getFirstParamOrUndefined(storyId),
        [storyId]
    );

    const coverPreviewUri = useMemo(
        () => getFirstParamOrUndefined(coverUri),
        [coverUri]
    );

    const normalizedPersonaId = useMemo(
        () => getFirstParamOrUndefined(personaId),
        [personaId]
    );

    const transitionFromRect = useMemo<Rect | null>(() => {
        const x = parseFloatParam(coverX);
        const y = parseFloatParam(coverY);
        const width = parseFloatParam(coverW);
        const height = parseFloatParam(coverH);
        if (x === null || y === null || width === null || height === null) return null;
        if (width <= 0 || height <= 0) return null;
        return { x, y, width, height };
    }, [coverH, coverW, coverX, coverY]);

    const allStories = useMemo(
        () => [...myStories, ...featuredStories],
        [myStories, featuredStories]
    );

    const story = useMemo(
        () => allStories.find((s) => s.id === normalizedStoryId),
        [allStories, normalizedStoryId]
    );

    const canDelete = useMemo(
        () => myStories.some((s) => s.id === normalizedStoryId),
        [myStories, normalizedStoryId]
    );

    useEffect(() => {
        if (!isDeleting) return;
        if (story) return;
        router.replace('/library');
    }, [isDeleting, router, story]);

    const persona = useMemo(
        () => personas.find((p) => p.id === story?.personaId) || null,
        [story?.personaId]
    );

    const avatar = useMemo(
        () => (persona ? getPersonaAvatar(persona.id) : null),
        [persona]
    );

    const avatarFromParams = useMemo(() => {
        const id = normalizedPersonaId?.trim() || '';
        if (!id) return null;
        return getPersonaAvatar(id as any);
    }, [normalizedPersonaId]);

    const coverOverrideSource = coverPreviewUri?.trim()
        ? { uri: coverPreviewUri.trim() }
        : null;
    const transitionCoverSource = coverOverrideSource || avatarFromParams || avatar;

    const coverTransition = useCoverTransition({
        transitionFromRect,
        transitionCoverSource,
    });

    const {
        playStory,
        isPlaying,
        storyPlayer,
        pausePlayback,
        resumePlayback,
        setAmbientSound,
        didJustFinish,
        atmosphereType,
    } = usePlayback(persona || null);

    const { enabled: offlineFavoritesEnabled } = useOfflineFavoritesDownloadsEnabled();

    const autoPlayedRef = useRef(false);
    const didFinishHandledRef = useRef(false);
    const playTrackedRef = useRef(false);
    const hasStartedPlaybackRef = useRef(false);
    const playStartRequestIdRef = useRef(0);
    const isStartingPlaybackRef = useRef(false);

    useEffect(() => {
        playTrackedRef.current = false;
    }, [normalizedStoryId]);

    useEffect(() => {
        hasStartedPlaybackRef.current = false;
        autoPlayedRef.current = false;
        playStartRequestIdRef.current += 1;
        isStartingPlaybackRef.current = false;
    }, [normalizedStoryId]);

    useEffect(() => {
        if (isPlaying || storyPlayer?.playing) {
            isStartingPlaybackRef.current = false;
        }
    }, [isPlaying, storyPlayer?.playing]);

    const trackPlayOnce = useCallback((id: string) => {
        if (playTrackedRef.current) return;
        playTrackedRef.current = true;
        void trackStoryPlay(id, { source: 'app' });
    }, []);

    const resolveAudioSource = useCallback(async (candidate: typeof story) => {
        if (!candidate?.audioUrl) return null;
        if (!offlineFavoritesEnabled) return candidate.audioUrl;
        if (!candidate.isFavorite) return candidate.audioUrl;

        const fileName = getOfflineFavoriteAudioFileName(candidate.id);
        try {
            const cachedPath = await getCachedAudioPath(fileName);
            if (cachedPath) return cachedPath;
        } catch {
            // ignore
        }

        void cacheAudio(candidate.audioUrl, fileName).catch(() => undefined);
        return candidate.audioUrl;
    }, [offlineFavoritesEnabled]);

    const configurePlaybackAudio = useCallback(async () => {
        if (Platform.OS !== 'ios') return;
        try {
            await setAudioModeAsync({
                playsInSilentMode: true,
                interruptionMode: 'doNotMix',
                allowsRecording: false,
                shouldPlayInBackground: true,
                shouldRouteThroughEarpiece: false,
            });
        } catch {
            // ignore
        }
    }, []);

    const startPlayback = useCallback(() => {
        if (!story) return;
        if (!story.audioUrl) {
            Alert.alert('Narration Not Ready', 'This story does not have a narration track yet.');
            return;
        }

        const requestId = playStartRequestIdRef.current + 1;
        playStartRequestIdRef.current = requestId;
        isStartingPlaybackRef.current = true;

        const audioUrl = story.audioUrl;
        void (async () => {
            try {
                await configurePlaybackAudio();
                trackPlayOnce(story.id);
                const resolved = await resolveAudioSource(story);
                if (playStartRequestIdRef.current !== requestId) return;
                playStory(resolved || audioUrl);
                hasStartedPlaybackRef.current = true;
                void AnalyticsService.trackPlaybackStart(story.id, story.personaId);
            } catch {
                // ignore
            }
        })();
    }, [configurePlaybackAudio, playStory, resolveAudioSource, story, trackPlayOnce]);

    const handleTogglePlay = useCallback(() => {
        if (!story) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const isPlayingNow = Boolean(isPlaying || storyPlayer?.playing);

        if (isPlayingNow) {
            playStartRequestIdRef.current += 1;
            isStartingPlaybackRef.current = false;
            pausePlayback();
            return;
        }

        if (isStartingPlaybackRef.current) {
            playStartRequestIdRef.current += 1;
            isStartingPlaybackRef.current = false;
            if (hasStartedPlaybackRef.current) {
                pausePlayback();
            }
            return;
        }

        if (hasStartedPlaybackRef.current) {
            resumePlayback();
            return;
        }

        startPlayback();
    }, [isPlaying, pausePlayback, resumePlayback, startPlayback, story, storyPlayer?.playing]);

    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            storyPlayer?.pause();
        } catch {
            // ignore
        }
        setAmbientSound(null);
        router.replace('/library');
    }, [router, setAmbientSound, storyPlayer]);

    const handleDelete = useCallback(() => {
        if (!story) return;
        if (!canDelete) return;
        if (isDeleting) return;

        Alert.alert(
            'Delete Story?',
            'This will remove the story from your Library.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setIsDeleting(true);
                        try {
                            storyPlayer?.pause();
                        } catch {
                            // ignore
                        }
                        setAmbientSound(null);
                        router.replace('/library');
                        void deleteStory(story.id)
                            .then(() => {
                                void AnalyticsService.trackStoryDeleted(story.id);
                            })
                            .catch((error) => {
                                const message = error instanceof Error ? error.message : String(error);
                                Alert.alert('Delete Failed', message || 'Could not delete this story.');
                            });
                    },
                },
            ]
        );
    }, [canDelete, deleteStory, isDeleting, router, setAmbientSound, story, storyPlayer]);

    const soundscapeLabel = useMemo(() => {
        const id = story?.soundscapeId;
        if (!id) return null;
        const match = SOUNDSCAPE_OPTIONS.find((option) => option.id === id);
        if (match) return `${match.emoji} ${match.label}`;
        return String(id);
    }, [story?.soundscapeId]);

    const moreSheetMetaLine1 = useMemo(() => {
        if (!story) return '';
        const formattedDate = formatDateLabel(story.createdAt);
        const formattedDuration = formatDurationLabel(story.duration);
        return [story.personaName || null, formattedDate, formattedDuration].filter(Boolean).join(' • ');
    }, [story]);

    const moreSheetMetaLine2 = useMemo(() => {
        if (!story) return '';
        if (!soundscapeLabel) return '';
        return `Soundscape: ${soundscapeLabel}`;
    }, [soundscapeLabel, story]);

    const handleShare = useCallback(async () => {
        if (!story) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const shareLink = getStoryShareUrl(story.id, [story.audioUrl, story.coverImageUrl]);
        const shareKind = shareLink ? 'share_link' : story.audioUrl ? 'audio_url' : undefined;
        void AnalyticsService.trackShare(story.id, { shareKind });
        const formattedDuration = formatDurationLabel(story.duration);
        const metaParts = [
            story.personaName ? `Narrator: ${story.personaName}` : null,
            formattedDuration ? `Duration: ${formattedDuration}` : null,
            soundscapeLabel ? `Soundscape: ${soundscapeLabel}` : null,
        ].filter(Boolean);

        const message = [
            story.title,
            metaParts.length ? metaParts.join(' • ') : null,
            story.summary,
            shareLink || (story.audioUrl ? story.audioUrl : null),
        ].filter(Boolean).join('\n\n');

        try {
            const shareUrl = shareLink || story.audioUrl || undefined;
            await Share.share({
                title: story.title,
                message,
                url: shareUrl,
            });
        } catch {
            // ignore
        }
    }, [soundscapeLabel, story]);

    const handleSaveAudio = useCallback(async () => {
        if (!story) return;
        if (!canDelete) return;
        if (!story.audioUrl) {
            Alert.alert('Narration Not Ready', 'This story does not have a narration track yet.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const fileName = getExportAudioFileName(story.personaName || story.personaId, story.title, story.id);

        try {
            let localUri: string | null = null;
            try {
                localUri = await getCachedAudioPath(fileName);
            } catch {
                // ignore
            }
            if (!localUri) {
                localUri = await cacheAudio(story.audioUrl, fileName);
            }

            try {
                await Share.share({
                    title: story.title,
                    message: story.title,
                    url: localUri,
                });
            } catch {
                // ignore
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Alert.alert('Save Failed', message || 'Could not export this audio file.');
        }
    }, [canDelete, story]);

    const handleToggleFavorite = useCallback(() => {
        if (!story) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void toggleFavorite(story.id, Boolean(story.isFavorite));
        void AnalyticsService.trackFavorite(story.id, !Boolean(story.isFavorite));
    }, [story, toggleFavorite]);

    const handleTogglePublic = useCallback(() => {
        if (!story) return;
        if (!canDelete) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const nextPublic = !Boolean(story.isPublic);
        void setStoryPublic(story.id, nextPublic);
        void AnalyticsService.trackStoryVisibility(story.id, nextPublic);
    }, [canDelete, setStoryPublic, story]);

    const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
    const closeMoreSheet = useCallback(() => {
        setIsMoreSheetOpen(false);
    }, []);

    const openMoreSheet = useCallback(() => {
        if (!story) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsMoreSheetOpen(true);
    }, [story]);

    const moreSheetHeight = Math.min(windowHeight * 0.55, 440);

    useEffect(() => {
        const shouldAutoplay = Array.isArray(autoplay) ? autoplay[0] === '1' : autoplay === '1';
        if (!shouldAutoplay) return;
        if (autoPlayedRef.current) return;
        if (!story?.audioUrl) return;
        if (isPlaying || storyPlayer?.playing) return;
        autoPlayedRef.current = true;
        startPlayback();
    }, [autoplay, isPlaying, startPlayback, story?.audioUrl, storyPlayer?.playing]);

    useEffect(() => {
        didFinishHandledRef.current = false;
    }, [normalizedStoryId]);

    useEffect(() => {
        if (!story) return;
        if (!didJustFinish) return;
        if (didFinishHandledRef.current) return;
        didFinishHandledRef.current = true;
        void AnalyticsService.trackPlaybackComplete(story.id, story.personaId);
        setAmbientSound(null);
        router.replace('/library');
    }, [didJustFinish, router, setAmbientSound, story]);

    useEffect(() => {
        if (!story?.soundscapeId) return;
        setAmbientSound(getSoundscapeAsset(story.soundscapeId));
    }, [setAmbientSound, story?.soundscapeId]);

    const headerAvatarSource = avatar || avatarFromParams;
    const artworkSize = Math.min(windowWidth - Theme.spacing.lg * 2, windowHeight * 0.5, 420);
    const breathingColor = persona?.id === 'kai' ? Theme.colors.secondary : Theme.colors.primary;
    const artworkSource = story?.coverImageUrl
        ? { uri: story.coverImageUrl }
        : coverOverrideSource || avatar || avatarFromParams;

    return {
        story,
        persona,
        canDelete,
        isDeleting,
        insets,
        atmosphereType,
        isPlaying,
        handleTogglePlay,
        handleBack,
        openMoreSheet,
        closeMoreSheet,
        isMoreSheetOpen,
        moreSheetHeight,
        soundscapeLabel,
        moreSheetMetaLine1,
        moreSheetMetaLine2,
        handleShare,
        handleToggleFavorite,
        handleTogglePublic,
        handleDelete,
        headerAvatarSource,
        artworkSource,
        artworkSize,
        breathingColor,
        transitionCoverSource,
        coverTransition,
        logLayoutOnce,
        handleSaveAudio,
    };
}
