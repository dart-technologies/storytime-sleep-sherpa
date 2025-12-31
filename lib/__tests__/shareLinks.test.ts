import { getShareBaseUrlFromEnv, getStoryShareUrl, getWebBaseUrlFromEnv } from '../shareLinks';

describe('lib/shareLinks', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        process.env = { ...oldEnv };
        delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
        delete process.env.EXPO_PUBLIC_SHARE_BASE_URL;
        delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
        delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
        delete process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
        delete process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    it('getWebBaseUrlFromEnv returns null when unset or invalid', () => {
        expect(getWebBaseUrlFromEnv()).toBeNull();

        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'ftp://example.com';
        expect(getWebBaseUrlFromEnv()).toBeNull();

        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://';
        expect(getWebBaseUrlFromEnv()).toBeNull();
    });

    it('getWebBaseUrlFromEnv returns a trimmed base url without trailing slash', () => {
        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://example.com/';
        expect(getWebBaseUrlFromEnv()).toBe('https://example.com');
    });

    it('getShareBaseUrlFromEnv prefers EXPO_PUBLIC_SHARE_BASE_URL when valid', () => {
        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://web.example.com';
        process.env.EXPO_PUBLIC_SHARE_BASE_URL = 'https://share.example.com/';
        expect(getShareBaseUrlFromEnv()).toBe('https://share.example.com');
    });

    it('getShareBaseUrlFromEnv ignores invalid EXPO_PUBLIC_SHARE_BASE_URL', () => {
        process.env.EXPO_PUBLIC_SHARE_BASE_URL = 'share.example.com';
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'example-project';
        expect(getShareBaseUrlFromEnv()).toBe('https://example-project.web.app');
    });

    it('getShareBaseUrlFromEnv falls back to web base url', () => {
        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://web.example.com/';
        expect(getShareBaseUrlFromEnv()).toBe('https://web.example.com');
    });

    it('getShareBaseUrlFromEnv falls back to firebase hosting when project id is set', () => {
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'example-project';
        expect(getShareBaseUrlFromEnv()).toBe('https://example-project.web.app');
    });

    it('getStoryShareUrl returns null without a share base url', () => {
        expect(getStoryShareUrl('story-1')).toBeNull();
    });

    it('getStoryShareUrl can infer a firebase share domain from firebase storage urls', () => {
        const audioUrl =
            'https://firebasestorage.googleapis.com/v0/b/my-project.appspot.com/o/stories%2Fstory-1.mp3?alt=media&token=abc';
        expect(getStoryShareUrl(' story id ', [audioUrl])).toBe('https://my-project.web.app/s/story%20id');
    });

    it('getStoryShareUrl builds a share link', () => {
        process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://web.example.com';
        expect(getStoryShareUrl(' story id ')).toBe('https://web.example.com/s/story%20id');
    });

    it('getStoryShareUrl builds a firebase hosting share link when project id is set', () => {
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'example-project';
        expect(getStoryShareUrl(' story id ')).toBe('https://example-project.web.app/s/story%20id');
    });
});
