const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
}));
const mockVertexAIConstructor = jest.fn((_config: any) => ({
    getGenerativeModel: mockGetGenerativeModel,
}));

jest.mock('@google-cloud/vertexai', () => ({
    VertexAI: class {
        constructor(config: any) {
            return mockVertexAIConstructor(config);
        }
    },
    SchemaType: {
        OBJECT: 'OBJECT',
        STRING: 'STRING',
        INTEGER: 'INTEGER',
    },
}));

describe('functions/src/vertex env resolution', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env = { ...OLD_ENV };
        delete process.env.GCLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT_ID;
        delete process.env.GCP_PROJECT;
        delete process.env.FIREBASE_CONFIG;
        delete process.env.VERTEX_AI_LOCATION;
        delete process.env.VERTEX_AI_API_ENDPOINT;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('throws when project id cannot be resolved', async () => {
        const { generateStory } = require('../src/vertex') as typeof import('../src/vertex');

        await expect(generateStory({
            persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
            durationSec: 60,
            convoHistory: [],
        })).rejects.toThrow('Missing GCP project id');
    });

    it('uses FIREBASE_CONFIG.projectId when present', async () => {
        process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'from-firebase' });
        process.env.VERTEX_AI_LOCATION = 'us-central1';
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [{ content: { parts: [{ text: 'Once...' }] } }],
            },
        });

        const { generateStory } = require('../src/vertex') as typeof import('../src/vertex');
        const result = await generateStory({
            persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
            durationSec: 60,
            convoHistory: [],
        });

        expect(result.text).toBe('Once...');
        expect(mockVertexAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
            project: 'from-firebase',
            location: 'us-central1',
        }));
    });

    it('defaults global location to aiplatform.googleapis.com', async () => {
        process.env.GCLOUD_PROJECT = 'proj';
        process.env.VERTEX_AI_LOCATION = 'global';
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [{ content: { parts: [{ text: 'Once...' }] } }],
            },
        });

        const { generateStory } = require('../src/vertex') as typeof import('../src/vertex');
        await generateStory({
            persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
            durationSec: 60,
            convoHistory: [],
        });

        expect(mockVertexAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
            project: 'proj',
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com',
        }));
    });

    it('caches Vertex clients per project/location/apiEndpoint', async () => {
        process.env.GCLOUD_PROJECT = 'proj';
        process.env.VERTEX_AI_LOCATION = 'us-central1';
        mockGenerateContent.mockResolvedValue({
            response: {
                candidates: [{ content: { parts: [{ text: 'Once...' }] } }],
            },
        });

        const { generateStory } = require('../src/vertex') as typeof import('../src/vertex');

        await generateStory({
            persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
            durationSec: 60,
            convoHistory: [],
        });

        await generateStory({
            persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
            durationSec: 60,
            convoHistory: [],
        });

        expect(mockVertexAIConstructor).toHaveBeenCalledTimes(1);
    });
});

