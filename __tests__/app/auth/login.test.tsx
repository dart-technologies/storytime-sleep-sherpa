
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockSignInWithGoogle = jest.fn();
let mockUser: any = null;
let mockLoading = false;

jest.mock('expo-audio', () => ({
    useAudioPlayer: () => ({
        loop: false,
        volume: 1,
        play: jest.fn(),
        pause: jest.fn(),
    }),
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        loading: mockLoading,
        signInWithGoogle: mockSignInWithGoogle,
    }),
}));

jest.mock('expo-router', () => ({
    Redirect: jest.fn(() => null),
}));

jest.mock('expo-linear-gradient', () => ({
    LinearGradient: ({ children }: any) => children,
}));

jest.mock('../../../components/Snowflakes', () => 'Snowflakes');

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LoginScreen = require('../../../app/auth/login').default;

describe('LoginScreen', () => {
    beforeEach(() => {
        mockUser = null;
        mockLoading = false;
        jest.clearAllMocks();
    });

    it('shows loading indicator when loading', () => {
        mockLoading = true;
        const { queryByText } = render(<LoginScreen />);
        expect(queryByText('Continue with Google')).toBeNull();
    });

    it('redirects when user is logged in', () => {
        mockUser = { uid: '123' };
        const { Redirect } = require('expo-router');
        render(<LoginScreen />);
        expect(Redirect.mock.calls[0][0]).toEqual(expect.objectContaining({ href: '/(tabs)/create' }));
    });

    it('shows login button when not logged in', () => {
        const { getByText } = render(<LoginScreen />);
        const btn = getByText('Continue with Google');
        expect(btn).toBeTruthy();

        fireEvent.press(btn);
        expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
});
