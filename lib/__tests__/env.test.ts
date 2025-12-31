describe('lib/env', () => {
    const oldEnv = process.env;

    function loadEnvModule(overrides: Record<string, string | undefined>) {
        jest.resetModules();
        process.env = { ...oldEnv, ...overrides };
        return require('../env') as typeof import('../env');
    }

    afterAll(() => {
        process.env = oldEnv;
    });

    it('reports missing required vars', () => {
        const { validatePublicEnv } = loadEnvModule({});
        const result = validatePublicEnv();
        expect(result.missingRequired).toContain('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
        expect(result.missingRequired).toContain('EXPO_PUBLIC_FIREBASE_API_KEY');
        expect(result.missingAgentIds.length).toBeGreaterThan(0);
    });

    it('accepts a fully configured env', () => {
        const { validatePublicEnv } = loadEnvModule({
            EXPO_PUBLIC_GOOGLE_CLIENT_ID: 'google-web',
            EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'google-ios',
            EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
            EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
            EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'example',
            EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'example.appspot.com',
            EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
            EXPO_PUBLIC_FIREBASE_APP_ID: 'app',
            EXPO_PUBLIC_CLOUD_FUNCTIONS_URL: 'https://us-central1-example.cloudfunctions.net',
            EXPO_PUBLIC_ELEVENLABS_AGENT_LUNA: 'agent-luna',
            EXPO_PUBLIC_ELEVENLABS_AGENT_KAI: 'agent-kai',
            EXPO_PUBLIC_ELEVENLABS_AGENT_RIVER: 'agent-river',
            EXPO_PUBLIC_ELEVENLABS_AGENT_ECHO: 'agent-echo',
            EXPO_PUBLIC_ELEVENLABS_AGENT_SAGE: 'agent-sage',
            EXPO_PUBLIC_WEB_BASE_URL: 'https://example.com',
        });

        const result = validatePublicEnv();
        expect(result.missingRequired).toEqual([]);
        expect(result.misconfigured).toEqual([]);
        expect(result.missingAgentIds).toEqual([]);
    });

    it('getFirestoreWriteTimeoutMs reads numeric env with fallback', () => {
        const { getFirestoreWriteTimeoutMs } = loadEnvModule({ EXPO_PUBLIC_FIRESTORE_WRITE_TIMEOUT_MS: '5000' });
        expect(getFirestoreWriteTimeoutMs()).toBe(5000);

        const { getFirestoreWriteTimeoutMs: fallbackFn } = loadEnvModule({ EXPO_PUBLIC_FIRESTORE_WRITE_TIMEOUT_MS: 'nope' });
        expect(fallbackFn(3500)).toBe(3500);
    });
});

