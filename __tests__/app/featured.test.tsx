
import React from 'react';
import { render } from '@testing-library/react-native';

// Mocks
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    Tabs: { Screen: ({ options }: any) => null },
}));

jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackFavorite: jest.fn(),
    },
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'Light',
        Medium: 'Medium',
    },
    NotificationFeedbackType: {
        Success: 'Success',
    },
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('../../hooks/useVoiceNavigation', () => ({
    useVoiceNavigation: () => ({
        searchQuery: '',
        isListening: false,
        stopVoiceSearch: jest.fn(),
        status: 'disconnected',
    }),
}));

const mockFeaturedStories: any[] = [];
jest.mock('../../hooks/useStories', () => ({
    useStories: () => ({
        myStories: [],
        featuredStories: mockFeaturedStories,
        loading: false,
        refresh: jest.fn(),
        deleteStory: jest.fn(),
        toggleFavorite: jest.fn(),
    }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FeaturedScreen = require('../../app/(tabs)/featured').default;

describe('FeaturedScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFeaturedStories.length = 0;
    });

    it('sorts stories by playCount desc', () => {
        mockFeaturedStories.push(
            {
                id: 's1',
                title: 'Low Plays',
                personaId: 'luna',
                personaName: 'Luna',
                summary: 'Story one',
                duration: 120,
                createdAt: 100,
                isPublic: true,
                isFavorite: false,
                playCount: 3,
            },
            {
                id: 's2',
                title: 'High Plays',
                personaId: 'sage',
                personaName: 'Sage',
                summary: 'Story two',
                duration: 120,
                createdAt: 200,
                isPublic: true,
                isFavorite: false,
                playCount: 10,
            }
        );

        const { getAllByTestId } = render(<FeaturedScreen />);
        const cards = getAllByTestId(/library-story-card-/);
        expect(cards[0].props.testID).toBe('library-story-card-s2');
        expect(cards[1].props.testID).toBe('library-story-card-s1');
    });
});
