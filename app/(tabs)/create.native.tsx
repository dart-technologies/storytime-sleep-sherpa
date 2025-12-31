import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useElevenLabsConversation } from '../../components/ElevenLabsConversationProvider';
import PersonaCard from '../../components/PersonaCard';
import { TabHeader } from '../../components/TabHeader';
import { Theme } from '../../constants/Theme';
import { useAuth } from '../../hooks/useAuth';
import { assertUnderDailyCreateCap } from '../../lib/dailyCreateCap';
import { Persona, personas } from '../../lib/personas';
import { AnalyticsService } from '../../services/analytics';

type SherpaItem =
    | { kind: 'persona'; persona: Persona }
    | { kind: 'custom' };

export default function CreateScreen() {
    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
    const router = useRouter();
    const { remixId, remixContext, remixTitle } = useLocalSearchParams();
    const { playLatencyMask, stopLatencyMask } = useElevenLabsConversation();
    const { user } = useAuth();
    const customTapCountRef = useRef(0);

    const userFirstName = useMemo(() => {
        const trimmed = String(user?.displayName || '').trim();
        if (!trimmed) return 'Custom';
        const first = trimmed.split(/\s+/)[0];
        return first || 'Custom';
    }, [user?.displayName]);

    const normalizedRemixId = useMemo(
        () => (Array.isArray(remixId) ? remixId[0] : remixId),
        [remixId]
    );
    const normalizedRemixContext = useMemo(
        () => (Array.isArray(remixContext) ? remixContext[0] : remixContext),
        [remixContext]
    );
    const normalizedRemixTitle = useMemo(
        () => (Array.isArray(remixTitle) ? remixTitle[0] : remixTitle),
        [remixTitle]
    );

    const clearRemix = useCallback(() => {
        router.setParams({ remixContext: '', remixId: '', remixTitle: '' });
    }, [router]);

    const sherpaItems = useMemo<SherpaItem[]>(
        () => [
            ...personas.map((persona) => ({ kind: 'persona' as const, persona })),
            { kind: 'custom' as const },
        ],
        []
    );

    const handlePersonaSelect = useCallback((persona: Persona) => {
        void (async () => {
            const uid = user?.uid;
            if (uid) {
                try {
                    await assertUnderDailyCreateCap(uid);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    Alert.alert(
                        'Daily Create Limit Reached',
                        message || 'Resets at midnight.'
                    );
                    return;
                }
            }

            setSelectedPersona(persona);
            void AnalyticsService.trackPersonaSelected(persona.id, { isRemix: Boolean(normalizedRemixId?.trim()) });
            stopLatencyMask();
            playLatencyMask(persona, 'welcome');
            router.push({
                pathname: '/create/intake/[personaId]',
                params: {
                    personaId: persona.id,
                    remixId: normalizedRemixId,
                    remixContext: normalizedRemixContext
                }
            });
        })();
    }, [normalizedRemixContext, normalizedRemixId, playLatencyMask, router, stopLatencyMask, user?.uid]);

    const handleCustomSherpaPress = useCallback(() => {
        customTapCountRef.current += 1;
        Alert.alert('Create your own', `COMING S👀N`);
    }, []);

    const renderSherpa = useCallback(({ item, index }: { item: SherpaItem; index: number }) => (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(600).springify()}
            style={styles.gridItem}
        >
            {item.kind === 'persona' ? (
                <PersonaCard
                    persona={item.persona}
                    onPress={handlePersonaSelect}
                    selected={selectedPersona?.id === item.persona.id}
                />
            ) : (
                <TouchableOpacity
                    testID="persona-custom"
                    accessibilityRole="button"
                    accessibilityLabel="Custom sherpa coming soon"
                    activeOpacity={0.8}
                    style={styles.customSherpaTouchable}
                    onPress={handleCustomSherpaPress}
                >
                    <View style={styles.customSherpaCard}>
                        {/* <View style={styles.customSherpaAvatar}>
	                            <Text style={styles.customSherpaAvatarText}>🪄</Text>
	                        </View> */}
                        <BlurView intensity={Theme.blur.strong} tint="dark" style={styles.customSherpaBadge}>
                            <Text style={styles.customSherpaName}>🪄 {userFirstName}</Text>
                        </BlurView>
                    </View>
                </TouchableOpacity>
            )}
        </Animated.View>
    ), [handlePersonaSelect, handleCustomSherpaPress, selectedPersona, userFirstName]);

    const Header = useMemo(() => (
        <TabHeader title="Storytime" inset="none">
            {normalizedRemixId || normalizedRemixContext || normalizedRemixTitle ? (
                <BlurView intensity={Theme.blur.soft} tint="dark" style={styles.remixNotice}>
                    <Ionicons name="git-branch" size={20} color={Theme.colors.primary} />
                    <View style={styles.remixContent}>
                        <Text style={styles.remixLabel}>REMIXING DREAM</Text>
                        <Text style={styles.remixText} numberOfLines={1}>
                            {normalizedRemixTitle || normalizedRemixContext || 'Dream'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={clearRemix} style={styles.clearRemix}>
                        <Ionicons name="close-circle" size={20} color={Theme.colors.textMuted} />
                    </TouchableOpacity>
                </BlurView>
            ) : null}

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>💤 SHERPAS</Text>
                <View style={styles.sectionLine} />
            </View>
        </TabHeader>
    ), [normalizedRemixContext, normalizedRemixId, normalizedRemixTitle, clearRemix]);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <FlatList
                data={sherpaItems}
                renderItem={renderSherpa}
                keyExtractor={(item) => (item.kind === 'persona' ? item.persona.id : 'custom')}
                numColumns={2}
                ListHeaderComponent={Header}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                initialNumToRender={8}
                maxToRenderPerBatch={4}
                windowSize={5}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    container: {
        paddingHorizontal: Theme.spacing.lg,
        paddingBottom: Theme.spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Theme.spacing.xs,
        marginBottom: Theme.spacing.xs,
        gap: Theme.spacing.sm,
    },
    sectionTitle: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.secondary,
        color: Theme.colors.textMuted,
        letterSpacing: 2,
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: Theme.colors.glassBorder,
        opacity: 0.5,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: Theme.spacing.md,
    },
    gridItem: {
        flex: 0.5,
        marginBottom: Theme.spacing.md,
    },
    customSherpaTouchable: {
        width: '100%',
        aspectRatio: 0.75,
    },
    customSherpaCard: {
        flex: 1,
        borderRadius: Theme.glass.borderRadius,
        overflow: 'hidden',
        backgroundColor: Theme.colors.glassStrong,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        alignItems: 'center',
        justifyContent: 'center',
        ...Theme.shadow,
    },
    customSherpaAvatar: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: Theme.colors.black,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorderStrong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    customSherpaAvatarText: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.display,
        marginTop: 2,
    },
    customSherpaBadge: {
        position: 'absolute',
        bottom: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.glass.borderRadius / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorderStrong,
    },
    customSherpaName: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.base,
        fontWeight: Theme.typography.weights.bold,
    },
    remixNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderRadius: Theme.glass.borderRadius,
        marginBottom: Theme.spacing.sm,
        gap: Theme.spacing.md,
        borderWidth: Theme.glass.borderWidth,
        borderColor: Theme.colors.glassBorder,
        overflow: 'hidden',
    },
    remixContent: {
        flex: 1,
    },
    remixLabel: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.primary,
        color: Theme.colors.primary,
        letterSpacing: 1,
        marginBottom: 2,
    },
    remixText: {
        color: Theme.colors.white,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.secondary,
    },
    clearRemix: {
        padding: Theme.spacing.xs,
    },
});
