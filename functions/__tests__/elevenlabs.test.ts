import { fetchElevenLabsConversationToken, synthesizeElevenLabsSpeech } from '../src/elevenlabs';

jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test_uid', email: 'test@example.com' }),
    })),
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

jest.mock('../src/vertex', () => ({
    generateStory: jest.fn(),
    analyzeImage: jest.fn(),
}));

describe('ElevenLabs Cloud Functions helpers', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('fetchElevenLabsConversationToken returns token and sends xi-api-key header', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ token: 'token_123' }),
        });
        global.fetch = fetchMock;

        const token = await fetchElevenLabsConversationToken({
            agentId: 'agent_abc',
            apiKey: 'secret',
            source: 'react_native_sdk',
            version: '0.0.0-test',
        });

        expect(token).toBe('token_123');
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('agent_id=agent_abc'),
            expect.objectContaining({
                headers: { 'xi-api-key': 'secret' },
            })
        );
    });

    it('fetchElevenLabsConversationToken surfaces API error messages', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({ detail: { message: 'No access' } }),
        });
        global.fetch = fetchMock;

        await expect(
            fetchElevenLabsConversationToken({ agentId: 'agent_abc', apiKey: 'secret' })
        ).rejects.toThrow('No access');
    });

    it('elevenlabsToken returns { token } for SDK tokenFetchUrl', async () => {
        process.env.ELEVENLABS_API_KEY = 'secret';

        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ token: 'token_456' }),
        });
        global.fetch = fetchMock;

        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { elevenlabsToken } = require('../src/index');

        const req = {
            method: 'GET',
            headers: { origin: 'http://localhost', authorization: 'Bearer test-firebase-token' },
            query: { agent_id: 'agent_abc', source: 'react_native_sdk', version: '0.0.0-test' },
            body: {},
        } as any;

        const res: any = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            on: jest.fn((_event: string, _cb: () => void) => { }),
            setHeader: jest.fn((key: string, value: string) => {
                res.headers[key.toLowerCase()] = value;
            }),
            getHeader: jest.fn((key: string) => res.headers[key.toLowerCase()]),
            removeHeader: jest.fn((key: string) => {
                delete res.headers[key.toLowerCase()];
            }),
            status: jest.fn((code: number) => {
                res.statusCode = code;
                return res;
            }),
            json: jest.fn((_body: unknown) => res),
        };

        // firebase-functions v2 returns a callable handler
        await (elevenlabsToken as any)(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'token_456', requestId: expect.any(String) }));

        delete process.env.ELEVENLABS_API_KEY;
    });
    it('synthesizeElevenLabsSpeech sends correct POST request and returns buffer', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
            headers: { get: () => 'audio/mpeg' },
        });
        global.fetch = fetchMock;

        const result = await synthesizeElevenLabsSpeech({
            voiceId: 'v1',
            text: 'Hello',
            apiKey: 'key',
        });

        expect(Buffer.isBuffer(result)).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/text-to-speech/v1/stream'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'xi-api-key': 'key' }),
                body: JSON.stringify({
                    text: 'Hello',
                    model_id: 'eleven_multilingual_v2',
                }),
            })
        );
    });

    it('synthesizeElevenLabsSpeech throws formatted error on failure', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: jest.fn().mockResolvedValue(JSON.stringify({ detail: { message: 'Unauthorized' } })),
        });
        global.fetch = fetchMock;

        await expect(synthesizeElevenLabsSpeech({
            voiceId: 'v1', text: 'Hi', apiKey: 'k'
        })).rejects.toThrow('Unauthorized');
    });
});

