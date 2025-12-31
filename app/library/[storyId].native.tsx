import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtmosphereView } from '../../components/AtmosphereView';
import Snowflakes from '../../components/Snowflakes';
import { CoverTransitionOverlay } from '../../components/playback/CoverTransitionOverlay';
import { MoreSheet } from '../../components/playback/MoreSheet';
import { PlaybackArtwork } from '../../components/playback/PlaybackArtwork';
import { PlaybackFooter } from '../../components/playback/PlaybackFooter';
import { PlaybackHeader } from '../../components/playback/PlaybackHeader';
import { playbackStyles as styles } from '../../components/screenStyles/playbackStyles';
import { usePlaybackFlow } from '../../hooks/playback/usePlaybackFlow';

export default function PlaybackScreen() {
    useKeepAwake();
    const { storyId, autoplay, personaId, coverUri, coverX, coverY, coverW, coverH } = useLocalSearchParams();
    const {
        story,
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
        moreSheetMetaLine1,
        moreSheetMetaLine2,
        handleShare,
        handleSaveAudio,
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
    } = usePlaybackFlow({ storyId, autoplay, personaId, coverUri, coverX, coverY, coverW, coverH });

    if (!story) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Story not found</Text>
            </SafeAreaView>
        );
    }

    const placeholderLetter = story.personaName ? story.personaName[0] : '?';

    return (
        <View style={styles.container}>
            <AtmosphereView type={atmosphereType as 'luna' | 'kai' | 'river'} />
            <SafeAreaView style={styles.safeArea}>
                <Snowflakes />

                <PlaybackHeader
                    title={story.title}
                    onBack={handleBack}
                />

                <PlaybackArtwork
                    artworkRef={coverTransition.artworkRef}
                    onArtworkLayout={coverTransition.handleArtworkLayout}
                    artworkSource={artworkSource}
                    narratorAvatarSource={headerAvatarSource}
                    placeholderLetter={placeholderLetter}
                    summary={story.summary}
                    artworkSize={artworkSize}
                    isPlaying={isPlaying}
                    breathingColor={breathingColor}
                    isCoverTransitionActive={coverTransition.isCoverTransitionActive}
                />

                <PlaybackFooter
                    isPlaying={isPlaying}
                    hasAudio={Boolean(story.audioUrl)}
                    onTogglePlay={handleTogglePlay}
                    onMore={openMoreSheet}
                    insetsBottom={insets.bottom}
                    logLayoutOnce={logLayoutOnce}
                />

                <MoreSheet
                    open={isMoreSheetOpen}
                    height={moreSheetHeight}
                    insetsBottom={insets.bottom}
                    title={story.title}
                    metaLine1={moreSheetMetaLine1}
                    metaLine2={moreSheetMetaLine2}
                    creatorName={story.userName}
                    playCount={story.playCount}
                    remixCount={story.remixCount}
                    favoritedCount={story.favoritedCount}
                    isFavorite={Boolean(story.isFavorite)}
                    isPublic={Boolean(story.isPublic)}
                    canDelete={canDelete}
                    canTogglePublic={canDelete}
                    isDeleting={isDeleting}
                    onRequestClose={closeMoreSheet}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePublic={handleTogglePublic}
                    onSaveAudio={canDelete && Boolean(story.audioUrl) ? handleSaveAudio : undefined}
                    onShare={handleShare}
                    onDelete={handleDelete}
                />
            </SafeAreaView>

            <CoverTransitionOverlay
                active={coverTransition.isCoverTransitionActive}
                source={transitionCoverSource}
                overlayStyle={coverTransition.overlayStyle}
            />
        </View>
    );
}
