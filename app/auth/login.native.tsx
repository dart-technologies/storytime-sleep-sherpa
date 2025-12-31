import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Snowflakes from '../../components/Snowflakes';
import { useOptionalError } from '../../components/ErrorProvider';
import { Theme } from '../../constants/Theme';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
    const { user, loading, signInWithGoogle, signInWithApple } = useAuth();
    const errorToast = useOptionalError();
    const player = useAudioPlayer(require('../../assets/audio/soundscapes/cosmic-winds.mp3'));

    const handleGooglePress = useCallback(() => {
        void (async () => {
            try {
                await signInWithGoogle();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Google sign-in failed.';
                if (errorToast) {
                    errorToast.showToast({ type: 'error', message });
                } else {
                    Alert.alert('Sign-in Failed', message);
                }
            }
        })();
    }, [errorToast, signInWithGoogle]);

    const handleApplePress = useCallback(() => {
        void (async () => {
            try {
                await signInWithApple();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Apple sign-in failed.';
                if (errorToast) {
                    errorToast.showToast({ type: 'error', message });
                } else {
                    Alert.alert('Sign-in Failed', message);
                }
            }
        })();
    }, [errorToast, signInWithApple]);

    useEffect(() => {
        if (!loading && !user && player) {
            player.loop = true;
            player.volume = 0.1;
            player.play();
        }
    }, [loading, user, player]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
            </View>
        );
    }

    if (user) {
        return <Redirect href="/(tabs)/create" />;
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0F0C29', '#302B63', '#24243E']}
                style={StyleSheet.absoluteFill}
            />
            <Snowflakes />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <View style={styles.topSection}>
                        <View style={styles.iconWrapper}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../../assets/images/icon.png')}
                                    style={styles.logo}
                                    contentFit="contain"
                                />
                            </View>
                        </View>

                        <View style={styles.textContainer}>
                            <Text style={styles.brand}>Storytime</Text>
                            <Text style={styles.tagline}>Sleep sherpa</Text>
                        </View>
                    </View>

                    <View style={styles.cardContainer}>
                        <BlurView intensity={Theme.blur.medium} tint="dark" style={styles.loginCard}>
                            <Text style={styles.cardTitle}>Sweet Dreams Await</Text>
                            <Text style={styles.cardDescription}>
                                Snooze to AI-crafted stories
                            </Text>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleGooglePress}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[Theme.colors.white, '#F0F0F0']}
                                    style={StyleSheet.absoluteFill}
                                />
                                <Ionicons name="logo-google" size={20} color={Theme.colors.black} />
                                <Text style={styles.buttonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, { marginTop: Theme.spacing.md }]}
                                onPress={handleApplePress}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#1A1A1A', '#000000']}
                                    style={StyleSheet.absoluteFill}
                                />
                                <Ionicons name="logo-apple" size={22} color={Theme.colors.white} />
                                <Text style={[styles.buttonText, { color: Theme.colors.white }]}>Continue with Apple</Text>
                            </TouchableOpacity>

                            {/* <Text style={styles.footerText}>
                                By continuing, you agree to our Terms of Service.
                            </Text> */}
                        </BlurView>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.black,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: Theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Theme.spacing.xl,
        paddingTop: Theme.spacing.lg,
        paddingBottom: Theme.spacing.lg,
    },
    topSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Theme.spacing.lg,
    },
    iconWrapper: {
        marginBottom: Theme.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        width: 220,
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    logo: {
        width: 200,
        height: 200,
    },
    textContainer: {
        alignItems: 'center',
    },
    brand: {
        fontSize: 44,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        letterSpacing: -1.5,
    },
    tagline: {
        fontSize: 16,
        color: Theme.colors.primary,
        fontWeight: Theme.typography.weights.regular,
        marginTop: -6,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.9,
    },
    cardContainer: {
        width: '100%',
        maxWidth: 400,
        marginBottom: Theme.spacing.md,
    },
    loginCard: {
        padding: Theme.spacing.xl,
        borderRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.white,
        marginBottom: Theme.spacing.xs,
    },
    cardDescription: {
        fontSize: 15,
        color: Theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Theme.spacing.xl,
        paddingHorizontal: Theme.spacing.sm,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: Theme.spacing.xl,
        borderRadius: 22,
        width: '100%',
        overflow: 'hidden',
        gap: 12,
        ...Theme.shadow,
    },
    buttonText: {
        color: Theme.colors.black,
        fontSize: 18,
        fontWeight: Theme.typography.weights.regular,
    },
    footerText: {
        marginTop: Theme.spacing.lg,
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.3)',
        textAlign: 'center',
    },
});
