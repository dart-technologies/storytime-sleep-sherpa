
import { GenerateContentRequest } from '@google-cloud/vertexai';
import { generateStory, generateStoryStructured, analyzeImage, generateCoverImage, VertexCallMeta } from '../src/vertex';

// Mock @google-cloud/vertexai
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
}));
const mockVertexAI = jest.fn((_config: any) => ({
    getGenerativeModel: mockGetGenerativeModel,
}));

jest.mock('@google-cloud/vertexai', () => ({
    VertexAI: class {
        constructor(config: any) {
            return mockVertexAI(config);
        }
    },
    SchemaType: {
        OBJECT: 'OBJECT',
        STRING: 'STRING',
        INTEGER: 'INTEGER',
    },
}));


describe('Vertex AI Utilities', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...OLD_ENV };
        // Default env vars
        process.env.GCLOUD_PROJECT = 'test-project';
        process.env.VERTEX_AI_LOCATION = 'us-central1';
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    describe('generateStory', () => {
        it('generates a story successfully', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{
                        content: { parts: [{ text: 'Once upon a time...' }] }
                    }]
                }
            });

            const result = await generateStory({
                persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
                durationSec: 300,
                convoHistory: [],
                requestId: 'req-1',
            });

            expect(result.text).toBe('Once upon a time...');
            expect(result.meta.attempts[0].result).toBe('success');

            // Verify VertexAI initialization
            expect(mockVertexAI).toHaveBeenCalledWith(expect.objectContaining({
                project: 'test-project',
                location: 'us-central1',
            }));
        });

        it('retries with fallback model on error', async () => {
            // First attempt fails
            mockGenerateContent.mockRejectedValueOnce(new Error('got status: 404'));
            // Second attempt succeeds
            mockGenerateContent.mockResolvedValueOnce({
                response: {
                    candidates: [{
                        content: { parts: [{ text: 'Fallback story...' }] }
                    }]
                }
            });

            // Force diverse models
            process.env.VERTEX_AI_TEXT_MODEL = 'gemini-2.5-pro';

            const result = await generateStory({
                persona: { name: 'Luna', voiceProfile: 'Soft', specialty: 'Dreams' },
                durationSec: 100,
                convoHistory: [],
            });

            expect(result.text).toBe('Fallback story...');
            // Expect at least 2 attempts (primary, global fallback, or model fallback)
            expect(result.meta.attempts.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('generateStoryStructured', () => {
        it('returns structured JSON', async () => {
            const mockJson = JSON.stringify({
                title: 'Moon',
                summary: 'A moon story',
                narrative: 'The moon rose high.'
            });

            mockGenerateContent.mockResolvedValue({
                response: Promise.resolve({
                    candidates: [{
                        content: { parts: [{ text: mockJson }] }
                    }]
                })
            });

            const { result } = await generateStoryStructured({
                persona: { name: 'Kai', voiceProfile: 'Deep', specialty: 'Ocean' },
                durationSec: 600,
                convoHistory: [],
            });

            expect(result.title).toBe('Moon');
            expect(result.narrative).toBe('The moon rose high.');
        });

        it('throws if JSON is invalid', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{ content: { parts: [{ text: 'INVALID JSON' }] } }]
                }
            });

            await expect(generateStoryStructured({
                persona: { name: 'Kai' },
                durationSec: 60,
                convoHistory: []
            } as any)).rejects.toThrow();
        });
    });

    describe('analyzeImage', () => {
        it('analyzes image successfully', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{
                        content: { parts: [{ text: 'A calm blue ocean.' }] }
                    }]
                }
            });

            const { text } = await analyzeImage('base64data');
            expect(text).toBe('A calm blue ocean.');

            // Verify request structure matches what Vertex expects for images
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.contents[0].parts[1].inlineData.data).toBe('base64data');
        });

        it('uses a model override when provided', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{
                        content: { parts: [{ text: 'A calm blue ocean.' }] }
                    }]
                }
            });

            const { meta } = await analyzeImage('base64data', { modelIdOverride: 'gemini-3-flash-preview' });
            expect(meta.modelId).toBe('gemini-3-flash-preview');
            expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3-flash-preview' }));
        });

        it('falls back to VERTEX_AI_TEXT_MODEL when VERTEX_AI_VISION_MODEL is unset', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{
                        content: { parts: [{ text: 'A calm blue ocean.' }] }
                    }]
                }
            });

            delete process.env.VERTEX_AI_VISION_MODEL;
            process.env.VERTEX_AI_TEXT_MODEL = 'gemini-3-pro-preview';

            const { meta } = await analyzeImage('base64data');
            expect(meta.configuredModelId).toBe('gemini-3-pro-preview');
            expect(meta.modelId).toBe('gemini-3-pro-preview');
        });
    });

    describe('generateCoverImage', () => {
        it('returns base64 image data', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: { mimeType: 'image/png', data: 'cover-base64' }
                            }]
                        }
                    }]
                }
            });

            const { result } = await generateCoverImage({ prompt: 'A snowy mountain' });
            expect(result.mimeType).toBe('image/png');
            expect(result.base64).toBe('cover-base64');
        });
    });
});
