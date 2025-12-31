import { getAnalytics, logEvent, setUserId, setUserProperty } from '@react-native-firebase/analytics';
import { app } from '../lib/firebase';
import { CrashlyticsService } from './crashlytics';

const getAnalyticsInstance = () => getAnalytics(app);

async function safeLogEvent(name: string, params?: Record<string, unknown>) {
    try {
        await logEvent(getAnalyticsInstance(), name, params);
    } catch (e) {
        console.warn(`[Analytics] Failed to log ${name}`, e);
    }
}

/**
 * Analytics Service for Storytime
 * Centralizes all event tracking for the application.
 */
export const AnalyticsService = {
    setUserId: async (userId: string | null) => {
        try {
            await setUserId(getAnalyticsInstance(), userId);
            CrashlyticsService.setUserId(userId);
        } catch (e) {
            console.warn('[Analytics] Failed to set user id', e);
        }
    },

    trackLoginAttempt: async (method: 'google' | 'apple') => {
        await safeLogEvent('auth_login_attempt', {
            method,
        });
    },

    trackLogin: async (method: 'google' | 'apple', options?: { isNewUser?: boolean }) => {
        await safeLogEvent('auth_login', {
            method,
            ...(typeof options?.isNewUser === 'boolean' ? { is_new_user: options.isNewUser ? 1 : 0 } : {}),
        });
    },

    trackLoginError: async (method: 'google' | 'apple', options?: { code?: string }) => {
        await safeLogEvent('auth_login_error', {
            method,
            ...(options?.code ? { error_code: options.code } : {}),
        });
    },

    trackLogout: async () => {
        await safeLogEvent('auth_logout');
    },

    trackPersonaSelected: async (personaId: string, options?: { isRemix?: boolean }) => {
        await safeLogEvent('persona_selected', {
            persona_id: personaId,
            ...(typeof options?.isRemix === 'boolean' ? { is_remix: options.isRemix ? 1 : 0 } : {}),
        });
    },

    trackStoryGenerationStart: async (personaId: string, durationSec: number, options?: { source?: 'create' | 'remix' }) => {
        await safeLogEvent('story_generation_start', {
            persona_id: personaId,
            duration_seconds: durationSec,
            ...(options?.source ? { source: options.source } : {}),
        });
    },

    /**
     * Track when a story is generated
     */
    trackStoryGeneration: async (
        personaId: string,
        durationSec: number,
        options?: {
            storyId?: string;
            source?: 'create' | 'remix';
        }
    ) => {
        await safeLogEvent('story_generated', {
            persona_id: personaId,
            duration_seconds: durationSec,
            ...(options?.storyId ? { story_id: options.storyId } : {}),
            ...(options?.source ? { source: options.source } : {}),
        });
    },

    /**
     * Track when playback starts
     */
    trackPlaybackStart: async (storyId: string, personaId: string) => {
        await safeLogEvent('playback_start', {
            story_id: storyId,
            persona_id: personaId,
        });
    },

    trackPlaybackComplete: async (storyId: string, personaId: string) => {
        await safeLogEvent('playback_complete', {
            story_id: storyId,
            persona_id: personaId,
        });
    },

    /**
     * Track when a story is favorited
     */
    trackFavorite: async (storyId: string, isFavorited: boolean) => {
        await safeLogEvent('story_favorite', {
            story_id: storyId,
            is_favorited: isFavorited,
        });
    },

    trackShare: async (storyId: string, options?: { shareKind?: 'share_link' | 'audio_url' }) => {
        await safeLogEvent('story_share', {
            story_id: storyId,
            ...(options?.shareKind ? { share_kind: options.shareKind } : {}),
        });
    },

    trackStoryVisibility: async (storyId: string, isPublic: boolean) => {
        await safeLogEvent('story_visibility_changed', {
            story_id: storyId,
            is_public: isPublic ? 1 : 0,
        });
    },

    /**
     * Track when voice navigation is used
     */
    trackVoiceCommand: async (commandType: string, success: boolean) => {
        await safeLogEvent('voice_command', {
            command_type: commandType,
            success: success,
        });
    },

    trackStoryDeleted: async (storyId: string) => {
        await safeLogEvent('story_deleted', { story_id: storyId });
    },

    /**
     * Set user properties
     */
    setUserPersonaPreference: async (personaId: string) => {
        try {
            await setUserProperty(getAnalyticsInstance(), 'favorite_persona', personaId);
        } catch (e) {
            console.warn('[Analytics] Failed to set user property', e);
        }
    }
};
