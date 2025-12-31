import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Theme } from '../constants/Theme';
import { getPersonaAvatar } from '../lib/assetMapper';
import { Persona } from '../lib/personas';

const PERSONA_EMOJI_SUMMARY: Record<Persona['id'], string> = {
    luna: '🌙',
    kai: '🌊',
    river: '🌀',
    echo: '🫧',
    sage: '🔥',
};

interface PersonaCardProps {
    persona: Persona;
    onPress: (persona: Persona) => void;
    selected?: boolean;
    style?: StyleProp<ViewStyle>;
}

const PersonaCard = React.memo(function PersonaCard({ persona, onPress, selected, style }: PersonaCardProps) {
    const scale = useSharedValue(1);
    const avatar = getPersonaAvatar(persona.id);
    const emojiSummary = PERSONA_EMOJI_SUMMARY[persona.id];

    useEffect(() => {
        scale.value = withSpring(selected ? 1.05 : 1, Theme.motion.spring.gentle);
    }, [selected, scale]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            borderColor: selected ? Theme.colors.primary : Theme.colors.glassBorder,
            borderWidth: selected ? 2 : Theme.glass.borderWidth,
            shadowOpacity: selected ? 0.6 : Theme.shadow.shadowOpacity,
            shadowRadius: selected ? 15 : Theme.shadow.shadowRadius,
        };
    });

    const handlePress = useCallback(() => {
        void Haptics.selectionAsync();
        onPress(persona);
    }, [onPress, persona]);

    return (
        <TouchableOpacity
            style={[styles.touchable, style]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <Animated.View style={[styles.cardContainer, animatedStyle]}>
                {avatar ? (
                    <Image
                        source={avatar}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={Theme.motion.imageTransition.slow}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>{persona.name[0]}</Text>
                    </View>
                )}

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradient}
                />

                <View style={styles.contentOverlay}>
                    <BlurView intensity={Theme.blur.strong} tint="dark" style={styles.nameBadge}>
                        <Text style={styles.name}>{emojiSummary} {persona.name}</Text>
                    </BlurView>
                </View>

                {selected && (
                    <View style={styles.selectionOverlay}>
                        <View style={styles.checkBadge}>
                            <Ionicons name="checkmark" size={16} color={Theme.colors.white} />
                        </View>
                    </View>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
});

export default PersonaCard;

const styles = StyleSheet.create({
    touchable: {
        width: '100%',
        aspectRatio: 0.75, // Vertically oriented cards
    },
    cardContainer: {
        flex: 1,
        borderRadius: Theme.glass.borderRadius,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassStrong,
        ...Theme.shadow,
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60%',
    },
    contentOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: Theme.spacing.md,
        alignItems: 'center',
    },
    nameBadge: {
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.glass.borderRadius / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorderStrong,
    },
    avatarPlaceholder: {
        backgroundColor: Theme.colors.glassBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: Theme.colors.white,
        fontSize: 48,
        fontWeight: '900',
    },
    name: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: '700',
    },
    selectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(187, 134, 252, 0.08)', // Very subtle primary wash
    },
    checkBadge: {
        position: 'absolute',
        top: Theme.spacing.sm,
        right: Theme.spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...Theme.shadow,
        shadowColor: Theme.colors.primary,
        shadowOpacity: 0.8,
        elevation: 8,
    },
});
