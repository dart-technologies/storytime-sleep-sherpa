import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '../../components/TabHeader';
import { Theme } from '../../constants/Theme';
import { useOfflineFavoritesDownloadsEnabled } from '../../hooks/offline/useOfflineFavoritesDownloadsEnabled';
import { useOfflineFavoritesDownloadsStats } from '../../hooks/offline/useOfflineFavoritesDownloadsStats';
import { useAuth } from '../../hooks/useAuth';
import { useDailyCreateCap } from '../../hooks/useDailyCreateCap';
import { useStories } from '../../hooks/useStories';
import { isDebugLoggingEnabled } from '../../lib/debugLogger';
import { formatCountLabel } from '../../lib/formatUtils';
import { CrashlyticsService } from '../../services/crashlytics';

export default function SettingsScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const showDebug = isDebugLoggingEnabled();
    const { enabled: offlineFavoritesEnabled, loading: offlineFavoritesLoading, setEnabled: setOfflineFavoritesEnabled } = useOfflineFavoritesDownloadsEnabled();
    const offlineFavoritesStats = useOfflineFavoritesDownloadsStats();
    const dailyCap = useDailyCreateCap(user?.uid);
    const { myStories } = useStories();

    const offlineDownloadsDetail = useMemo(() => {
        const fileCount = offlineFavoritesEnabled
            ? (typeof offlineFavoritesStats.cachedEligibleCount === 'number' ? offlineFavoritesStats.cachedEligibleCount : 0)
            : 0;
        const bytes = offlineFavoritesEnabled
            ? (typeof offlineFavoritesStats.cachedBytes === 'number' ? offlineFavoritesStats.cachedBytes : 0)
            : 0;

        const mb = bytes / (1024 * 1024);
        const mbLabel = `${(Number.isFinite(mb) ? mb : 0).toFixed(1)} MB`;
        return `${fileCount} file${fileCount === 1 ? '' : 's'} • ${mbLabel}`;
    }, [offlineFavoritesEnabled, offlineFavoritesStats.cachedBytes, offlineFavoritesStats.cachedEligibleCount]);

    const profileTotals = useMemo(() => {
        let totalListens = 0;
        let totalRemixes = 0;
        let totalFavorites = 0;

        myStories.forEach((story) => {
            totalListens += typeof story.playCount === 'number' && Number.isFinite(story.playCount) ? story.playCount : 0;
            totalRemixes += typeof story.remixCount === 'number' && Number.isFinite(story.remixCount) ? story.remixCount : 0;
            totalFavorites += typeof story.favoritedCount === 'number' && Number.isFinite(story.favoritedCount) ? story.favoritedCount : 0;
        });

        return {
            listens: formatCountLabel(totalListens),
            remixes: formatCountLabel(totalRemixes),
            favorites: formatCountLabel(totalFavorites),
        };
    }, [myStories]);

    const handleLogout = useCallback(async () => {
        await signOut();
        router.replace('/auth/login');
    }, [signOut, router]);

    const handleOfflineFavoritesChange = useCallback((next: boolean) => {
        void (async () => {
            await setOfflineFavoritesEnabled(next);
            try {
                await offlineFavoritesStats.refresh();
            } catch {
                // ignore
            }
        })();
    }, [offlineFavoritesStats, setOfflineFavoritesEnabled]);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <TabHeader title="Settings" />

                <View style={styles.content}>
                    <BlurView intensity={Theme.blur.soft} tint="dark" style={styles.profileCard}>
                        <View style={styles.profileSummaryRow}>
                            <View style={styles.profileAvatarContainer}>
                                {user?.photoURL ? (
                                    <Image
                                        source={{ uri: user.photoURL }}
                                        style={styles.profileAvatar}
                                        contentFit="cover"
                                        transition={Theme.motion.imageTransition.slow}
                                    />
                                ) : (
                                    <View style={styles.profileAvatarPlaceholder}>
                                        <Ionicons name="person" size={20} color={Theme.colors.textMuted} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.profileStatsRow}>
                                <View style={styles.profileStat}>
                                    <Ionicons name="headset-outline" size={18} color={Theme.colors.textMuted} />
                                    <Text style={styles.profileStatValue}>{profileTotals.listens}</Text>
                                </View>
                                <View style={styles.profileStatDivider} />
                                <View style={styles.profileStat}>
                                    <Ionicons name="git-branch-outline" size={18} color={Theme.colors.textMuted} />
                                    <Text style={styles.profileStatValue}>{profileTotals.remixes}</Text>
                                </View>
                                <View style={styles.profileStatDivider} />
                                <View style={styles.profileStat}>
                                    <Ionicons name="heart-outline" size={18} color={Theme.colors.textMuted} />
                                    <Text style={styles.profileStatValue}>{profileTotals.favorites}</Text>
                                </View>
                            </View>
                        </View>
                    </BlurView>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PLAYBACK</Text>
                        <BlurView intensity={Theme.blur.subtle} tint="dark" style={styles.sectionCard}>
                            <View style={styles.menuItem}>
                                <View style={[styles.iconContainer, { backgroundColor: Theme.colors.glassStrong }]}>
                                    <Ionicons name="cloud-download-outline" size={20} color={Theme.colors.white} />
                                </View>
                                <View style={styles.menuTextBlock}>
                                    <Text style={styles.menuText}>Offline</Text>
                                    <Text style={styles.menuSubtext}>{offlineDownloadsDetail}</Text>
                                </View>
                                <View style={styles.toggleRow}>
                                    <Switch
                                        testID="settings-offline-favorites-toggle"
                                        accessibilityLabel={offlineFavoritesEnabled ? 'Disable offline downloads for favorites' : 'Enable offline downloads for favorites'}
                                        value={offlineFavoritesEnabled}
                                        onValueChange={handleOfflineFavoritesChange}
                                        disabled={offlineFavoritesLoading}
                                        ios_backgroundColor={Theme.colors.glassBorder}
                                        trackColor={{
                                            false: Theme.colors.glassBorder,
                                            true: Theme.colors.primarySoft,
                                        }}
                                        thumbColor={Platform.OS === 'android' ? Theme.colors.white : undefined}
                                        style={Platform.OS === 'ios' ? styles.toggleSwitch : undefined}
                                    />
                                    <Ionicons
                                        name={offlineFavoritesEnabled ? 'heart' : 'heart-outline'}
                                        size={16}
                                        color={offlineFavoritesEnabled ? Theme.colors.error : Theme.colors.textMuted}
                                        style={{ opacity: 0.9 }}
                                    />
                                </View>
                            </View>
                        </BlurView>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>ACCOUNT</Text>
                        <BlurView intensity={Theme.blur.subtle} tint="dark" style={styles.sectionCard}>
                            <View style={styles.menuItem}>
                                <View style={[styles.iconContainer, { backgroundColor: Theme.colors.glassStrong }]}>
                                    <Ionicons name="sparkles-outline" size={20} color={Theme.colors.white} />
                                </View>
                                <View style={styles.menuTextBlock}>
                                    <Text style={styles.menuText}>Daily creates</Text>
                                    <Text style={styles.menuSubtext}>Resets at midnight</Text>
                                </View>
                                <Text style={styles.menuValue}>
                                    {dailyCap.countToday}/{dailyCap.limit}
                                </Text>
                            </View>

                            <View style={styles.sectionDivider} />

                            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                                <View style={[styles.iconContainer, { backgroundColor: Theme.colors.errorWash }]}>
                                    <Ionicons name="log-out-outline" size={20} color={Theme.colors.error} />
                                </View>
                                <Text style={[styles.menuText, { color: Theme.colors.error }]}>Log Out</Text>
                                <Ionicons name="chevron-forward" size={18} color={Theme.colors.textMuted} />
                            </TouchableOpacity>
                        </BlurView>
                    </View>

                    {showDebug ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>DIAGNOSTICS</Text>
                            <BlurView intensity={Theme.blur.subtle} tint="dark" style={styles.sectionCard}>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => CrashlyticsService.logNonFatal('Test Non-Fatal Error')}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: Theme.colors.successWash }]}>
                                        <Ionicons name="checkmark-circle-outline" size={20} color={Theme.colors.success} />
                                    </View>
                                    <Text style={styles.menuText}>Send Test Error</Text>
                                    <Ionicons name="chevron-forward" size={18} color={Theme.colors.textMuted} />
                                </TouchableOpacity>

                                <View style={{ height: 1, backgroundColor: Theme.colors.glassBorder, marginHorizontal: Theme.spacing.md }} />

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => CrashlyticsService.crash()}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: Theme.colors.warningWash }]}>
                                        <Ionicons name="bug-outline" size={20} color={Theme.colors.warning} />
                                    </View>
                                    <Text style={styles.menuText}>Test Crash</Text>
                                    <Ionicons name="chevron-forward" size={18} color={Theme.colors.textMuted} />
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    ) : null}

                    <View style={styles.versionContainer}>
                        <Image
                            source={require('../../assets/images/icon.png')}
                            style={styles.versionLogo}
                            contentFit="contain"
                        />
                        <Text style={styles.versionText}>Storytime v{Constants.expoConfig?.version || '1.0.0'}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    container: {
        paddingBottom: 100,
    },
    content: {
        paddingHorizontal: Theme.spacing.lg,
    },
    profileCard: {
        padding: Theme.spacing.md,
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
        marginBottom: Theme.spacing.xl,
    },
    profileSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    profileAvatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorderStrong,
        backgroundColor: Theme.colors.glassSubtle,
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    profileAvatarPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: {
        marginBottom: Theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
        color: Theme.colors.textMuted,
        letterSpacing: 2,
        marginBottom: Theme.spacing.xs,
        marginLeft: Theme.spacing.xs,
    },
    sectionCard: {
        borderRadius: Theme.glass.borderRadius,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        gap: Theme.spacing.md,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.text,
    },
    menuTextBlock: {
        flex: 1,
        gap: 2,
    },
    menuSubtext: {
        color: Theme.colors.textMuted,
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
        lineHeight: 16,
    },
    menuValue: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    toggleSwitch: {
        transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    },
    sectionDivider: {
        height: 1,
        backgroundColor: Theme.colors.glassBorder,
        marginHorizontal: Theme.spacing.md,
        opacity: 0.7,
    },
    profileStatsRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        flex: 1,
        paddingLeft: Theme.spacing.sm,
    },
    profileStat: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        paddingVertical: Theme.spacing.sm,
    },
    profileStatValue: {
        color: Theme.colors.white,
        fontSize: 16,
        fontWeight: Theme.typography.weights.primary,
    },
    profileStatDivider: {
        width: 1,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.7,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: Theme.spacing.xxl,
    },
    versionLogo: {
        width: 48,
        height: 48,
        marginBottom: Theme.spacing.sm,
        opacity: 0.88,
    },
    versionText: {
        color: Theme.colors.textMuted,
        fontSize: 12,
        fontWeight: Theme.typography.weights.secondary,
        opacity: 0.5,
    },
    versionSubtext: {
        color: Theme.colors.textMuted,
        fontSize: 10,
        fontWeight: Theme.typography.weights.secondary,
        marginTop: 4,
    },
});
