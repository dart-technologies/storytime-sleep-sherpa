import { Persona } from '../personas';

/**
 * Interface for AI Story Generation (The "Writer")
 */
export interface StoryWriter {
    generateStory: (prompt: string, persona: Persona) => Promise<{
        title: string;
        narrative: string;
    }>;
}

/**
 * Interface for AI Voice Narration (The "Narrator")
 */
export interface VoiceNarrator {
    startNarration: (persona: Persona) => Promise<void>;
    stopNarration: () => Promise<void>;
    status: 'idle' | 'connecting' | 'connected' | 'error';
}

/**
 * Interface for Vision Analysis (The "Observer")
 */
export interface VisionObserver {
    analyzeImage: (uri: string) => Promise<string>;
}
