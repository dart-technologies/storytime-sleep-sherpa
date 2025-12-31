jest.mock('@elevenlabs/react-native', () => ({
    ElevenLabsProvider: () => null,
    useConversation: () => ({ status: 'disconnected' }),
}));

describe('lib/elevenlabs', () => {
    it('re-exports the ElevenLabs SDK entrypoints', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const elevenlabs = require('../elevenlabs') as typeof import('../elevenlabs');
        expect(typeof elevenlabs.ElevenLabsProvider).toBe('function');
        expect(typeof elevenlabs.useConversation).toBe('function');
    });
});

