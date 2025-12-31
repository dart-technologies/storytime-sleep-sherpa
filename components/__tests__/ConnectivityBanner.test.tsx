import React from 'react';
import { render } from '@testing-library/react-native';
import ConnectivityBanner from '../ConnectivityBanner';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

let mockNetworkState: any = { isInternetReachable: true };
jest.mock('expo-network', () => ({
    useNetworkState: () => mockNetworkState,
}));

describe('components/ConnectivityBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockNetworkState = { isInternetReachable: true };
    });

    it('renders nothing when online', () => {
        const { queryByText } = render(<ConnectivityBanner />);
        expect(queryByText('Offline Mode')).toBeNull();
    });

    it('renders an offline banner when disconnected', () => {
        mockNetworkState = { isInternetReachable: false };
        const { getByText } = render(<ConnectivityBanner />);
        expect(getByText('Offline Mode')).toBeTruthy();
    });
});

