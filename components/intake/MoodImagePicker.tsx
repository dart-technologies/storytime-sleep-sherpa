import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { SEASONAL_SPECIALS } from '../../lib/seasonalSpecials';
import { intakeStyles as styles } from '../screenStyles/intakeStyles';

type SeasonalSpecial = (typeof SEASONAL_SPECIALS)[number];

export function MoodImagePicker({
    selectedImageUri,
    isSeasonalMoodSelected,
    canSelectMoodImage,
    isAnalyzingImage,
    imageAnalysis,
    imageAnalysisError,
    onPickImage,
    onClearImage,
    onSelectSeasonalMood,
}: {
    selectedImageUri: string | null;
    isSeasonalMoodSelected: boolean;
    canSelectMoodImage: boolean;
    isAnalyzingImage: boolean;
    imageAnalysis: string | null;
    imageAnalysisError: string | null;
    onPickImage: () => void;
    onClearImage: () => void;
    onSelectSeasonalMood: (special: SeasonalSpecial) => void;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Add image</Text>
                {selectedImageUri ? (
                    <TouchableOpacity onPress={onClearImage} accessibilityRole="button">
                        <Ionicons name="trash-outline" size={18} color={Theme.colors.textMuted} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodCarouselContent}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Pick an image"
                    style={[
                        styles.moodOption,
                        styles.moodOptionPick,
                        selectedImageUri && !isSeasonalMoodSelected && styles.moodOptionSelected,
                        !canSelectMoodImage && styles.moodOptionDisabled,
                    ]}
                    onPress={onPickImage}
                    disabled={!canSelectMoodImage}
                >
                    <Ionicons name="image-outline" size={22} color={Theme.colors.white} />
                    <Text style={styles.moodOptionPickText}>Pick image</Text>
                </TouchableOpacity>

                {SEASONAL_SPECIALS.slice(0, 3).map((special) => {
                    const isSelected = selectedImageUri === special.image;
                    return (
                        <TouchableOpacity
                            key={special.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Use seasonal mood: ${special.title}`}
                            style={[
                                styles.moodOption,
                                isSelected && styles.moodOptionSelected,
                                !canSelectMoodImage && styles.moodOptionDisabled,
                            ]}
                            onPress={() => onSelectSeasonalMood(special)}
                            disabled={!canSelectMoodImage}
                        >
                            <Image source={{ uri: special.image }} style={styles.moodOptionImage} contentFit="cover" />
                            <View style={styles.moodOptionOverlay}>
                                <Text style={styles.moodOptionTheme} numberOfLines={1}>
                                    {special.theme}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {selectedImageUri ? (
                <Image source={{ uri: selectedImageUri }} style={styles.pickedImage} contentFit="cover" />
            ) : null}

            {selectedImageUri ? (
                <View style={styles.analysisContainer}>
                    {isAnalyzingImage ? (
                        <View style={styles.analysisRow}>
                            <ActivityIndicator color={Theme.colors.primary} />
                            <Text style={styles.analysisTextMuted}>Analyzing with Gemini…</Text>
                        </View>
                    ) : imageAnalysis ? (
                        <>
                            <Text style={styles.analysisLabel}>Gemini Analysis</Text>
                            <Text style={styles.analysisText}>{imageAnalysis}</Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                style={styles.retryRow}
                                onPress={onPickImage}
                            >
                                <Ionicons name="refresh" size={16} color={Theme.colors.primary} />
                                <Text style={styles.retryText}>Replace image</Text>
                            </TouchableOpacity>
                        </>
                    ) : imageAnalysisError ? (
                        <>
                            <Text style={styles.analysisLabel}>Gemini Analysis</Text>
                            <Text style={styles.analysisTextError}>{imageAnalysisError}</Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                style={styles.retryRow}
                                onPress={onPickImage}
                            >
                                <Ionicons name="refresh" size={16} color={Theme.colors.primary} />
                                <Text style={styles.retryText}>Pick a different image</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={styles.secondaryButton}
                            onPress={onPickImage}
                        >
                            <Ionicons name="image-outline" size={18} color={Theme.colors.white} />
                            <Text style={styles.secondaryButtonText}>Replace image</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : null}
        </View>
    );
}
