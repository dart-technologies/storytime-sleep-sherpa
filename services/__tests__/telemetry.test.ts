import { getAnalytics, logEvent, setUserId, setUserProperty } from '@react-native-firebase/analytics';
import { getCrashlytics, log as crashlyticsLog, recordError, setAttributes } from '@react-native-firebase/crashlytics';
import { AnalyticsService } from '../analytics';
import { CrashlyticsService } from '../crashlytics';

// Mock lib/firebase
jest.mock('../../lib/firebase', () => ({
    app: {},
}));

// Mock Firebase Analytics
jest.mock('@react-native-firebase/analytics', () => {
    const analyticsInstance = {};
    return {
        getAnalytics: jest.fn(() => analyticsInstance),
        logEvent: jest.fn(),
        setUserId: jest.fn(),
        setUserProperty: jest.fn(),
    };
});

// Mock Firebase Crashlytics
jest.mock('@react-native-firebase/crashlytics', () => {
    const crashlyticsInstance = {};
    return {
        getCrashlytics: jest.fn(() => crashlyticsInstance),
        log: jest.fn(),
        recordError: jest.fn(),
        setAttributes: jest.fn(),
        setUserId: jest.fn(),
    };
});

describe('Analytics & Crashlytics Services', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('AnalyticsService', () => {
        it('should set user id', async () => {
            await AnalyticsService.setUserId('user-1');
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(setUserId).toHaveBeenCalledWith(analyticsInstance, 'user-1');
        });

        it('should track login attempt', async () => {
            await AnalyticsService.trackLoginAttempt('google');
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(logEvent).toHaveBeenCalledWith(analyticsInstance, 'auth_login_attempt', {
                method: 'google',
            });
        });

        it('should track story generation', async () => {
            await AnalyticsService.trackStoryGeneration('luna', 300);
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(logEvent).toHaveBeenCalledWith(analyticsInstance, 'story_generated', {
                persona_id: 'luna',
                duration_seconds: 300,
            });
        });

        it('should track playback start', async () => {
            await AnalyticsService.trackPlaybackStart('story-1', 'luna');
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(logEvent).toHaveBeenCalledWith(analyticsInstance, 'playback_start', {
                story_id: 'story-1',
                persona_id: 'luna',
            });
        });

        it('should track voice commands', async () => {
            await AnalyticsService.trackVoiceCommand('search', true);
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(logEvent).toHaveBeenCalledWith(analyticsInstance, 'voice_command', {
                command_type: 'search',
                success: true,
            });
        });

        it('should handle analytics errors gracefully', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            (logEvent as jest.Mock).mockRejectedValueOnce(new Error('Firebase Error'));

            await AnalyticsService.trackStoryGeneration('luna', 300);

            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to log story_generated'), expect.any(Error));
            consoleWarnSpy.mockRestore();
        });

        it('should track favorites', async () => {
            await AnalyticsService.trackFavorite('story-1', true);
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(logEvent).toHaveBeenCalledWith(analyticsInstance, 'story_favorite', {
                story_id: 'story-1',
                is_favorited: true,
            });
        });

        it('should set user persona preference', async () => {
            await AnalyticsService.setUserPersonaPreference('luna');
            const analyticsInstance = (getAnalytics as jest.Mock).mock.results[0].value;
            expect(setUserProperty).toHaveBeenCalledWith(analyticsInstance, 'favorite_persona', 'luna');
        });
    });

    describe('CrashlyticsService', () => {
        it('should log errors', () => {
            const error = new Error('Test error');
            CrashlyticsService.logError(error, 'Test Context');
            const crashlyticsInstance = (getCrashlytics as jest.Mock).mock.results[0].value;
            expect(crashlyticsLog).toHaveBeenCalledWith(crashlyticsInstance, 'Context: Test Context');
            expect(recordError).toHaveBeenCalledWith(crashlyticsInstance, error);
        });

        it('should log errors without context', () => {
            const error = new Error('Direct error');
            CrashlyticsService.logError(error);
            const crashlyticsInstance = (getCrashlytics as jest.Mock).mock.results[0].value;
            expect(recordError).toHaveBeenCalledWith(crashlyticsInstance, error);
        });

        it('should set persona context', () => {
            CrashlyticsService.setPersonaContext('kai');
            const crashlyticsInstance = (getCrashlytics as jest.Mock).mock.results[0].value;
            expect(setAttributes).toHaveBeenCalledWith(crashlyticsInstance, {
                active_persona: 'kai',
            });
        });

        it('should log breadcrumbs', () => {
            CrashlyticsService.logBreadcrumb('User tapped play');
            const crashlyticsInstance = (getCrashlytics as jest.Mock).mock.results[0].value;
            expect(crashlyticsLog).toHaveBeenCalledWith(crashlyticsInstance, 'User tapped play');
        });

        it('should set user id', () => {
            const { setUserId: crashlyticsSetUserId } = require('@react-native-firebase/crashlytics');
            CrashlyticsService.setUserId('user-123');
            const crashlyticsInstance = (getCrashlytics as jest.Mock).mock.results[0].value;
            expect(crashlyticsSetUserId).toHaveBeenCalledWith(crashlyticsInstance, 'user-123');
        });
    });
});
