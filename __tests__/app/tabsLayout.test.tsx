import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
    Stack: () => null,
}));

jest.mock('expo-router/unstable-native-tabs', () => {
    const Trigger = ({ children }: any) => children;
    const NativeTabs = ({ children }: any) => children;
    (NativeTabs as any).Trigger = Trigger;
    return {
        NativeTabs,
        Icon: () => null,
        Label: ({ children }: any) => children,
    };
});

describe('app/(tabs)/_layout', () => {
    it('renders the web stack layout', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TabsLayoutWeb = require('../../app/(tabs)/_layout.tsx').default as typeof import('../../app/(tabs)/_layout').default;
        render(<TabsLayoutWeb />);
    });

    it('renders the native tabs layout', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TabsLayoutNative = require('../../app/(tabs)/_layout.native.tsx').default as typeof import('../../app/(tabs)/_layout.native').default;
        render(<TabsLayoutNative />);
    });
});
