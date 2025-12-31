import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { SOUNDSCAPE_OPTIONS, type SoundscapeId } from '../../lib/assetMapper';
import { intakeStyles as styles } from '../screenStyles/intakeStyles';

export function SoundscapePicker({
    soundscapeId,
    isSoundscapeEnabled,
    isSoundscapeMenuOpen,
    onToggleMenu,
    onSelectSoundscape,
    onDisableSoundscape,
    onCloseMenu,
}: {
    soundscapeId: SoundscapeId;
    isSoundscapeEnabled: boolean;
    isSoundscapeMenuOpen: boolean;
    onToggleMenu: () => void;
    onSelectSoundscape: (id: SoundscapeId) => void;
    onDisableSoundscape: () => void;
    onCloseMenu: () => void;
}) {
    const selectedSoundscapeLabel = useMemo(() => {
        if (!isSoundscapeEnabled) return '🤫 None';
        const option = SOUNDSCAPE_OPTIONS.find((candidate) => candidate.id === soundscapeId);
        if (!option) return '🤫 None';
        return `${option.emoji} ${option.label}`;
    }, [isSoundscapeEnabled, soundscapeId]);

    return (
        <View style={styles.card}>
            <View style={[styles.cardHeader, styles.soundscapeHeader]}>
                <Text style={styles.cardTitle}>Ambient soundscape</Text>
            </View>

            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Select ambient soundscape"
                onPress={onToggleMenu}
                style={styles.soundscapeSelect}
            >
                <Text
                    numberOfLines={1}
                    style={[styles.soundscapeSelectText, !isSoundscapeEnabled && styles.soundscapeSelectTextOff]}
                >
                    {selectedSoundscapeLabel}
                </Text>
                <Ionicons
                    name={isSoundscapeMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isSoundscapeEnabled ? Theme.colors.primary : Theme.colors.textMuted}
                />
            </TouchableOpacity>

            {isSoundscapeMenuOpen ? (
                <View style={styles.soundscapeDropdown}>
                    {SOUNDSCAPE_OPTIONS.filter((option) => !isSoundscapeEnabled || option.id !== soundscapeId).map((option) => {
                        return (
                            <TouchableOpacity
                                key={option.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Select soundscape: ${option.label}`}
                                onPress={() => {
                                    onSelectSoundscape(option.id);
                                    onCloseMenu();
                                }}
                                style={styles.soundscapeOptionRow}
                            >
                                <Text style={styles.soundscapeOptionText}>{option.emoji} {option.label}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    {isSoundscapeEnabled ? (
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Disable soundscape"
                            onPress={() => {
                                onDisableSoundscape();
                                onCloseMenu();
                            }}
                            style={styles.soundscapeOptionRow}
                        >
                            <Text style={styles.soundscapeOptionText}>🤫 None</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

