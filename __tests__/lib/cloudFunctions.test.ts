// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    getGeminiCloudEndpointsFromEnv,
    getNarrateCloudEndpointFromEnv,
    getSharedStoryCloudEndpointFromEnv,
    isHttpUrl,
    joinUrl,
    resolveCloudFunctionUrl,
    resolveCloudFunctionUrlFromEnv,
} = require('../../lib/cloudFunctions');

describe('lib/cloudFunctions', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        process.env = { ...oldEnv };
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL;
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE;
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTION_VISION;
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE;
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY;
        delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
        delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
        delete process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
        delete process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;
        delete process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION;
        delete process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_REGION;
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    describe('helpers', () => {
        it('isHttpUrl detects http/https', () => {
            expect(isHttpUrl('http://example.com')).toBe(true);
            expect(isHttpUrl('https://api.test')).toBe(true);
            expect(isHttpUrl('ftp://example.com')).toBe(false);
            expect(isHttpUrl('/local/path')).toBe(false);
        });

        it('joinUrl concatenates correctly', () => {
            expect(joinUrl('https://api.com', 'foo')).toBe('https://api.com/foo');
            expect(joinUrl('https://api.com/', 'foo')).toBe('https://api.com/foo');
            expect(joinUrl('https://api.com', '/foo')).toBe('https://api.com/foo');
            expect(joinUrl('https://api.com/', '/foo')).toBe('https://api.com/foo');
        });
    });

    describe('resolveCloudFunctionUrl', () => {
        it('returns endpoint if it is a full URL', () => {
            expect(resolveCloudFunctionUrl('https://base.com', 'https://override.com/func')).toBe('https://override.com/func');
        });

        it('joins base and endpoint if endpoint is relative', () => {
            expect(resolveCloudFunctionUrl('https://base.com', 'func')).toBe('https://base.com/func');
        });

        it('returns null if both are missing/invalid', () => {
            expect(resolveCloudFunctionUrl(undefined, undefined)).toBeNull();
            expect(resolveCloudFunctionUrl('https://base.com', '')).toBeNull();
            expect(resolveCloudFunctionUrl('', 'func')).toBeNull();
        });
    });

    describe('resolveCloudFunctionUrlFromEnv', () => {
        it('resolves from specific env var override', () => {
            expect(resolveCloudFunctionUrlFromEnv('https://specific.com', 'ANY_VAR')).toBe('https://specific.com');
        });

        it('infers from firebase project id when endpoint is relative', () => {
            process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'example-project';
            expect(resolveCloudFunctionUrlFromEnv('/sharedStory', 'ANY_VAR')).toBe(
                'https://us-central1-example-project.cloudfunctions.net/sharedStory'
            );
        });

        it('throws if URL cannot be resolved', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL = '';
            expect(() => resolveCloudFunctionUrlFromEnv(undefined, 'MY_VAR')).toThrow(/Missing Cloud Function URL/);
        });
    });

    describe('getGeminiCloudEndpointsFromEnv', () => {
        it('uses defaults if env vars are missing', () => {
            const endpoints = getGeminiCloudEndpointsFromEnv();
            expect(endpoints.generate).toBe('/generate');
            expect(endpoints.vision).toBe('/vision');
            expect(endpoints.illustrate).toBe('/illustrate');
        });

        it('infers illustrate from generate Cloud Run URL', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE = 'https://story-generate-xyz-uc.a.run.app';
            const endpoints = getGeminiCloudEndpointsFromEnv();
            expect(endpoints.illustrate).toBe('https://illustrate-generate-xyz-uc.a.run.app/');
        });

        it('infers illustrate from vision Cloud Functions URL', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTION_VISION = 'https://us-central1-proj.cloudfunctions.net/vision';
            const endpoints = getGeminiCloudEndpointsFromEnv();
            expect(endpoints.illustrate).toBe('https://us-central1-proj.cloudfunctions.net/illustrate');
        });
    });

    describe('getNarrateCloudEndpointFromEnv', () => {
        it('uses explicit variable if present', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE = 'https://custom-narrate.com';
            expect(getNarrateCloudEndpointFromEnv()).toBe('https://custom-narrate.com');
        });

        it('infers from sibling service', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE = 'https://story-generate-abc.a.run.app';
            const result = getNarrateCloudEndpointFromEnv();
            expect(result).toBe('https://narrate-generate-abc.a.run.app/');
        });

        it('falls back to /narrate', () => {
            expect(getNarrateCloudEndpointFromEnv()).toBe('/narrate');
        });
    });

    describe('getSharedStoryCloudEndpointFromEnv', () => {
        it('uses explicit variable if present', () => {
            process.env.EXPO_PUBLIC_CLOUD_FUNCTION_SHARED_STORY = 'https://shared.example.com';
            expect(getSharedStoryCloudEndpointFromEnv()).toBe('https://shared.example.com');
        });

        it('infers from firebase project id when nothing else is set', () => {
            process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'example-project';
            expect(getSharedStoryCloudEndpointFromEnv()).toBe('https://us-central1-example-project.cloudfunctions.net/sharedStory');
        });

        it('infers from firebase auth domain when project id is unset', () => {
            process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'example-project.firebaseapp.com';
            expect(getSharedStoryCloudEndpointFromEnv()).toBe('https://us-central1-example-project.cloudfunctions.net/sharedStory');
        });

        it('falls back to /sharedStory', () => {
            expect(getSharedStoryCloudEndpointFromEnv()).toBe('/sharedStory');
        });
    });
});
