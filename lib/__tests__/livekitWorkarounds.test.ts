const mockSetLogLevel = jest.fn();

jest.mock('livekit-client', () => {
    class Room {
        engine: any = null;

        maybeCreateEngine() {
            const pcManager = {
                addIceCandidate: jest.fn(async () => {
                    throw new Error('ICE failed');
                }),
                createSubscriberAnswerFromOffer: jest.fn(async () => {
                    throw new Error('Answer failed');
                }),
                createAndSendPublisherOffer: jest.fn(async () => {
                    throw new Error('Offer failed');
                }),
            };

            const engine = {
                client: { currentState: 1, isDisconnected: false },
                pcManager,
                on: jest.fn((_event: any, cb: () => void) => cb()),
            };

            this.engine = engine;
            return engine;
        }
    }

    return {
        EngineEvent: { TransportsCreated: 'TransportsCreated' },
        LogLevel: { warn: 'warn', error: 'error' },
        Room,
        setLogLevel: mockSetLogLevel,
    };
});

describe('lib/livekitWorkarounds', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        delete (globalThis as any).__storytimeLiveKitWorkaroundsInstalled;
    });

    it('installs workarounds and patches pcManager methods', async () => {
        const { installLiveKitWorkarounds } = require('../livekitWorkarounds') as typeof import('../livekitWorkarounds');
        const { Room } = require('livekit-client') as any;

        installLiveKitWorkarounds();
        expect(mockSetLogLevel).toHaveBeenCalled();

        const room = new Room();
        const engine = room.maybeCreateEngine();
        expect(engine).toBeTruthy();

        // Simulate disconnecting while calling patched methods: errors should be swallowed.
        engine.isClosed = true;
        await expect(engine.pcManager.addIceCandidate()).resolves.toBeUndefined();
        await expect(engine.pcManager.createSubscriberAnswerFromOffer()).resolves.toBeUndefined();
        await expect(engine.pcManager.createAndSendPublisherOffer()).resolves.toBeUndefined();
    });
});

