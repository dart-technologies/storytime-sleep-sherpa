const mockVerifyIdToken = jest.fn(async (..._args: any[]) => ({ uid: 'test_uid', email: 'test@example.com' }));

const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDoc = jest.fn((id: string) => ({
    get: () => mockDocGet(id),
    update: (data: any) => mockDocUpdate(id, data),
}));
const mockCollection = jest.fn((_name: string) => ({
    doc: (id: string) => mockDoc(id),
}));

const mockFirestore = jest.fn(() => ({
    collection: (name: string) => mockCollection(name),
}));

const mockIncrement = jest.fn((n: number) => ({ __op: 'increment', n }));

const mockFileSave = jest.fn(async (..._args: any[]) => undefined);
const mockBucketFile = jest.fn((path: string) => ({
    save: (data: any, options: any) => mockFileSave(path, data, options),
}));
const mockBucket = { name: 'test-bucket', file: (path: string) => mockBucketFile(path) };
const mockStorage = jest.fn(() => ({
    bucket: () => mockBucket,
}));

jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    auth: () => ({ verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args) }),
    firestore: Object.assign(
        () => mockFirestore(),
        { FieldValue: { increment: (n: number) => mockIncrement(n) } },
    ),
    storage: () => mockStorage(),
}));

jest.mock('firebase-functions/params', () => {
    const actual = jest.requireActual('firebase-functions/params');
    return {
        ...actual,
        defineSecret: jest.fn((name: string) => ({
            value: () => process.env[name],
        })),
    };
});

const mockGenerateStoryStructured = jest.fn();
const mockAnalyzeImage = jest.fn();
const mockGenerateCoverImage = jest.fn();
jest.mock('../src/vertex', () => ({
    generateStoryStructured: (...args: any[]) => mockGenerateStoryStructured(...args),
    analyzeImage: (...args: any[]) => mockAnalyzeImage(...args),
    generateCoverImage: (...args: any[]) => mockGenerateCoverImage(...args),
}));

const mockFetchElevenLabsConversationToken = jest.fn();
const mockSynthesizeElevenLabsSpeech = jest.fn();
jest.mock('../src/elevenlabs', () => ({
    fetchElevenLabsConversationToken: (...args: any[]) => mockFetchElevenLabsConversationToken(...args),
    synthesizeElevenLabsSpeech: (...args: any[]) => mockSynthesizeElevenLabsSpeech(...args),
}));

function createReq(options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    query?: any;
    path?: string;
    originalUrl?: string;
}) {
    const headers = options.headers || {};
    const normalizedHeaders: Record<string, string> = {};
    Object.keys(headers).forEach((key) => {
        normalizedHeaders[key.toLowerCase()] = headers[key];
    });
    return {
        method: options.method || 'POST',
        headers: normalizedHeaders,
        body: options.body || {},
        query: options.query || {},
        path: options.path || '',
        originalUrl: options.originalUrl || '',
        url: options.originalUrl || '',
        get: (name: string) => normalizedHeaders[name.toLowerCase()],
    };
}

function createRes() {
    const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as any,
        on: jest.fn((_event: string, _cb: () => void) => { }),
        setHeader: jest.fn((key: string, value: string) => {
            res.headers[key.toLowerCase()] = String(value);
        }),
        getHeader: jest.fn((key: string) => res.headers[key.toLowerCase()]),
        removeHeader: jest.fn((key: string) => {
            delete res.headers[key.toLowerCase()];
        }),
        set: jest.fn((key: string, value: string) => {
            res.setHeader(key, value);
            return res;
        }),
        status: jest.fn((code: number) => {
            res.statusCode = code;
            return res;
        }),
        json: jest.fn((body: any) => {
            res.body = body;
            return res;
        }),
        send: jest.fn((body: any) => {
            res.body = body;
            return res;
        }),
    };
    return res;
}

describe('functions/src/index handlers', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...oldEnv, ELEVENLABS_API_KEY: 'secret' };
    });

    afterAll(() => {
        process.env = oldEnv;
    });

    it('generate returns structured story output', async () => {
        mockGenerateStoryStructured.mockResolvedValueOnce({
            result: { title: 'T', summary: 'S', narrative: 'N' },
            meta: { modelId: 'm' },
        });

        const { generate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: { id: 'luna', name: 'Luna' }, durationSec: 300, convoHistory: [] },
        });
        const res = createRes();

        await generate(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'T', summary: 'S', narrative: 'N' }));
    });

    it('vision analyzes an image and stores it in Firebase Storage', async () => {
        const pngBase64 =
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axK8wAAAABJRU5ErkJggg==';
        mockAnalyzeImage.mockResolvedValueOnce({ text: 'calm ocean', meta: { modelId: 'vision' } });

        const { vision } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { imageBase64: `data:image/png;base64,${pngBase64}`, source: 'upload' },
        });
        const res = createRes();

        await vision(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(mockFileSave).toHaveBeenCalled();
        expect(res.body).toEqual(expect.objectContaining({ analysis: 'calm ocean', imageUrl: expect.stringContaining('firebasestorage.googleapis.com') }));
    });

    it('illustrate generates an image url', async () => {
        mockGenerateCoverImage.mockResolvedValueOnce({
            result: { base64: Buffer.from('x').toString('base64'), mimeType: 'image/png' },
            meta: { modelId: 'img' },
        });

        const { illustrate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { title: 'Title', summary: 'Summary', personaId: 'luna', personaName: 'Luna' },
        });
        const res = createRes();

        await illustrate(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.body).toEqual(expect.objectContaining({ imageUrl: expect.any(String) }));
    });

    it('narrate synthesizes speech and stores audio', async () => {
        mockSynthesizeElevenLabsSpeech.mockResolvedValueOnce(Buffer.from('audio'));

        const { narrate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { text: 'Hello [pause]\n\nWorld', voiceId: 'voice-1', personaId: 'luna' },
        });
        const res = createRes();

        await narrate(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(mockSynthesizeElevenLabsSpeech).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'voice-1' }));
        expect(res.body).toEqual(expect.objectContaining({ audioUrl: expect.any(String) }));
    });

    it('sharedStory returns 404 for missing docs', async () => {
        mockDocGet.mockResolvedValueOnce({ exists: false });

        const { sharedStory } = require('../src/index') as any;
        const req = createReq({ query: { storyId: 'missing' }, method: 'GET' });
        const res = createRes();

        await sharedStory(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Story not found.' }));
    });

    it('share renders an HTML response for a story', async () => {
        mockDocGet.mockResolvedValueOnce({
            exists: true,
            id: 'story-1',
            data: () => ({
                title: 'A <Title>',
                summary: 'Summary',
                personaName: 'Luna',
                createdAt: 0,
                audioUrl: 'https://example.com/audio.mp3',
            }),
        });

        const { share } = require('../src/index') as any;
        const req = createReq({
            method: 'GET',
            headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
            path: '/s/story-1',
        });
        const res = createRes();

        await share(req, res);

        expect(res.statusCode).toBe(200);
        expect(String(res.body)).toContain('og:title');
        expect(String(res.body)).toContain('A &lt;Title&gt;');
        expect(String(res.body)).toContain('fetch("/storyPlay"');
    });

    it('intake returns a simulated response', async () => {
        const { intake } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: { id: 'luna', name: 'Luna' }, message: 'hi', sessionId: 's1' },
        });
        const res = createRes();

        await intake(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.body).toEqual(expect.objectContaining({ replyText: expect.stringContaining('Simulated') }));
    });

    it('generate validates durationSec', async () => {
        const { generate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: { id: 'luna', name: 'Luna' }, durationSec: 123, convoHistory: [] },
        });
        const res = createRes();

        await generate(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body).toEqual(expect.objectContaining({ error: 'Validation Error' }));
    });

    it('vision rejects unsupported image types', async () => {
        const heicBytes = Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
        const heicBase64 = heicBytes.toString('base64');

        const { vision } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { imageBase64: heicBase64, source: 'upload' },
        });
        const res = createRes();

        await vision(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body?.detail?.message).toContain('Unsupported image format');
    });

    it('narrate returns 500 when ELEVENLABS_API_KEY is missing', async () => {
        process.env.ELEVENLABS_API_KEY = '';
        const { narrate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { text: 'Hello', voiceId: 'voice-1', personaId: 'luna' },
        });
        const res = createRes();

        await narrate(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body?.detail?.message).toContain('Server configuration error');
    });

    it('elevenlabsToken validates agent_id and api key', async () => {
        const { elevenlabsToken } = require('../src/index') as any;

        const reqMissing = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: {},
        });
        const resMissing = createRes();
        await elevenlabsToken(reqMissing, resMissing);
        expect(resMissing.status).toHaveBeenCalledWith(400);

        process.env.ELEVENLABS_API_KEY = '';
        const reqNoKey = createReq({
            headers: { authorization: 'Bearer test-token' },
            query: { agent_id: 'agent_1' },
        });
        const resNoKey = createRes();
        await elevenlabsToken(reqNoKey, resNoKey);
        expect(resNoKey.status).toHaveBeenCalledWith(500);
        expect(resNoKey.body?.detail?.message).toContain('Server configuration error');
    });

    it('sharedStory returns story data when present', async () => {
        mockDocGet.mockResolvedValueOnce({
            exists: true,
            id: 'story-1',
            data: () => ({
                title: 'T',
                summary: 'S',
                personaName: 'Luna',
                userName: 'U',
                audioUrl: 'https://example.com/a.mp3',
                coverImageUrl: 'https://example.com/c.png',
                createdAt: 1,
                duration: 300,
            }),
        });

        const { sharedStory } = require('../src/index') as any;
        const req = createReq({ query: { storyId: 'story-1' }, method: 'GET' });
        const res = createRes();

        await sharedStory(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.body?.story).toEqual(expect.objectContaining({
            id: 'story-1',
            title: 'T',
            summary: 'S',
            personaName: 'Luna',
        }));
    });

    it('share returns 400/404 for missing story ids', async () => {
        const { share } = require('../src/index') as any;
        const reqMissing = createReq({ method: 'GET', path: '/s/', headers: { host: 'example.com' } });
        const resMissing = createRes();
        await share(reqMissing, resMissing);
        expect(resMissing.statusCode).toBe(400);

        mockDocGet.mockResolvedValueOnce({ exists: false });
        const reqNotFound = createReq({ method: 'GET', path: '/s/story-x', headers: { host: 'example.com' } });
        const resNotFound = createRes();
        await share(reqNotFound, resNotFound);
        expect(resNotFound.statusCode).toBe(404);
    });

    it('intake validates persona and message', async () => {
        const { intake } = require('../src/index') as any;

        const reqBadPersona = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: {}, message: 'hi' },
        });
        const resBadPersona = createRes();
        await intake(reqBadPersona, resBadPersona);
        expect(resBadPersona.status).toHaveBeenCalledWith(400);

        const reqBadMessage = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: { id: 'luna', name: 'Luna' }, message: '' },
        });
        const resBadMessage = createRes();
        await intake(reqBadMessage, resBadMessage);
        expect(resBadMessage.status).toHaveBeenCalledWith(400);
    });

    it('generate validates persona and vertexTextModel length', async () => {
        const { generate } = require('../src/index') as any;

        const reqBadPersona = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: {}, durationSec: 300, convoHistory: [] },
        });
        const resBadPersona = createRes();
        await generate(reqBadPersona, resBadPersona);
        expect(resBadPersona.status).toHaveBeenCalledWith(400);

        const reqBadModel = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { persona: { id: 'luna', name: 'Luna' }, durationSec: 300, convoHistory: [], vertexTextModel: 'x'.repeat(201) },
        });
        const resBadModel = createRes();
        await generate(reqBadModel, resBadModel);
        expect(resBadModel.status).toHaveBeenCalledWith(400);
    });

    it('vision validates base64 encoding', async () => {
        const { vision } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { imageBase64: 'not-base64!!!', source: 'upload' },
        });
        const res = createRes();

        await vision(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body?.error).toBe('Validation Error');
    });

    it('illustrate validates title and summary', async () => {
        const { illustrate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { title: 'x'.repeat(81), summary: 'Summary', personaId: 'luna', personaName: 'Luna' },
        });
        const res = createRes();

        await illustrate(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body?.error).toBe('Validation Error');
    });

    it('narrate validates voiceId and text', async () => {
        const { narrate } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            body: { text: '', voiceId: '', personaId: 'luna' },
        });
        const res = createRes();

        await narrate(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body?.error).toBe('Validation Error');
    });

    it('elevenlabsToken returns a token on success', async () => {
        mockFetchElevenLabsConversationToken.mockResolvedValueOnce('token-123');
        const { elevenlabsToken } = require('../src/index') as any;
        const req = createReq({
            headers: { authorization: 'Bearer test-token' },
            query: { agent_id: 'agent_1', source: 'test', version: 'v1' },
        });
        const res = createRes();

        await elevenlabsToken(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.body).toEqual(expect.objectContaining({ token: 'token-123', requestId: expect.any(String) }));
    });

    it('sharedStory validates storyId', async () => {
        const { sharedStory } = require('../src/index') as any;
        const req = createReq({ query: {}, method: 'GET' });
        const res = createRes();

        await sharedStory(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('storyPlay increments playCount for a story', async () => {
        mockDocUpdate.mockResolvedValueOnce(undefined);

        const { storyPlay } = require('../src/index') as any;
        const req = createReq({
            method: 'POST',
            body: { storyId: 'story-1', source: 'web' },
        });
        const res = createRes();

        await storyPlay(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(mockIncrement).toHaveBeenCalledWith(1);
        expect(mockDocUpdate).toHaveBeenCalledWith('story-1', expect.objectContaining({ playCount: expect.any(Object) }));
        expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
        expect(res.body).toEqual(expect.objectContaining({ ok: true }));
    });

    it('storyPlay validates storyId', async () => {
        const { storyPlay } = require('../src/index') as any;
        const req = createReq({ method: 'POST', body: {} });
        const res = createRes();

        await storyPlay(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it('storyCounters helpers patch missing counters', async () => {
        const mockSnapshotUpdate = jest.fn(async () => undefined);
        const { buildStoryCounterPatch, patchStoryCounters } = require('../src/storyCounters') as any;

        const patch = buildStoryCounterPatch({ remixOfStoryId: 'base-story' });
        expect(patch).toEqual(expect.objectContaining({ playCount: 0, remixCount: 0, favoritedCount: 0 }));

        await patchStoryCounters({ update: mockSnapshotUpdate }, { remixOfStoryId: 'base-story' });
        expect(mockSnapshotUpdate).toHaveBeenCalledWith(patch);
    });

    it('storyPlay returns 500 when updates fail', async () => {
        mockDocUpdate.mockRejectedValueOnce(new Error('write failed'));

        const { storyPlay } = require('../src/index') as any;
        const req = createReq({
            method: 'POST',
            body: { storyId: 'story-1' },
        });
        const res = createRes();

        await storyPlay(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('storyCounters helpers no-op when counters already exist', async () => {
        const mockSnapshotUpdate = jest.fn(async () => undefined);
        const { patchStoryCounters } = require('../src/storyCounters') as any;

        await patchStoryCounters(
            { update: mockSnapshotUpdate },
            { playCount: 1, remixCount: 2, favoritedCount: 3 },
        );

        expect(mockSnapshotUpdate).not.toHaveBeenCalled();
    });

    it('storyCounters helpers increment counters on stories', async () => {
        mockDocUpdate.mockResolvedValue(undefined);
        const { incrementStoryCounter } = require('../src/storyCounters') as any;

        await incrementStoryCounter('story-1', 'favoritedCount', 1);
        await incrementStoryCounter('story-1', 'favoritedCount', -1);
        await incrementStoryCounter('story-1', 'remixCount', 1);

        expect(mockIncrement).toHaveBeenCalledWith(1);
        expect(mockIncrement).toHaveBeenCalledWith(-1);
        expect(mockDocUpdate).toHaveBeenCalledWith('story-1', expect.any(Object));
    });
});
