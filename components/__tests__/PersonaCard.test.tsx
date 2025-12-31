import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PersonaCard from '../PersonaCard';
import * as Haptics from 'expo-haptics';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = jest.requireActual('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

// Mock expo-blur
jest.mock('expo-blur', () => ({
    BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    selectionAsync: jest.fn(),
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Selection: 'selection',
    },
}));

const mockPersona = {
    id: 'kai' as const,
    name: 'Kai',
    specialty: 'Ocean Meditations',
    voiceProfile: 'Male, Deep',
    avatar: 'kai.png',
    voiceId: 'voice-kai',
    agentId: 'agent-kai',
    welcomeGreeting: 'Welcome to the deep.',
    personalizationHook: 'Imagine the waves...',
    systemPrompt: 'You are Kai...',
};

describe('PersonaCard', () => {
    it('calls onPress and haptics when pressed', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <PersonaCard persona={mockPersona} onPress={onPress} />
        );

        fireEvent.press(getByText(/Kai/));

        expect(onPress).toHaveBeenCalledWith(mockPersona);
        expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
});
