/**
 * Engine for enhancing generated story text with SSML-like markers or persona-specific pacing instructions.
 */

export type PacingStyle = 'sleepy' | 'dreamy' | 'natural';

export interface SSMLOptions {
    pacing?: PacingStyle;
    injectBreaths?: boolean;
    whisperMode?: boolean;
}

export function enhanceNarrationText(text: string, options: SSMLOptions = {}): string {
    const { pacing = 'sleepy', injectBreaths = true, whisperMode = false } = options;

    let enhanced = text;

    // 1. Inject soft pauses at punctuation
    enhanced = enhanced.replace(/([.?!])(\s+|$)/g, '$1 [PAUSE] ');

    // 2. Inject persona breaths (using placeholder [BREATH] for the agent/TTS to interpret or for us to swap with SSML tags)
    if (injectBreaths) {
        // Soft breath every ~2 sentences
        const sentences = enhanced.split(/([.?!])/);
        enhanced = sentences.map((part, i) => {
            if (i % 4 === 2 && part.length > 1) {
                return part + ' [BREATH]';
            }
            return part;
        }).join('');
    }

    // 3. Apply style-specific pacing
    if (pacing === 'sleepy') {
        // sleepiness often involves longer trailing pauses
        enhanced = enhanced.replace(/\[PAUSE\]/g, '[LONG_PAUSE]');
    }

    if (whisperMode) {
        enhanced = `[WHISPER] ${enhanced} [/WHISPER]`;
    }

    return enhanced.trim();
}

/**
 * Converts internal placeholders to ElevenLabs compatible format or clean text if using standard hooks.
 */
export function finalizeForProvider(text: string, provider: 'elevenlabs' | 'gemini'): string {
    if (provider === 'elevenlabs') {
        // ElevenLabs reacts well to punctuation for pacing
        return text
            .replace(/\[PAUSE\]/g, '... ')
            .replace(/\[LONG_PAUSE\]/g, '... ... ')
            .replace(/\[BREATH\]/g, ' (soft breath) ')
            .replace(/\[WHISPER\]|\[\/WHISPER\]/g, '');
    }

    // Default clean text for standard LLMs
    return text.replace(/\[.*?\]/g, '').trim();
}
