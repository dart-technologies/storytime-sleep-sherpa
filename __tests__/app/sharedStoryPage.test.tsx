import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('expo-router/head', () => {
    return ({ children }: any) => children;
});

let mockStoryIdParam: string | string[] | undefined = undefined;
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ storyId: mockStoryIdParam }),
}));

const mockFetchSharedStory = jest.fn();
jest.mock('../../lib/sharedStory', () => ({
    fetchSharedStory: (...args: any[]) => mockFetchSharedStory(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SharedStoryPage = require('../../app/s/[storyId].tsx').default;

describe('SharedStoryPage', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        mockStoryIdParam = undefined;
        process.env = { ...oldEnv, EXPO_PUBLIC_WEB_BASE_URL: 'https://example.com' };
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    it('shows an error when storyId is missing', async () => {
        const { getByText } = render(<SharedStoryPage />);

        await waitFor(() => {
            expect(getByText('Missing story id.')).toBeTruthy();
        });
    });

    it('loads and displays a shared story', async () => {
        mockStoryIdParam = 'story-1';
        mockFetchSharedStory.mockResolvedValueOnce({
            id: 'story-1',
            title: 'A Title',
            summary: 'A summary',
            personaName: 'Luna',
            duration: 300,
            isPublic: true,
        });

        const { getByText, queryByText } = render(<SharedStoryPage />);

        await waitFor(() => {
            expect(getByText('A Title')).toBeTruthy();
            expect(getByText('A summary')).toBeTruthy();
        });

        expect(queryByText('Missing story id.')).toBeNull();
    });

    it('shows an error when fetchSharedStory fails', async () => {
        mockStoryIdParam = 'story-2';
        mockFetchSharedStory.mockRejectedValueOnce(new Error('Not found'));

        const { getByText } = render(<SharedStoryPage />);

        await waitFor(() => {
            expect(getByText('Not found')).toBeTruthy();
        });
    });
});
