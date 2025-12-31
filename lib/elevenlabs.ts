// NOTE: We intentionally `require()` the SDK to avoid Metro resolving different
// conditional export entrypoints (and therefore different React contexts)
// across the app. This keeps `ElevenLabsProvider` and `useConversation` wired
// to the same module instance.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const elevenlabs = require('@elevenlabs/react-native') as typeof import('@elevenlabs/react-native');

export const ElevenLabsProvider = elevenlabs.ElevenLabsProvider;
export const useConversation = elevenlabs.useConversation;

export type {
    Conversation,
    ConversationStatus,
    Mode,
    Role,
    Callbacks,
    ConversationOptions,
    ConversationConfig,
    ConversationEvent,
    AudioSessionConfig,
} from '@elevenlabs/react-native';

