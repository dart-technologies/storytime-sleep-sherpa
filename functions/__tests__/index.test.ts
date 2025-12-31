import * as admin from 'firebase-admin';
import { generateStory } from '../src/vertex';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            add: jest.fn().mockResolvedValue({ id: 'mock-story-id' }),
        })),
    })),
}));

// Note: We are testing generateStory itself, so we don't mock it.
// Instead, we should mock the Gemini model it uses.
jest.mock('@google-cloud/vertexai', () => ({
    VertexAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockImplementation(() => ({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: 'A mock story from Gemini 3 Pro.',
                            }],
                        },
                    }],
                },
            }),
        })),
    })),
}));

describe('Cloud Functions Integration', () => {
    beforeEach(() => {
        process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
        process.env.VERTEX_AI_LOCATION = 'us-central1';
    });

    it('should generate a story based on persona and context', async () => {
        // This is a unit-integration test for the function logic
        // We'd ideally use firebase-functions-test for a full setup

        // Manual invocation of the core logic
        const result = await generateStory({
            persona: { id: 'luna', name: 'Luna' } as any,
            durationSec: 300,
            convoHistory: [],
        });

        expect(result?.text).toBeDefined();
        expect(result.text).toContain('mock story');
        expect(result.meta.modelId).toBeTruthy();
    });
});
