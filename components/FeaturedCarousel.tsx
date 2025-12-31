import React from 'react';
import { BlurView } from 'expo-blur';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Theme } from '../constants/Theme';
import { SEASONAL_SPECIALS, SeasonalSpecial } from '../lib/seasonalSpecials';

export type FeaturedStory = SeasonalSpecial;

interface FeaturedCarouselProps {
    onSelect: (story: FeaturedStory) => void;
}

const FeaturedCarousel = React.memo(function FeaturedCarousel({ onSelect }: FeaturedCarouselProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Seasonal Specials</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {SEASONAL_SPECIALS.map((story, index) => (
                    <Animated.View
                        key={story.id}
                        entering={FadeInRight.duration(Theme.motion.duration.slow).delay(index * Theme.motion.delay.stagger).springify().damping(Theme.motion.spring.gentle.damping).stiffness(Theme.motion.spring.gentle.stiffness)}
                    >
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => onSelect(story)}
                            activeOpacity={0.8}
                        >
                            <ImageBackground
                                source={{ uri: story.image }}
                                style={styles.image}
                                imageStyle={styles.imageBorder}
                            >
                                <BlurView intensity={Theme.blur.medium} tint="dark" style={styles.overlay}>
                                    <Text style={styles.themeTag}>{story.theme}</Text>
                                    <Text style={styles.title}>{story.title}</Text>
                                </BlurView>
                            </ImageBackground>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );
});

export default FeaturedCarousel;

const styles = StyleSheet.create({
    container: {
        marginVertical: Theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Theme.colors.text,
        marginLeft: Theme.spacing.lg,
        marginBottom: Theme.spacing.md,
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingLeft: Theme.spacing.lg,
        paddingRight: Theme.spacing.md,
    },
    card: {
        width: 260,
        height: 180,
        marginRight: Theme.spacing.md,
        borderRadius: Theme.glass.borderRadius,
        overflow: 'hidden',
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        ...Theme.shadow,
    },
    image: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    imageBorder: {
        borderRadius: Theme.glass.borderRadius,
    },
    overlay: {
        padding: Theme.spacing.md,
        borderTopWidth: Theme.glass.borderWidth,
        borderTopColor: Theme.colors.glassBorder,
    },
    themeTag: {
        fontSize: 10,
        fontWeight: '700',
        color: Theme.colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Theme.colors.white,
        lineHeight: 22,
    },
});
