import React from 'react';
import { render } from '@testing-library/react-native';
import StorySkeleton from '../StorySkeleton';

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

describe('StorySkeleton', () => {
    it('renders correctly', () => {
        render(<StorySkeleton />);
        // Since it's a skeleton, it doesn't have text, but we can verify it renders without crashing
        // and has the expected structure if we add testIDs or just verify presence.
    });
});
