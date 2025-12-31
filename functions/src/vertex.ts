import { VertexAI, GenerateContentRequest, SchemaType } from '@google-cloud/vertexai';

const vertexClients = new Map<string, VertexAI>();
let resolvedProjectId: string | null = null;

function getWordCountForDuration(durationSec: number): number {
    const wordsPerMinute = 150;
    const computed = Math.round((durationSec / 60) * wordsPerMinute);
    return Math.max(40, computed);
}

function buildStoryStructureInstructions(durationSec: number, personaName: string): string {
    if (durationSec <= 30) {
        return `
Story Structure (very short):
- 2–4 calm sentences total.
- Include 1–2 [PAUSE] markers for a slow, sleepy cadence.
- No plot twists, no conflict, no urgency—just a single soothing image.
- End on a gentle, drowsy goodnight line.
        `.trim();
    }

    if (durationSec < 120) {
        return `
Story Structure (short):
1. Quick grounding: 1 breath cycle guided by ${personaName} (use [PAUSE]).
2. Mini dream scene: slow, cozy, sensory (no action or stakes).
3. Soft resolution: the scene fades and the listener drifts into rest.
        `.trim();
    }

    return `
Story Structure:
1. Grounding exercise: 30–45 seconds guided by ${personaName}; slow breath cues with [PAUSE].
2. The dream: a gentle, slow-paced story that favors atmosphere over plot; keep everything safe and cozy.
3. Drift: soften the language, shorten paragraphs, and fade into sleep with repeating soothing phrases.
    `.trim();
}

function trim(value: string | undefined): string {
    return (value || '').trim();
}

function normalizePromptField(value: unknown, maxLen: number): string {
    const raw = typeof value === 'string' ? value : '';
    const collapsed = raw.replace(/\s+/g, ' ').trim();
    if (!collapsed) return '';
    return collapsed.slice(0, maxLen);
}

function normalizeApiEndpoint(value: string | undefined): string | undefined {
    const trimmed = trim(value);
    if (!trimmed) return undefined;
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function normalizeModelId(modelId: string): string {
    let normalized = trim(modelId);
    if (!normalized) return '';
    if (normalized.startsWith('publishers/google/models/')) {
        normalized = normalized.slice('publishers/google/models/'.length);
    }
    if (normalized.startsWith('models/')) {
        normalized = normalized.slice('models/'.length);
    }
    if (normalized.startsWith('projects/')) return normalized;
    return normalized;
}

function resolveProjectId(): string {
    const candidates = [
        process.env.GCLOUD_PROJECT,
        process.env.GOOGLE_CLOUD_PROJECT,
        process.env.GOOGLE_CLOUD_PROJECT_ID,
        process.env.GCP_PROJECT,
    ].map(trim);

    const fromEnv = candidates.find(Boolean);
    if (fromEnv) return fromEnv;

    const firebaseConfig = trim(process.env.FIREBASE_CONFIG);
    if (firebaseConfig) {
        try {
            const parsed = JSON.parse(firebaseConfig);
            const projectId = trim(parsed?.projectId);
            if (projectId) return projectId;
        } catch {
            // ignore
        }
    }

    return '';
}

/**
 * Lazily initializes the VertexAI client.
 * Uses runtime project ID (GCLOUD_PROJECT/FIREBASE_CONFIG) or falls back to GOOGLE_CLOUD_PROJECT_ID.
 */
function getVertexAI(options?: { location?: string; apiEndpoint?: string }): VertexAI {
    if (!resolvedProjectId) {
        const project = resolveProjectId();
        if (!project) {
            throw new Error(
                'Missing GCP project id. Ensure this function is deployed to a Firebase project (FIREBASE_CONFIG), or set GOOGLE_CLOUD_PROJECT_ID.'
            );
        }
        resolvedProjectId = project;
    }

    const location = trim(options?.location) || trim(process.env.VERTEX_AI_LOCATION) || 'us-central1';

    const apiEndpoint =
        normalizeApiEndpoint(options?.apiEndpoint) ||
        normalizeApiEndpoint(process.env.VERTEX_AI_API_ENDPOINT) ||
        (location === 'global' ? 'aiplatform.googleapis.com' : undefined);

    const key = `${resolvedProjectId}::${location}::${apiEndpoint || ''}`;
    const cached = vertexClients.get(key);
    if (cached) return cached;

    const client = new VertexAI({ project: resolvedProjectId, location, apiEndpoint });
    vertexClients.set(key, client);
    return client;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isPublisherModelNotFound(error: unknown): boolean {
    const message = getErrorMessage(error);
    return (
        message.includes('got status: 404') ||
        message.includes('"code":404') ||
        (message.includes('NOT_FOUND') && message.includes('Publisher Model'))
    );
}

export type VertexAttemptMeta = {
    label: string;
    modelId: string;
    location?: string;
    apiEndpoint?: string;
    result: 'success' | 'not_found' | 'error';
    error?: string;
};

export type VertexCallMeta = {
    projectId: string;
    modelId: string;
    location: string;
    apiEndpoint?: string;
    configuredModelId: string;
    fallbackModelId: string;
    usedFallback: boolean;
    attempts: VertexAttemptMeta[];
};

function shouldTryGlobalLocationFallback(): boolean {
    const value = trim(process.env.VERTEX_AI_TRY_GLOBAL_LOCATION).toLowerCase();
    if (!value) return true;
    return !['0', 'false', 'no', 'off'].includes(value);
}

/**
 * Generates a sleep story using Gemini via Vertex AI.
 */
export async function generateStory(params: {
    persona: any;
    durationSec: number;
    convoHistory: any[];
    imageContext?: string;
    date?: string;
    requestId?: string;
    modelIdOverride?: string;
}): Promise<{ text: string; meta: VertexCallMeta }> {
    const requestedModel = normalizeModelId(trim(params.modelIdOverride));
    const configuredModel = requestedModel || normalizeModelId(trim(process.env.VERTEX_AI_TEXT_MODEL) || 'gemini-2.5-pro');
    const fallbackModel = normalizeModelId('gemini-2.5-pro');
    const primaryLocation = trim(process.env.VERTEX_AI_LOCATION) || 'us-central1';
    const tryGlobalLocation = shouldTryGlobalLocationFallback() && primaryLocation !== 'global';

    const wordCount = getWordCountForDuration(params.durationSec);

    const personaName = normalizePromptField(params.persona?.name, 100) || 'Narrator';
    const personaVoice = normalizePromptField(params.persona?.voiceProfile, 160);
    const personaSpecialty = normalizePromptField(params.persona?.specialty, 160);
    const season = normalizePromptField(params.date, 40) || 'winter';

    const conversationTranscript = Array.isArray(params.convoHistory)
        ? params.convoHistory
            .slice(-30)
            .map((item) => {
                const role = typeof item?.role === 'string' ? item.role.trim() : '';
                const content = typeof item?.content === 'string' ? item.content.trim() : '';
                if (!content) return null;
                return `${role ? role.toUpperCase() : 'USER'}: ${content}`;
            })
            .filter(Boolean)
            .join('\n')
        : '';

    const prompt = `
You are ${personaName}, a calming sleep story narrator.
Create a gentle, kid-friendly bedtime story that helps the listener feel safe, cozy, and sleepy.

Voice & pacing:
- ${personaVoice || 'Soft, calm, slow.'}
- Keep sentences short and soothing. Prefer second-person ("you") so it feels guided and personal.
- Favor atmosphere over plot. Nothing urgent happens.
- Avoid sharp transitions or surprise words (e.g., "suddenly", "but then", "however").

Sensory palette:
- Warm light, soft textures, slow movement, quiet micro-sounds (fabric, distant rain, soft footsteps).
- Gentle, dreamy metaphors; no high-energy action.

Context:
- Use details and preferences from the conversation transcript.
- Season: ${season}. Weave in subtle seasonal color and restful details.
${params.imageContext ? `- Image inspiration: ${params.imageContext}` : ''}
- Stay kid-friendly: no fear, no danger, no conflict, no grief, no suspense.
- If you include dialogue, keep it minimal and whispered.

Length:
- Aim for about ${wordCount} words (±15%). This is a ${params.durationSec / 60}-minute story at a slow narrating pace.

Persona specialty (optional): ${personaSpecialty || 'Calm bedtime journeys.'}

Conversation Transcript:
${conversationTranscript || 'No conversation transcript provided.'}

${buildStoryStructureInstructions(params.durationSec, personaName)}

Formatting:
- Insert the literal token [PAUSE] (all caps, no spaces) to mark a silent beat (~2–4 seconds).
- Never write the word "pause" in the narrative (no "(pause)", no "pause:", no "pauses/paused/pausing"); only the [PAUSE] token.
- Place [PAUSE] after calming lines and at the end of most short paragraphs.

Return ONLY the story text.
`;

    const run = async (options: { modelId: string; location?: string; apiEndpoint?: string }) => {
        const model = getVertexAI({ location: options.location, apiEndpoint: options.apiEndpoint }).getGenerativeModel({
            model: options.modelId,
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    const attempts: Array<{ modelId: string; location?: string; apiEndpoint?: string; label: string }> = [
        { modelId: configuredModel, location: primaryLocation, label: `model "${configuredModel}" in ${primaryLocation}` },
    ];

    if (tryGlobalLocation) {
        attempts.push({
            modelId: configuredModel,
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com',
            label: `model "${configuredModel}" in global`,
        });
    }

    if (configuredModel !== fallbackModel) {
        attempts.push({ modelId: fallbackModel, location: primaryLocation, label: `fallback "${fallbackModel}" in ${primaryLocation}` });
        if (tryGlobalLocation) {
            attempts.push({
                modelId: fallbackModel,
                location: 'global',
                apiEndpoint: 'aiplatform.googleapis.com',
                label: `fallback "${fallbackModel}" in global`,
            });
        }
    }

    const requestId = trim(params.requestId);
    const attemptMeta: VertexAttemptMeta[] = [];

    let lastError: unknown = undefined;
    for (const attempt of attempts) {
        try {
            if (attempt !== attempts[0]) {
                console.warn(`[VertexAI] Retrying with ${attempt.label}.`);
            }

            console.log('[VertexAI] generateStory attempt', {
                requestId: requestId || undefined,
                label: attempt.label,
            });

            const text = await run({ modelId: attempt.modelId, location: attempt.location, apiEndpoint: attempt.apiEndpoint });

            const projectId = resolvedProjectId || resolveProjectId() || '';
            const location = attempt.location || primaryLocation;
            const meta: VertexCallMeta = {
                projectId,
                modelId: attempt.modelId,
                location,
                apiEndpoint: attempt.apiEndpoint,
                configuredModelId: configuredModel,
                fallbackModelId: fallbackModel,
                usedFallback: attempt.modelId !== configuredModel,
                attempts: [
                    ...attemptMeta,
                    {
                        label: attempt.label,
                        modelId: attempt.modelId,
                        location: attempt.location,
                        apiEndpoint: attempt.apiEndpoint,
                        result: 'success',
                    },
                ],
            };

            console.log('[VertexAI] generateStory success', {
                requestId: requestId || undefined,
                modelId: meta.modelId,
                location: meta.location,
                usedFallback: meta.usedFallback,
            });

            return { text, meta };
        } catch (error) {
            lastError = error;
            const notFound = isPublisherModelNotFound(error);
            attemptMeta.push({
                label: attempt.label,
                modelId: attempt.modelId,
                location: attempt.location,
                apiEndpoint: attempt.apiEndpoint,
                result: notFound ? 'not_found' : 'error',
                error: getErrorMessage(error).slice(0, 400),
            });
            console.warn('[VertexAI] generateStory attempt failed', {
                requestId: requestId || undefined,
                label: attempt.label,
                notFound,
                error: getErrorMessage(error),
            });
            if (!notFound) throw error;
        }
    }

    throw lastError;
}

/**
 * Analyzes an image using Gemini via Vertex AI.
 */
export async function analyzeImage(
    imageBase64: string,
    options?: { requestId?: string; mimeType?: string; modelIdOverride?: string }
): Promise<{ text: string; meta: VertexCallMeta }> {
    const requestedModel = normalizeModelId(trim(options?.modelIdOverride));
    const envVisionModel = normalizeModelId(trim(process.env.VERTEX_AI_VISION_MODEL));
    const envTextModel = normalizeModelId(trim(process.env.VERTEX_AI_TEXT_MODEL));
    const configuredModel = requestedModel || envVisionModel || envTextModel || normalizeModelId('gemini-2.5-flash-image');
    const fallbackModel = normalizeModelId('gemini-2.5-flash-image');
    const primaryLocation = trim(process.env.VERTEX_AI_LOCATION) || 'us-central1';
    const tryGlobalLocation = shouldTryGlobalLocationFallback() && primaryLocation !== 'global';

    const promptText = `
Return concise inspiration for a calming sleep story from this image:
- 1 short sentence: overall mood.
- 5 short bullets: colors, lighting, textures, setting, soothing details.

Constraints:
- <= 1600 characters total.
- No headings, no extra commentary.
    `.trim();
    const mimeType = trim(options?.mimeType) || 'image/jpeg';

    const request: GenerateContentRequest = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 1024,
        },
    };

    const run = async (options: { modelId: string; location?: string; apiEndpoint?: string }) => {
        const model = getVertexAI({ location: options.location, apiEndpoint: options.apiEndpoint }).getGenerativeModel({
            model: options.modelId,
        });
        const result = await model.generateContent(request);
        const response = await result.response;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    const attempts: Array<{ modelId: string; location?: string; apiEndpoint?: string; label: string }> = [
        { modelId: configuredModel, location: primaryLocation, label: `model "${configuredModel}" in ${primaryLocation}` },
    ];

    if (tryGlobalLocation) {
        attempts.push({
            modelId: configuredModel,
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com',
            label: `model "${configuredModel}" in global`,
        });
    }

    if (configuredModel !== fallbackModel) {
        attempts.push({ modelId: fallbackModel, location: primaryLocation, label: `fallback "${fallbackModel}" in ${primaryLocation}` });
        if (tryGlobalLocation) {
            attempts.push({
                modelId: fallbackModel,
                location: 'global',
                apiEndpoint: 'aiplatform.googleapis.com',
                label: `fallback "${fallbackModel}" in global`,
            });
        }
    }

    const requestId = trim(options?.requestId);
    const attemptMeta: VertexAttemptMeta[] = [];

    let lastError: unknown = undefined;
    for (const attempt of attempts) {
        try {
            if (attempt !== attempts[0]) {
                console.warn(`[VertexAI] Retrying with ${attempt.label}.`);
            }

            console.log('[VertexAI] analyzeImage attempt', {
                requestId: requestId || undefined,
                label: attempt.label,
            });

            const text = await run({ modelId: attempt.modelId, location: attempt.location, apiEndpoint: attempt.apiEndpoint });

            const projectId = resolvedProjectId || resolveProjectId() || '';
            const location = attempt.location || primaryLocation;
            const meta: VertexCallMeta = {
                projectId,
                modelId: attempt.modelId,
                location,
                apiEndpoint: attempt.apiEndpoint,
                configuredModelId: configuredModel,
                fallbackModelId: fallbackModel,
                usedFallback: attempt.modelId !== configuredModel,
                attempts: [
                    ...attemptMeta,
                    {
                        label: attempt.label,
                        modelId: attempt.modelId,
                        location: attempt.location,
                        apiEndpoint: attempt.apiEndpoint,
                        result: 'success',
                    },
                ],
            };

            console.log('[VertexAI] analyzeImage success', {
                requestId: requestId || undefined,
                modelId: meta.modelId,
                location: meta.location,
                usedFallback: meta.usedFallback,
            });

            return { text, meta };
        } catch (error) {
            lastError = error;
            const notFound = isPublisherModelNotFound(error);
            attemptMeta.push({
                label: attempt.label,
                modelId: attempt.modelId,
                location: attempt.location,
                apiEndpoint: attempt.apiEndpoint,
                result: notFound ? 'not_found' : 'error',
                error: getErrorMessage(error).slice(0, 400),
            });
            console.warn('[VertexAI] analyzeImage attempt failed', {
                requestId: requestId || undefined,
                label: attempt.label,
                notFound,
                error: getErrorMessage(error),
            });
            if (!notFound) throw error;
        }
    }

    throw lastError;
}

function safeJsonParse<T>(text: string): T | null {
    const trimmed = trim(text);
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        const withoutFences = trimmed
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        if (withoutFences && withoutFences !== trimmed) {
            try {
                return JSON.parse(withoutFences) as T;
            } catch {
                // continue
            }
        }

        const firstBrace = withoutFences.indexOf('{');
        const lastBrace = withoutFences.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const extracted = withoutFences.slice(firstBrace, lastBrace + 1);
            try {
                return JSON.parse(extracted) as T;
            } catch {
                // ignore
            }
        }

        return null;
    }
}

function getCandidateText(response: any): string {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('')
        .trim();
}

function extractLooseJsonStringValue(input: string, startIndex: number): { value: string; endIndex: number } | null {
    const quote = input[startIndex];
    if (quote !== '"' && quote !== '\'') return null;
    let i = startIndex + 1;
    let value = '';
    while (i < input.length) {
        const ch = input[i];
        if (ch === quote) {
            return { value, endIndex: i + 1 };
        }
        if (ch === '\\') {
            const next = input[i + 1];
            if (next === undefined) break;
            switch (next) {
                case 'n':
                    value += '\n';
                    i += 2;
                    continue;
                case 'r':
                    value += '\r';
                    i += 2;
                    continue;
                case 't':
                    value += '\t';
                    i += 2;
                    continue;
                case '"':
                case '\'':
                case '\\':
                    value += next;
                    i += 2;
                    continue;
                case 'u': {
                    const hex = input.slice(i + 2, i + 6);
                    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                        value += String.fromCharCode(Number.parseInt(hex, 16));
                        i += 6;
                        continue;
                    }
                    break;
                }
                default:
                    value += next;
                    i += 2;
                    continue;
            }
        }
        value += ch;
        i += 1;
    }
    return null;
}

const STORY_FIELD_KEYS = ['title', 'summary', 'narrative'] as const;

function extractLooseObjectField(text: string, field: string, options?: { multiline?: boolean }): string | null {
    const lower = text.toLowerCase();
    const key = `"${field.toLowerCase()}"`;
    let idx = lower.indexOf(key);
    if (idx < 0) {
        const unquoted = new RegExp(`\\b${field}\\b\\s*:`, 'i');
        const match = unquoted.exec(text);
        idx = match?.index ?? -1;
    }
    if (idx < 0) return null;

    const colonIndex = text.indexOf(':', idx);
    if (colonIndex < 0) return null;

    let valueStart = colonIndex + 1;
    while (valueStart < text.length && /\s/.test(text[valueStart])) valueStart += 1;
    if (valueStart >= text.length) return null;

    const parsed = extractLooseJsonStringValue(text, valueStart);
    if (parsed) return parsed.value.trim();

    if (options?.multiline) {
        const stopKeys = STORY_FIELD_KEYS.filter((keyName) => keyName !== field.toLowerCase());
        const remainder = text.slice(valueStart);
        const stopPattern =
            stopKeys.length > 0
                ? new RegExp(`\\n\\s*(?:\"?(?:${stopKeys.join('|')})\"?)\\s*:`, 'i')
                : null;
        const match = stopPattern ? stopPattern.exec(remainder) : null;
        const rawMultiline = match?.index !== undefined && match.index > 0 ? remainder.slice(0, match.index) : remainder;
        const normalized = rawMultiline
            .replace(/\s*```$/i, '')
            .replace(/\s*,?\s*}\s*$/i, '')
            .trim();
        return normalized ? normalized : null;
    }

    const end = text.slice(valueStart).search(/[,}\n\r]/);
    const raw = end >= 0 ? text.slice(valueStart, valueStart + end) : text.slice(valueStart);
    const normalized = raw.trim();
    return normalized ? normalized : null;
}

type StoryGenerationFields = {
    title?: string;
    summary?: string;
    narrative?: string;
};

function tryParseStoryFields(text: string): StoryGenerationFields | null {
    const parsed = safeJsonParse<Record<string, unknown>>(text);
    if (parsed) {
        const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
        const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
        if (title || summary || narrative) {
            return {
                title: title || undefined,
                summary: summary || undefined,
                narrative: narrative || undefined,
            };
        }
    }

    const trimmed = trim(text);
    if (!trimmed) return null;

    const title = extractLooseObjectField(trimmed, 'title');
    const summary = extractLooseObjectField(trimmed, 'summary');
    const narrative = extractLooseObjectField(trimmed, 'narrative', { multiline: true });
    if (title || summary || narrative) {
        return {
            title: title || undefined,
            summary: summary || undefined,
            narrative: narrative || undefined,
        };
    }

    return null;
}

function looksLikeJsonPayload(text: string): boolean {
    const trimmed = trim(text);
    if (!trimmed) return false;
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')) return true;
    if (/\"title\"\s*:/i.test(trimmed) || /\bnarrative\b\s*:/i.test(trimmed) || /\bsummary\b\s*:/i.test(trimmed)) return true;
    return false;
}

function isLikelyModelRefusal(text: string): boolean {
    const normalized = trim(text).toLowerCase();
    if (!normalized) return false;
    const signals = [
        `i'm sorry`,
        `i’m sorry`,
        `i cannot`,
        `i can't`,
        `i can’t`,
        `unable to`,
        `as an ai`,
        `i won't`,
        `i can not`,
    ];
    return signals.some((signal) => normalized.includes(signal));
}

function isRetryableModelResponseError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    if (!message) return false;
    return (
        message.includes('invalid story json') ||
        message.includes('invalid story') ||
        message.includes('returned empty response') ||
        message.includes('refused to generate')
    );
}

export type StoryGenerationResult = {
    title: string;
    summary: string;
    narrative: string;
};

/**
 * Generates structured story output (title + summary + narrative) via Vertex AI.
 */
export async function generateStoryStructured(params: {
    persona: any;
    durationSec: number;
    convoHistory: any[];
    imageContext?: string;
    date?: string;
    requestId?: string;
    modelIdOverride?: string;
}): Promise<{ result: StoryGenerationResult; meta: VertexCallMeta }> {
    const requestedModel = normalizeModelId(trim(params.modelIdOverride));
    const configuredModel = requestedModel || normalizeModelId(trim(process.env.VERTEX_AI_TEXT_MODEL) || 'gemini-2.5-pro');
    const fallbackModel = normalizeModelId('gemini-2.5-pro');
    const primaryLocation = trim(process.env.VERTEX_AI_LOCATION) || 'us-central1';
    const tryGlobalLocation = shouldTryGlobalLocationFallback() && primaryLocation !== 'global';

    const wordCount = getWordCountForDuration(params.durationSec);

    const personaName = normalizePromptField(params.persona?.name, 100) || 'Narrator';
    const personaVoice = normalizePromptField(params.persona?.voiceProfile, 160);
    const personaSpecialty = normalizePromptField(params.persona?.specialty, 160);
    const season = normalizePromptField(params.date, 40) || 'winter';

    const conversationTranscript = Array.isArray(params.convoHistory)
        ? params.convoHistory
            .slice(-30)
            .map((item) => {
                const role = typeof item?.role === 'string' ? item.role.trim() : '';
                const content = typeof item?.content === 'string' ? item.content.trim() : '';
                if (!content) return null;
                return `${role ? role.toUpperCase() : 'USER'}: ${content}`;
            })
            .filter(Boolean)
            .join('\n')
        : '';

    const prompt = `
You are ${personaName}, a calming sleep story narrator.
Create a gentle, kid-friendly bedtime story that helps the listener feel safe, cozy, and sleepy.

Voice & pacing:
- ${personaVoice || 'Soft, calm, slow.'}
- Keep sentences short and soothing. Prefer second-person ("you") so it feels guided and personal.
- Favor atmosphere over plot. Nothing urgent happens.
- Avoid sharp transitions or surprise words (e.g., "suddenly", "but then", "however").
- Avoid quotation marks. If you include dialogue, write it without quotes.

Sensory palette:
- Warm light, soft textures, slow movement, quiet micro-sounds (fabric, distant rain, soft footsteps).
- Gentle, dreamy metaphors; no high-energy action.

Context:
- Use details and preferences from the conversation transcript.
- Season: ${season}. Weave in subtle seasonal color and restful details.
${params.imageContext ? `- Image inspiration: ${params.imageContext}` : ''}
- Stay kid-friendly: no fear, no danger, no conflict, no grief, no suspense.
- If you include dialogue, keep it minimal and whispered.

Length:
- Aim for about ${wordCount} words (±15%). This is a ${params.durationSec / 60}-minute story at a slow narrating pace.

Persona specialty (optional): ${personaSpecialty || 'Calm bedtime journeys.'}

Conversation Transcript:
${conversationTranscript || 'No conversation transcript provided.'}

${buildStoryStructureInstructions(params.durationSec, personaName)}

Formatting:
- Insert the literal token [PAUSE] (all caps, no spaces) to mark a silent beat (~2–4 seconds).
- Never write the word "pause" in the narrative (no "(pause)", no "pause:", no "pauses/paused/pausing"); only the [PAUSE] token.
- Place [PAUSE] after calming lines and at the end of most short paragraphs.

Return JSON only (no markdown, no extra text) with:
- title: short, evocative, topic-based title (<= 60 characters)
- summary: one-sentence topic summary (<= 120 characters)
- narrative: the full story text (include [PAUSE])
`;

    const maxOutputTokens = params.durationSec <= 30 ? 1024 : (params.durationSec <= 300 ? 2048 : 4096);

    const request: GenerateContentRequest = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: {
                type: SchemaType.OBJECT,
                required: ['title', 'summary', 'narrative'],
                properties: {
                    title: { type: SchemaType.STRING },
                    summary: { type: SchemaType.STRING },
                    narrative: { type: SchemaType.STRING },
                },
            },
        },
    };

    const run = async (options: { modelId: string; location?: string; apiEndpoint?: string }) => {
        const model = getVertexAI({ location: options.location, apiEndpoint: options.apiEndpoint }).getGenerativeModel({
            model: options.modelId,
        });
        const result = await model.generateContent(request);
        const response = await result.response;
        const text = getCandidateText(response);
        const parsed = tryParseStoryFields(text);
        const narrative = typeof parsed?.narrative === 'string' ? parsed.narrative.trim() : '';
        if (narrative) {
            const titleCandidate = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
            const summaryCandidate = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';

            const firstLine = narrative.split('\n').find(Boolean)?.trim() || narrative;
            const derivedTitle = firstLine.replace(/\[PAUSE\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
            const derivedSummary = narrative.replace(/\[PAUSE\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

            return {
                title: titleCandidate || derivedTitle || 'A Gentle Dream',
                summary: summaryCandidate || derivedSummary,
                narrative,
            };
        }

        const maybeNarrative = trim(text);
        if (!maybeNarrative) {
            throw new Error('Vertex AI returned empty response');
        }
        if (isLikelyModelRefusal(maybeNarrative)) {
            throw new Error('Vertex AI refused to generate a story');
        }

        if (!looksLikeJsonPayload(maybeNarrative) && maybeNarrative.length >= 40) {
            const firstLine = maybeNarrative.split('\n').find(Boolean)?.trim() || maybeNarrative;
            const derivedTitle = firstLine.replace(/\[PAUSE\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
            const derivedSummary = maybeNarrative.replace(/\s+/g, ' ').trim().slice(0, 120);
            return {
                title: derivedTitle || 'A Gentle Dream',
                summary: derivedSummary,
                narrative: maybeNarrative,
            };
        }

        throw new Error('Vertex AI returned invalid story JSON');
    };

    const attempts: Array<{ modelId: string; location?: string; apiEndpoint?: string; label: string }> = [
        { modelId: configuredModel, location: primaryLocation, label: `model "${configuredModel}" in ${primaryLocation}` },
    ];

    if (tryGlobalLocation) {
        attempts.push({
            modelId: configuredModel,
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com',
            label: `model "${configuredModel}" in global`,
        });
    }

    if (configuredModel !== fallbackModel) {
        attempts.push({ modelId: fallbackModel, location: primaryLocation, label: `fallback "${fallbackModel}" in ${primaryLocation}` });
        if (tryGlobalLocation) {
            attempts.push({
                modelId: fallbackModel,
                location: 'global',
                apiEndpoint: 'aiplatform.googleapis.com',
                label: `fallback "${fallbackModel}" in global`,
            });
        }
    }

    const requestId = trim(params.requestId);
    const attemptMeta: VertexAttemptMeta[] = [];

    let lastError: unknown = undefined;
    for (const attempt of attempts) {
        try {
            if (attempt !== attempts[0]) {
                console.warn(`[VertexAI] Retrying with ${attempt.label}.`);
            }

            console.log('[VertexAI] generateStoryStructured attempt', {
                requestId: requestId || undefined,
                label: attempt.label,
            });

            const result = await run({ modelId: attempt.modelId, location: attempt.location, apiEndpoint: attempt.apiEndpoint });

            const projectId = resolvedProjectId || resolveProjectId() || '';
            const location = attempt.location || primaryLocation;
            const meta: VertexCallMeta = {
                projectId,
                modelId: attempt.modelId,
                location,
                apiEndpoint: attempt.apiEndpoint,
                configuredModelId: configuredModel,
                fallbackModelId: fallbackModel,
                usedFallback: attempt.modelId !== configuredModel,
                attempts: [
                    ...attemptMeta,
                    {
                        label: attempt.label,
                        modelId: attempt.modelId,
                        location: attempt.location,
                        apiEndpoint: attempt.apiEndpoint,
                        result: 'success',
                    },
                ],
            };

            console.log('[VertexAI] generateStoryStructured success', {
                requestId: requestId || undefined,
                modelId: meta.modelId,
                location: meta.location,
                usedFallback: meta.usedFallback,
            });

            return { result, meta };
        } catch (error) {
            lastError = error;
            const notFound = isPublisherModelNotFound(error);
            const retryable = notFound || isRetryableModelResponseError(error);
            attemptMeta.push({
                label: attempt.label,
                modelId: attempt.modelId,
                location: attempt.location,
                apiEndpoint: attempt.apiEndpoint,
                result: notFound ? 'not_found' : 'error',
                error: getErrorMessage(error).slice(0, 400),
            });
            console.warn('[VertexAI] generateStoryStructured attempt failed', {
                requestId: requestId || undefined,
                label: attempt.label,
                notFound,
                error: getErrorMessage(error),
            });
            if (!retryable) throw error;
        }
    }

    throw lastError;
}

export type CoverImageResult = {
    mimeType: string;
    base64: string;
};

/**
 * Generates a cover image using a Gemini image-capable model via Vertex AI.
 */
export async function generateCoverImage(params: {
    prompt: string;
    requestId?: string;
    modelIdOverride?: string;
}): Promise<{ result: CoverImageResult; meta: VertexCallMeta }> {
    const requestedModel = normalizeModelId(trim(params.modelIdOverride));
    const defaultModel = normalizeModelId(trim(process.env.VERTEX_AI_IMAGE_MODEL) || 'gemini-3-pro-image-preview');
    const configuredModel = requestedModel || defaultModel;
    const flashModel = normalizeModelId('gemini-2.5-flash-image');
    const fallbackModel = configuredModel === flashModel ? defaultModel : flashModel;
    const primaryLocation = trim(process.env.VERTEX_AI_LOCATION) || 'us-central1';
    const tryGlobalLocation = shouldTryGlobalLocationFallback() && primaryLocation !== 'global';

    const request: GenerateContentRequest = {
        contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    };

    const run = async (options: { modelId: string; location?: string; apiEndpoint?: string }) => {
        const model = getVertexAI({ location: options.location, apiEndpoint: options.apiEndpoint }).getGenerativeModel({
            model: options.modelId,
        });
        const result = await model.generateContent(request);
        const response = await result.response;
        const parts = response?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) throw new Error('Vertex AI returned no candidates for cover image');
        for (const part of parts) {
            const inline = part?.inlineData;
            if (inline && typeof inline.data === 'string' && inline.data.trim()) {
                const mimeType = typeof inline.mimeType === 'string' && inline.mimeType.trim() ? inline.mimeType.trim() : 'image/png';
                return { mimeType, base64: inline.data };
            }
        }
        const fallbackText = getCandidateText(response);
        throw new Error(fallbackText ? `Vertex AI returned no image data: ${fallbackText.slice(0, 200)}` : 'Vertex AI returned no image data');
    };

    const attempts: Array<{ modelId: string; location?: string; apiEndpoint?: string; label: string }> = [
        { modelId: configuredModel, location: primaryLocation, label: `model "${configuredModel}" in ${primaryLocation}` },
    ];

    if (tryGlobalLocation) {
        attempts.push({
            modelId: configuredModel,
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com',
            label: `model "${configuredModel}" in global`,
        });
    }

    if (configuredModel !== fallbackModel) {
        attempts.push({ modelId: fallbackModel, location: primaryLocation, label: `fallback "${fallbackModel}" in ${primaryLocation}` });
        if (tryGlobalLocation) {
            attempts.push({
                modelId: fallbackModel,
                location: 'global',
                apiEndpoint: 'aiplatform.googleapis.com',
                label: `fallback "${fallbackModel}" in global`,
            });
        }
    }

    const requestId = trim(params.requestId);
    const attemptMeta: VertexAttemptMeta[] = [];

    let lastError: unknown = undefined;
    for (const attempt of attempts) {
        try {
            if (attempt !== attempts[0]) {
                console.warn(`[VertexAI] Retrying with ${attempt.label}.`);
            }

            console.log('[VertexAI] generateCoverImage attempt', {
                requestId: requestId || undefined,
                label: attempt.label,
            });

            const result = await run({ modelId: attempt.modelId, location: attempt.location, apiEndpoint: attempt.apiEndpoint });

            const projectId = resolvedProjectId || resolveProjectId() || '';
            const location = attempt.location || primaryLocation;
            const meta: VertexCallMeta = {
                projectId,
                modelId: attempt.modelId,
                location,
                apiEndpoint: attempt.apiEndpoint,
                configuredModelId: configuredModel,
                fallbackModelId: fallbackModel,
                usedFallback: attempt.modelId !== configuredModel,
                attempts: [
                    ...attemptMeta,
                    {
                        label: attempt.label,
                        modelId: attempt.modelId,
                        location: attempt.location,
                        apiEndpoint: attempt.apiEndpoint,
                        result: 'success',
                    },
                ],
            };

            console.log('[VertexAI] generateCoverImage success', {
                requestId: requestId || undefined,
                modelId: meta.modelId,
                location: meta.location,
                usedFallback: meta.usedFallback,
                mimeType: result.mimeType,
            });

            return { result, meta };
        } catch (error) {
            lastError = error;
            const notFound = isPublisherModelNotFound(error);
            attemptMeta.push({
                label: attempt.label,
                modelId: attempt.modelId,
                location: attempt.location,
                apiEndpoint: attempt.apiEndpoint,
                result: notFound ? 'not_found' : 'error',
                error: getErrorMessage(error).slice(0, 400),
            });
            console.warn('[VertexAI] generateCoverImage attempt failed', {
                requestId: requestId || undefined,
                label: attempt.label,
                notFound,
                error: getErrorMessage(error),
            });
            if (!notFound) throw error;
        }
    }

    throw lastError;
}
