export async function fetchElevenLabsConversationToken(params: {
    agentId: string;
    apiKey: string;
    source?: string;
    version?: string;
}): Promise<string> {
    const { agentId, apiKey, source, version } = params;

    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
    url.searchParams.set('agent_id', agentId);
    if (source) url.searchParams.set('source', source);
    if (version) url.searchParams.set('version', version);

    const response = await fetch(url.toString(), {
        headers: {
            'xi-api-key': apiKey,
        },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.detail?.message || data?.message || 'Failed to get conversation token';
        throw new Error(message);
    }

    const token = data?.token;
    if (typeof token !== 'string' || !token) {
        throw new Error('No conversation token received from ElevenLabs');
    }
    return token;
}

type ElevenLabsVoiceSettings = {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
};

function getElevenLabsErrorMessage(data: any, fallback: string): string {
    const detail = data?.detail?.message || data?.detail || data?.message || data?.error;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    return fallback;
}

export async function synthesizeElevenLabsSpeech(params: {
    voiceId: string;
    text: string;
    apiKey: string;
    modelId?: string;
    outputFormat?: string;
    voiceSettings?: ElevenLabsVoiceSettings;
}): Promise<Buffer> {
    const { voiceId, text, apiKey, modelId, outputFormat, voiceSettings } = params;

    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`);
    url.searchParams.set('optimize_streaming_latency', '0');
    url.searchParams.set('output_format', outputFormat || 'mp3_44100_128');

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
            text,
            model_id: modelId || 'eleven_multilingual_v2',
            voice_settings: voiceSettings || undefined,
        }),
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const trimmed = bodyText.trim();
        let parsed: any = undefined;
        if (trimmed) {
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                // ignore non-JSON
            }
        }
        const message = parsed ? getElevenLabsErrorMessage(parsed, `Failed to synthesize speech (HTTP ${response.status})`) : (trimmed || `Failed to synthesize speech (HTTP ${response.status})`);
        throw new Error(message);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
}
