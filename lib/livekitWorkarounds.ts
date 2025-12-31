import { EngineEvent, LogLevel, Room, setLogLevel } from 'livekit-client';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isEngineDisconnecting(engine: any): boolean {
    if (!engine) return false;
    if (engine.isClosed) return true;
    const client = engine.client;
    if (!client) return false;

    // `SignalConnectionState`: 3 = DISCONNECTING, 4 = DISCONNECTED.
    const state = typeof client.currentState === 'number' ? client.currentState : undefined;
    return Boolean(client.isDisconnected) || state === 3 || state === 4;
}

function patchPcManager(engine: any, pcManager: any) {
    if (!pcManager) return;
    if (pcManager.__storytimePatched) return;
    pcManager.__storytimePatched = true;

    const originalAddIceCandidate =
        typeof pcManager.addIceCandidate === 'function' ? pcManager.addIceCandidate.bind(pcManager) : null;
    if (originalAddIceCandidate) {
        pcManager.addIceCandidate = async (...args: any[]) => {
            try {
                return await originalAddIceCandidate(...args);
            } catch (error) {
                if (isEngineDisconnecting(engine)) return;
                throw error;
            }
        };
    }

    const originalCreateSubscriberAnswerFromOffer =
        typeof pcManager.createSubscriberAnswerFromOffer === 'function'
            ? pcManager.createSubscriberAnswerFromOffer.bind(pcManager)
            : null;
    if (originalCreateSubscriberAnswerFromOffer) {
        pcManager.createSubscriberAnswerFromOffer = async (...args: any[]) => {
            try {
                return await originalCreateSubscriberAnswerFromOffer(...args);
            } catch (error) {
                if (isEngineDisconnecting(engine)) return undefined;
                throw error;
            }
        };
    }

    const originalCreateAndSendPublisherOffer =
        typeof pcManager.createAndSendPublisherOffer === 'function'
            ? pcManager.createAndSendPublisherOffer.bind(pcManager)
            : null;
    if (originalCreateAndSendPublisherOffer) {
        pcManager.createAndSendPublisherOffer = async (...args: any[]) => {
            try {
                return await originalCreateAndSendPublisherOffer(...args);
            } catch (error) {
                if (isEngineDisconnecting(engine)) return undefined;
                throw error;
            }
        };
    }
}

function patchEngine(engine: any) {
    if (!engine) return;
    if (engine.__storytimePatched) return;
    engine.__storytimePatched = true;

    const maybePatch = () => {
        patchPcManager(engine, engine.pcManager);
    };

    if (typeof engine.on === 'function') {
        engine.on(EngineEvent.TransportsCreated, maybePatch);
    }

    // If transports are created before we attach the listener.
    maybePatch();
}

export function installLiveKitWorkarounds() {
    const globalAny = globalThis as any;
    if (globalAny.__storytimeLiveKitWorkaroundsInstalled) return;
    globalAny.__storytimeLiveKitWorkaroundsInstalled = true;

    // Keep production logs quiet; keep warnings in dev.
    setLogLevel(__DEV__ ? LogLevel.warn : LogLevel.error);

    const roomProto = (Room as any)?.prototype;
    if (!roomProto || typeof roomProto.maybeCreateEngine !== 'function') return;
    if (roomProto.__storytimePatchedMaybeCreateEngine) return;
    roomProto.__storytimePatchedMaybeCreateEngine = true;

    const originalMaybeCreateEngine = roomProto.maybeCreateEngine;

    roomProto.maybeCreateEngine = function (...args: any[]) {
        const result = originalMaybeCreateEngine.apply(this, args);
        try {
            patchEngine((this as any).engine);
        } catch (error) {
            if (__DEV__) {
                console.warn('[LiveKit] Failed to install workarounds:', getErrorMessage(error));
            }
        }
        return result;
    };
}
