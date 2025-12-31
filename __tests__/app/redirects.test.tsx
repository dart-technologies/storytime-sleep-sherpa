import React from 'react';
import { render } from '@testing-library/react-native';

let mockSearchParams: any = {};
const mockRedirect = jest.fn((_props: any) => null);

jest.mock('expo-router', () => ({
    Redirect: (props: any) => {
        mockRedirect(props);
        return null;
    },
    useLocalSearchParams: () => mockSearchParams,
    Stack: () => null,
}));

const mockAuth = { currentUser: null as any };
jest.mock('../../lib/firebase', () => ({
    auth: mockAuth,
}));

describe('app redirects', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams = {};
        mockAuth.currentUser = null;
    });

    it('redirects web-only tab routes to home', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const CreateWeb = require('../../app/(tabs)/create.tsx').default as typeof import('../../app/(tabs)/create').default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const LibraryWeb = require('../../app/(tabs)/library.tsx').default as typeof import('../../app/(tabs)/library').default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FeaturedWeb = require('../../app/(tabs)/featured.tsx').default as typeof import('../../app/(tabs)/featured').default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const SettingsWeb = require('../../app/(tabs)/settings.tsx').default as typeof import('../../app/(tabs)/settings').default;

        render(<CreateWeb />);
        render(<LibraryWeb />);
        render(<FeaturedWeb />);
        render(<SettingsWeb />);

        expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
    });

    it('redirects web login/intake routes to home', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const LoginWeb = require('../../app/auth/login.tsx').default as typeof import('../../app/auth/login').default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IntakeWeb = require('../../app/create/intake/[personaId].tsx').default as typeof import('../../app/create/intake/[personaId]').default;

        render(<LoginWeb />);
        render(<IntakeWeb />);

        expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
    });

    it('redirects /library/[storyId] on web to /s/[storyId]', () => {
        mockSearchParams = { storyId: 'abc' };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const LibraryStoryWeb = require('../../app/library/[storyId].tsx').default as typeof import('../../app/library/[storyId]').default;

        render(<LibraryStoryWeb />);
        expect(mockRedirect).toHaveBeenCalledWith({
            href: { pathname: '/s/[storyId]', params: { storyId: 'abc' } },
        });
    });

    it('redirects /s/[storyId] on native to /library/[storyId]', () => {
        mockSearchParams = { storyId: 'abc' };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const SharedStoryNative = require('../../app/s/[storyId].native.tsx').default as typeof import('../../app/s/[storyId].native').default;

        render(<SharedStoryNative />);
        expect(mockRedirect).toHaveBeenCalledWith({
            href: { pathname: '/library/[storyId]', params: { storyId: 'abc' } },
        });
    });

    it('routes the native index screen based on auth state', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IndexNative = require('../../app/index.native.tsx').default as typeof import('../../app/index.native').default;

        render(<IndexNative />);
        expect(mockRedirect).toHaveBeenCalledWith({ href: '/auth/login' });

        mockAuth.currentUser = { uid: 'user-1' };
        render(<IndexNative />);
        expect(mockRedirect).toHaveBeenCalledWith({ href: '/(tabs)/create' });
    });

    it('renders the web home page', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const WebHome = require('../../app/index.tsx').default as typeof import('../../app/index').default;
        const { getByText } = render(<WebHome />);
        expect(getByText('Storytime')).toBeTruthy();
    });
});
