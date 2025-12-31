import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BreathingGuide } from '../../../components/BreathingGuide';
import { GenerationProgressOverlay } from '../../../components/intake/GenerationProgressOverlay';
import { MoodImagePicker } from '../../../components/intake/MoodImagePicker';
import { SoundscapePicker } from '../../../components/intake/SoundscapePicker';
import Snowflakes from '../../../components/Snowflakes';
import { intakeStyles as styles } from '../../../components/screenStyles/intakeStyles';
import { Theme } from '../../../constants/Theme';
import { useIntakeFlow } from '../../../hooks/intake/useIntakeFlow';

export default function IntakeScreen() {
    useKeepAwake();
    const { personaId, remixId, remixContext } = useLocalSearchParams();
    const {
        persona,
        avatarAsset,
        hasAgentId,
        isConnected,
        isGenerating,
        generationPhase,
        personaStatusText,
        micHintText,
        voiceError,
        isAgentAudioRecording,
        agentAudioRecording,
        handleExportAgentAudio,
        isVoiceStarting,
        isSessionActive,
        handleBack,
        toggleListening,
        canGenerate,
        handleFinish,
        coverPreviewRef,
        coverPreviewSource,
        selectedImageUri,
        isSeasonalMoodSelected,
        canSelectMoodImage,
        imageAnalysis,
        isAnalyzingImage,
        imageAnalysisError,
        handlePickImage,
        handleSelectSeasonalMood,
        clearImage,
        soundscapeId,
        isSoundscapeEnabled,
        isSoundscapeMenuOpen,
        toggleSoundscapeMenu,
        closeSoundscapeMenu,
        handleSelectSoundscape,
        handleDisableSoundscape,
    } = useIntakeFlow({ personaId, remixId, remixContext });

    if (!persona) return null;

    const micDisabled = !hasAgentId || !isConnected;
    const micActive = isSessionActive || isVoiceStarting;

    return (
        <SafeAreaView style={styles.container}>
            <Snowflakes />
            <View style={styles.header}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={handleBack}
                    disabled={isGenerating}
                    style={isGenerating ? styles.disabledButton : undefined}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={32} color={Theme.colors.white} />
                </TouchableOpacity>
                <View style={styles.headerPersona}>
                    {avatarAsset ? (
                        <Image source={avatarAsset} style={styles.headerAvatar} contentFit="cover" />
                    ) : (
                        <View style={styles.headerAvatarPlaceholder}>
                            <Text style={styles.headerAvatarText}>{persona.name[0]}</Text>
                        </View>
                    )}
                    <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                        {persona.name}
                    </Text>
                </View>
                <View style={styles.headerRightSpacer} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.statusText}>{personaStatusText}</Text>

                <MoodImagePicker
                    selectedImageUri={selectedImageUri}
                    isSeasonalMoodSelected={isSeasonalMoodSelected}
                    canSelectMoodImage={canSelectMoodImage}
                    isAnalyzingImage={isAnalyzingImage}
                    imageAnalysis={imageAnalysis}
                    imageAnalysisError={imageAnalysisError}
                    onPickImage={handlePickImage}
                    onClearImage={clearImage}
                    onSelectSeasonalMood={handleSelectSeasonalMood}
                />

                <SoundscapePicker
                    soundscapeId={soundscapeId}
                    isSoundscapeEnabled={isSoundscapeEnabled}
                    isSoundscapeMenuOpen={isSoundscapeMenuOpen}
                    onToggleMenu={toggleSoundscapeMenu}
                    onSelectSoundscape={handleSelectSoundscape}
                    onDisableSoundscape={handleDisableSoundscape}
                    onCloseMenu={closeSoundscapeMenu}
                />
            </ScrollView>

            <View style={styles.footer}>
                {!isGenerating && (
                    <>
                        <View style={styles.micButtonWrapper}>
                            {micActive && !micDisabled ? (
                                <View pointerEvents="none" style={styles.micGlow}>
                                    <BreathingGuide
                                        variant="glow"
                                        duration={2600}
                                        color={Theme.colors.primary}
                                        size={112}
                                        minScale={0.96}
                                        maxScale={1.03}
                                        minOpacity={0.45}
                                        maxOpacity={1.0}
                                    />
                                </View>
                            ) : null}
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={micActive ? 'Stop listening' : 'Start listening'}
                                accessibilityHint={`Starts a voice conversation with ${persona.name}.`}
                                style={[styles.micButton, micDisabled && styles.disabledButton]}
                                onPress={toggleListening}
                                disabled={micDisabled}
                            >
                                <Ionicons
                                    name={micActive ? 'mic' : 'mic-outline'}
                                    size={32}
                                    color={Theme.colors.white}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.micHint}>{micHintText}</Text>
                        {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
                        {!isAgentAudioRecording && agentAudioRecording?.uri ? (
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Export agent audio"
                                accessibilityHint="Exports the ElevenLabs agent audio as a WAV file."
                                onPress={handleExportAgentAudio}
                                style={[styles.secondaryButton, { width: '100%' }]}
                            >
                                <Ionicons name="download-outline" size={18} color={Theme.colors.white} />
                                <Text style={styles.secondaryButtonText}>Export Agent Audio</Text>
                            </TouchableOpacity>
                        ) : null}
                    </>
                )}

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Generate story"
                    style={[styles.actionButton, styles.generateButton, (!canGenerate) && styles.disabledButton]}
                    onPress={handleFinish}
                    disabled={!canGenerate}
                >
                    {isGenerating ? (
                        <ActivityIndicator color={Theme.colors.black} />
                    ) : (
                        <Text style={styles.generateButtonText}>Generate Story</Text>
                    )}
                </TouchableOpacity>
            </View>

            <GenerationProgressOverlay
                visible={isGenerating}
                coverPreviewSource={coverPreviewSource}
                coverPreviewRef={coverPreviewRef}
                generationPhase={generationPhase}
            />
        </SafeAreaView>
    );
}
