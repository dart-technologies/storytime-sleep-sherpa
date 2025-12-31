import type { Conversation, ConversationStatus, Mode } from '../../lib/elevenlabs';
import type { Persona } from '../../lib/personas';

export type LatencyMaskType = 'welcome' | 'hook' | 'mask';

export type AgentAudioRecording = {
    uri: string;
    sampleRate: number | null;
    bytes: number;
    startedAtMs: number;
    endedAtMs: number;
    conversationId: string | null;
};

export type Listener = {
    onConnect?: () => void;
    onDisconnect?: (reason?: 'user' | 'agent' | 'error') => void;
    onError?: (error: unknown) => void;
    onMessage?: (message: any) => void;
    onModeChange?: (mode: Mode) => void;
    onStatusChange?: (status: ConversationStatus) => void;
    onIntakeComplete?: (payload: { title?: string; summary?: string; raw?: unknown }) => void;
};

export type Subscription = {
    ownerKey?: string;
    listener: Listener;
};

export type StartOptions = {
    ownerKey?: string;
};

export type StopOptions = {
    ownerKey?: string;
    force?: boolean;
};

export type ElevenLabsConversationContextValue = {
    conversation: Conversation;
    status: ConversationStatus;
    mode: Mode | null;
    activePersonaId: string | null;
    activeOwnerKey: string | null;
    playingMaskType: LatencyMaskType | null;
    isPlayingMask: boolean;
    isAgentAudioRecording: boolean;
    agentAudioRecording: AgentAudioRecording | null;
    clearAgentAudioRecording: () => void;
    tokenFetchUrl?: string;
    startConversation: (persona: Persona, options?: StartOptions) => Promise<void>;
    stopConversation: (options?: StopOptions) => Promise<void>;
    playLatencyMask: (persona: Persona, type: LatencyMaskType) => void;
    stopLatencyMask: () => void;
    subscribe: (listener: Listener, ownerKey?: string) => () => void;
};
