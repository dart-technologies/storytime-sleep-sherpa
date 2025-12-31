import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { playbackStyles as styles } from '../screenStyles/playbackStyles';

export function PlaybackHeader({
    title,
    onBack,
}: {
    title: string;
    onBack: () => void;
}) {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                testID="playback-back"
                accessibilityRole="button"
                accessibilityLabel="Back to library"
                onPress={onBack}
            >
                <Ionicons name="chevron-back" size={32} color={Theme.colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                {title}
            </Text>
            <View style={styles.headerRightSpacer} />
        </View>
    );
}
