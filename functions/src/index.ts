import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { fetchElevenLabsConversationToken, synthesizeElevenLabsSpeech } from './elevenlabs';
import { analyzeImage, generateCoverImage, generateStoryStructured } from './vertex';
import { verifyAuth } from './middleware/auth';
import { detectImageMimeTypeFromBytes, inferImageMimeTypeFromBase64 } from './utils/imageMime';
import { sanitizeNarrationText } from './utils/narration';
import { getRequestId } from './utils/request';
import { createFirebaseStorageDownloadUrl } from './utils/storage';
import { incrementStoryCounter, patchStoryCounters } from './storyCounters';
import {
    validatePersona,
    validateDuration,
    validateBase64Image,
    validateConvoHistory,
    sendValidationError,
    VALID_DURATIONS,
} from './middleware/validation';

admin.initializeApp();

// Define secrets using Firebase Secret Manager
const elevenlabsApiKey = defineSecret('ELEVENLABS_API_KEY');
const gaMeasurementId = defineString('GA_MEASUREMENT_ID', {
    label: 'GA4 Measurement ID',
    description: 'Optional. Enables Google Analytics (GA4) tracking for the HTML share page (format: G-XXXXXXXXXX).',
});
const adminPanelToken = defineSecret('ADMIN_PANEL_TOKEN');

/**
 * Cloud Function for conversational intake.
 * This is a preliminary orchestration layer for handling persona chat.
 */
export const intake = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 60,
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            // Verify authentication
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const { persona, message, sessionId } = req.body;

            // Validate persona
            if (!validatePersona(persona)) {
                sendValidationError(res, 'persona', 'Invalid persona object. Must include name (string, 1-100 chars)');
                return;
            }

            // Validate message
            if (typeof message !== 'string' || message.length === 0 || message.length > 2000) {
                sendValidationError(res, 'message', 'Message must be a string between 1-2000 characters');
                return;
            }

            // In a full implementation, this would call ElevenLabs Conversational AI
            // For MVP, we'll simulate the persona response using Gemini Flash
            console.log(`Intake for ${persona.name} by user ${auth.uid}: ${message.slice(0, 100)}...`);
            const personaId = typeof (persona as any)?.id === 'string' ? String((persona as any).id) : undefined;
            console.log('[intake] request', { requestId, uid: auth.uid, personaName: persona.name, personaId, sessionId: sessionId || null });

            res.json({
                sessionId: sessionId || `session_${Date.now()}`,
                replyText: `I hear you. Let's explore that... (Simulated ${persona.name} response)`,
                contextUpdate: { userPrompt: message },
                requestId,
            });
        } catch (error: unknown) {
            console.error('Error in intake:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: message });
        }
    }
);

/**
 * Cloud Function to generate a story.
 */
export const generate = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '1GiB',
        minInstances: 0,
        timeoutSeconds: 120,
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            // Verify authentication
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const { persona, durationSec, convoHistory, imageContext, date } = req.body;
            const vertexTextModel =
                typeof req.body?.vertexTextModel === 'string' ? String(req.body.vertexTextModel).trim() : undefined;
            if (vertexTextModel && vertexTextModel.length > 200) {
                sendValidationError(res, 'vertexTextModel', 'vertexTextModel must be <= 200 characters');
                return;
            }

            // Validate persona
            if (!validatePersona(persona)) {
                sendValidationError(res, 'persona', 'Invalid persona object. Must include name (string, 1-100 chars)');
                return;
            }

            // Validate duration
            if (!validateDuration(durationSec)) {
                sendValidationError(
                    res,
                    'durationSec',
                    `Duration must be one of: ${VALID_DURATIONS.join(', ')} seconds`
                );
                return;
            }

            // Validate and sanitize conversation history
            const { sanitized: sanitizedHistory } = validateConvoHistory(convoHistory);

            // Validate imageContext if provided
            if (imageContext !== undefined && (typeof imageContext !== 'string' || imageContext.length > 5000)) {
                sendValidationError(res, 'imageContext', 'imageContext must be a string up to 5000 characters');
                return;
            }

            console.log(`Generating story for user ${auth.uid} with persona ${persona.name}`);

            console.log('[generate] request', {
                requestId,
                uid: auth.uid,
                personaName: persona.name,
                personaId: typeof (persona as any)?.id === 'string' ? String((persona as any).id) : undefined,
                durationSec,
                hasImageContext: Boolean(imageContext),
                historyCount: Array.isArray(convoHistory) ? convoHistory.length : 0,
                vertexTextModel: vertexTextModel || null,
            });

            const result = await generateStoryStructured({
                persona,
                durationSec,
                convoHistory: sanitizedHistory,
                imageContext,
                date,
                requestId,
                modelIdOverride: vertexTextModel,
            });

            res.json({
                title: result.result.title,
                summary: result.result.summary,
                narrative: result.result.narrative,
                generatedAt: new Date().toISOString(),
                requestId,
                meta: { vertex: result.meta },
            });
        } catch (error: unknown) {
            console.error('Error generating story:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: message });
        }
    }
);

/**
 * Cloud Function to analyze an image.
 */
export const vision = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '512MiB',
        minInstances: 0,
        timeoutSeconds: 60,
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            // Verify authentication
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const { imageBase64 } = req.body;
            const rawMimeType = typeof req.body?.mimeType === 'string' ? String(req.body.mimeType).trim() : '';
            const source = typeof req.body?.source === 'string' ? String(req.body.source).trim() : '';
            const vertexVisionModel =
                typeof req.body?.vertexVisionModel === 'string' ? String(req.body.vertexVisionModel).trim() : undefined;
            if (vertexVisionModel && vertexVisionModel.length > 200) {
                sendValidationError(res, 'vertexVisionModel', 'vertexVisionModel must be <= 200 characters');
                return;
            }

            // Validate image
            const imageValidation = validateBase64Image(imageBase64);
            if (!imageValidation.valid) {
                sendValidationError(res, 'imageBase64', imageValidation.error || 'Invalid image');
                return;
            }

            console.log(`Analyzing image for user ${auth.uid}`);

            const base64Data = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
            const bytes = Buffer.from(base64Data, 'base64');
            const magicHex = bytes.subarray(0, 12).toString('hex');
            const inferredMimeType = inferImageMimeTypeFromBase64(base64Data);
            const detectedMimeType = detectImageMimeTypeFromBytes(bytes);
            if (detectedMimeType !== 'image/png' && detectedMimeType !== 'image/jpeg') {
                console.warn('[vision] unsupported image type', {
                    requestId,
                    uid: auth.uid,
                    source: source || null,
                    rawMimeType: rawMimeType || null,
                    inferredMimeType,
                    detectedMimeType,
                    magicHex,
                    base64Prefix: base64Data.slice(0, 12),
                });
                sendValidationError(res, 'imageBase64', 'Unsupported image format. Please upload a JPEG or PNG.');
                return;
            }

            const mimeType = detectedMimeType;

            console.log('[vision] request', {
                requestId,
                uid: auth.uid,
                source: source || null,
                rawMimeType: rawMimeType || null,
                vertexVisionModel: vertexVisionModel || null,
                inferredMimeType,
                detectedMimeType,
                mimeType,
                imageBytes: typeof imageBase64 === 'string' ? imageBase64.length : 0,
                base64Prefix: base64Data.slice(0, 12),
                magicHex,
            });
            const bucket = admin.storage().bucket();
            const downloadToken = randomUUID();
            const ext = mimeType.includes('png') ? 'png' : 'jpg';
            const objectPath = `covers/${auth.uid}/${Date.now()}_${randomUUID()}.${ext}`;
            const file = bucket.file(objectPath);

            const analysisPromise = analyzeImage(base64Data, { requestId, mimeType, modelIdOverride: vertexVisionModel });
            const uploadPromise = file.save(bytes, {
                resumable: false,
                metadata: {
                    contentType: mimeType,
                    cacheControl: 'public,max-age=31536000',
                    metadata: {
                        firebaseStorageDownloadTokens: downloadToken,
                    },
                },
            });

            const [result] = await Promise.all([analysisPromise, uploadPromise]);

            const imageUrl = createFirebaseStorageDownloadUrl(bucket.name, objectPath, downloadToken);

            console.log('[vision] stored', {
                requestId,
                uid: auth.uid,
                mimeType,
                bytes: bytes.length,
                magicHex,
                storagePath: objectPath,
                bucket: bucket.name,
                imageUrl: imageUrl.split('?')[0],
            });

            res.json({
                analysis: result.text,
                imageUrl,
                requestId,
                meta: { vertex: result.meta, bytes: bytes.length, storagePath: objectPath, mimeType, detectedMimeType },
            });
        } catch (error: unknown) {
            console.error('Error analyzing image:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: message });
        }
    }
);

/**
 * Cloud Function to generate a cover illustration for a story.
 */
export const illustrate = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '1GiB',
        timeoutSeconds: 120,
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
            const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
            const personaId = typeof req.body?.personaId === 'string' ? req.body.personaId.trim().slice(0, 40) : '';
            const personaName = typeof req.body?.personaName === 'string' ? req.body.personaName.trim().slice(0, 100) : '';
            const vertexImageModel =
                typeof req.body?.vertexImageModel === 'string' ? String(req.body.vertexImageModel).trim() : undefined;
            if (vertexImageModel && vertexImageModel.length > 200) {
                sendValidationError(res, 'vertexImageModel', 'vertexImageModel must be <= 200 characters');
                return;
            }

            if (!title || title.length > 80) {
                sendValidationError(res, 'title', 'title must be a non-empty string up to 80 characters');
                return;
            }
            if (!summary || summary.length > 240) {
                sendValidationError(res, 'summary', 'summary must be a non-empty string up to 240 characters');
                return;
            }

            console.log('[illustrate] request', {
                requestId,
                uid: auth.uid,
                personaId: personaId || null,
                title,
                vertexImageModel: vertexImageModel || null,
            });

            const prompt = `
Create a calming, dreamy cover illustration for a sleep story.
- No text or typography in the image.
- Soft gradients, gentle lighting, kid-friendly, cozy atmosphere.

Story title: "${title}"
One-line summary: "${summary}"
Persona style: ${personaName || 'Storytime'}

Return an image only.
`;

            const cover = await generateCoverImage({ prompt, requestId, modelIdOverride: vertexImageModel });
            const base64 = cover.result.base64;
            const mimeType = cover.result.mimeType || 'image/png';

            const bucket = admin.storage().bucket();
            const downloadToken = randomUUID();
            const ext = mimeType.includes('png') ? 'png' : 'jpg';
            const objectPath = `covers/${auth.uid}/${personaId || 'persona'}/${Date.now()}_${randomUUID()}.${ext}`;
            const file = bucket.file(objectPath);
            const bytes = Buffer.from(base64, 'base64');

            await file.save(bytes, {
                resumable: false,
                metadata: {
                    contentType: mimeType,
                    cacheControl: 'public,max-age=31536000',
                    metadata: {
                        firebaseStorageDownloadTokens: downloadToken,
                    },
                },
            });

            const imageUrl = createFirebaseStorageDownloadUrl(bucket.name, objectPath, downloadToken);

            res.json({
                imageUrl,
                requestId,
                meta: { vertex: cover.meta, bytes: bytes.length, storagePath: objectPath, mimeType },
            });
        } catch (error: unknown) {
            console.error('Error generating illustration:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: message });
        }
    }
);

/**
 * Cloud Function to narrate a story using ElevenLabs TTS and store the audio in Firebase Storage.
 */
export const narrate = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '1GiB',
        minInstances: 0,
        timeoutSeconds: 240,
        secrets: [elevenlabsApiKey],
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const voiceId = typeof req.body?.voiceId === 'string' ? req.body.voiceId.trim() : '';
            const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
            const personaId = typeof req.body?.personaId === 'string' ? req.body.personaId.trim().slice(0, 40) : '';

            if (!voiceId || voiceId.length > 100) {
                sendValidationError(res, 'voiceId', 'voiceId must be a non-empty string up to 100 characters');
                return;
            }
            if (!rawText || rawText.length > 30_000) {
                sendValidationError(res, 'text', 'text must be a non-empty string up to 30000 characters');
                return;
            }

            const apiKey = elevenlabsApiKey.value();
            if (!apiKey) {
                console.error('ELEVENLABS_API_KEY secret not configured');
                res.status(500).json({ detail: { message: 'Server configuration error' } });
                return;
            }

            const sanitizedText = sanitizeNarrationText(rawText);
            console.log('[narrate] request', {
                requestId,
                uid: auth.uid,
                personaId: personaId || null,
                voiceId,
                textLength: sanitizedText.length,
            });

            const audioBuffer = await synthesizeElevenLabsSpeech({
                voiceId,
                text: sanitizedText,
                apiKey,
                modelId: (process.env.ELEVENLABS_TTS_MODEL_ID || '').trim() || undefined,
                voiceSettings: {
                    stability: 0.55,
                    similarity_boost: 0.75,
                    style: 0.25,
                    use_speaker_boost: true,
                },
            });

            const bucket = admin.storage().bucket();
            const downloadToken = randomUUID();
            const objectPath = `narrations/${auth.uid}/${personaId || 'persona'}/${Date.now()}_${randomUUID()}.mp3`;
            const file = bucket.file(objectPath);

            await file.save(audioBuffer, {
                resumable: false,
                metadata: {
                    contentType: 'audio/mpeg',
                    cacheControl: 'public,max-age=31536000',
                    metadata: {
                        firebaseStorageDownloadTokens: downloadToken,
                    },
                },
            });

            const audioUrl = createFirebaseStorageDownloadUrl(bucket.name, objectPath, downloadToken);
            console.log('[narrate] stored', { requestId, uid: auth.uid, objectPath, bytes: audioBuffer.length });

            res.json({
                audioUrl,
                requestId,
                meta: { bytes: audioBuffer.length, voiceId, storagePath: objectPath },
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error narrating story:', error);
            res.status(500).json({ detail: { message } });
        }
    }
);

/**
 * Cloud Function to fetch an ElevenLabs Conversational AI token.
 * This keeps the ElevenLabs API key off-device while matching the SDK's expected response shape.
 */
export const elevenlabsToken = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 30,
        secrets: [elevenlabsApiKey],
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            // Verify authentication
            const auth = await verifyAuth(req, res);
            if (!auth) return;

            const agentId =
                (typeof req.query.agent_id === 'string' ? req.query.agent_id : undefined) ||
                (typeof req.body?.agent_id === 'string' ? req.body.agent_id : undefined) ||
                (typeof req.body?.agentId === 'string' ? req.body.agentId : undefined);

            if (!agentId || agentId.length > 100) {
                res.status(400).json({ detail: { message: 'Missing or invalid agent_id parameter' } });
                return;
            }

            const apiKey = elevenlabsApiKey.value();
            if (!apiKey) {
                console.error('ELEVENLABS_API_KEY secret not configured');
                res.status(500).json({ detail: { message: 'Server configuration error' } });
                return;
            }

            const source = typeof req.query.source === 'string' ? req.query.source : undefined;
            const version = typeof req.query.version === 'string' ? req.query.version : undefined;

            console.log(`Fetching ElevenLabs token for user ${auth.uid}, agent ${agentId}`);
            console.log('[elevenlabsToken] request', { requestId, uid: auth.uid, agentId, source: source || null, version: version || null });

            const token = await fetchElevenLabsConversationToken({ agentId, apiKey, source, version });
            res.json({ token, requestId });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error fetching ElevenLabs conversation token:', error);
            res.status(500).json({ detail: { message } });
        }
    }
);

/**
 * Cloud Function to fetch a story by id for sharing on the web.
 *
 * This endpoint is intentionally public; story ids are unguessable Firestore auto-ids.
 */
export const sharedStory = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 30,
    },
    async (req, res) => {
        try {
            const requestId = getRequestId(req);
            const storyId =
                (typeof req.query.storyId === 'string' ? req.query.storyId : undefined) ||
                (typeof req.body?.storyId === 'string' ? req.body.storyId : undefined);

            if (!storyId || storyId.length > 200) {
                res.status(400).json({ error: 'Missing or invalid storyId parameter.' });
                return;
            }

            const doc = await admin.firestore().collection('stories').doc(storyId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Story not found.' });
                return;
            }

            const data = doc.data() || {};

            const story = {
                id: doc.id,
                title: typeof data.title === 'string' ? data.title : '',
                summary: typeof data.summary === 'string' ? data.summary : '',
                personaName: typeof data.personaName === 'string' ? data.personaName : '',
                userName: typeof data.userName === 'string' ? data.userName : undefined,
                audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : undefined,
                coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
                createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
                duration: typeof data.duration === 'number' ? data.duration : undefined,
                playCount: typeof data.playCount === 'number' ? data.playCount : 0,
                remixCount: typeof data.remixCount === 'number' ? data.remixCount : 0,
                favoritedCount: typeof data.favoritedCount === 'number' ? data.favoritedCount : 0,
            };

            res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
            res.json({ story, requestId });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error fetching shared story:', error);
            res.status(500).json({ error: message || 'Internal server error.' });
        }
    }
);

/**
 * Cloud Function to increment a story's play count.
 *
 * This endpoint is intentionally public so anonymous share links can report plays.
 */
export const storyPlay = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 15,
    },
    async (req, res) => {
        const requestId = getRequestId(req);
        try {
            const storyId =
                (typeof req.query.storyId === 'string' ? req.query.storyId : undefined) ||
                (typeof req.body?.storyId === 'string' ? req.body.storyId : undefined);
            const source = typeof req.body?.source === 'string' ? String(req.body.source).trim() : '';

            if (!storyId || storyId.length > 200) {
                res.status(400).json({ error: 'Missing or invalid storyId parameter.' });
                return;
            }

            console.log('[storyPlay] request', { requestId, storyId, source: source || null });

            await incrementStoryCounter(storyId, 'playCount', 1);

            res.set('Cache-Control', 'no-store');
            res.json({ ok: true, requestId });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error incrementing play count:', error);
            res.status(500).json({ error: message || 'Internal server error.' });
        }
    }
);

/**
 * Firestore trigger to ensure story counter fields exist and to increment remix counts.
 */
export const storyCounters = onDocumentCreated('stories/{storyId}', async (event) => {
    const requestId = event.id;
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data() || {};
    const storyId = snapshot.id;

    try {
        await patchStoryCounters(snapshot.ref, data);

        const remixOfStoryId = typeof data.remixOfStoryId === 'string' ? data.remixOfStoryId.trim() : '';
        if (remixOfStoryId) {
            await incrementStoryCounter(remixOfStoryId, 'remixCount', 1);
            console.log('[storyCounters] remix incremented', { requestId, storyId, remixOfStoryId });
        }
    } catch (error) {
        console.error('[storyCounters] failed', {
            requestId,
            storyId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * Firestore triggers to maintain `favoritedCount` on story documents.
 */
export const favoriteCounterCreate = onDocumentCreated('users/{userId}/favorites/{storyId}', async (event) => {
    const requestId = event.id;
    const storyId = typeof event.params?.storyId === 'string' ? event.params.storyId : '';
    const userId = typeof event.params?.userId === 'string' ? event.params.userId : '';
    if (!storyId) return;
    try {
        await incrementStoryCounter(storyId, 'favoritedCount', 1);
        console.log('[favoriteCounterCreate] incremented', { requestId, storyId, userId });
    } catch (error) {
        console.error('[favoriteCounterCreate] failed', {
            requestId,
            storyId,
            userId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export const favoriteCounterDelete = onDocumentDeleted('users/{userId}/favorites/{storyId}', async (event) => {
    const requestId = event.id;
    const storyId = typeof event.params?.storyId === 'string' ? event.params.storyId : '';
    const userId = typeof event.params?.userId === 'string' ? event.params.userId : '';
    if (!storyId) return;
    try {
        await incrementStoryCounter(storyId, 'favoritedCount', -1);
        console.log('[favoriteCounterDelete] decremented', { requestId, storyId, userId });
    } catch (error) {
        console.error('[favoriteCounterDelete] failed', {
            requestId,
            storyId,
            userId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

function escapeHtml(value: string): string {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCreatorAttribution(displayName: string | undefined): string {
    const trimmed = String(displayName || '').trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    if (!firstName) return '';
    if (parts.length < 2) return firstName;
    const last = parts[parts.length - 1] || '';
    const initial = last.trim().replace(/[^A-Za-z]/g, '')[0] || '';
    if (!initial) return firstName;
    return `${firstName} ${initial.toUpperCase()}`;
}

function formatCountLabel(count: unknown): string {
    const normalized =
        typeof count === 'number' && Number.isFinite(count)
            ? Math.max(0, Math.floor(count))
            : 0;
    if (normalized < 1000) return String(normalized);
    try {
        return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(normalized);
    } catch {
        return normalized.toLocaleString();
    }
}

function formatDurationLabel(durationSec: unknown): string {
    if (typeof durationSec !== 'number') return '';
    if (!Number.isFinite(durationSec)) return '';
    if (durationSec <= 0) return '';

    const totalSeconds = Math.max(0, Math.round(durationSec));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        const parts = [`${hours}h`, minutes ? `${minutes}m` : null].filter(Boolean);
        return parts.join(' ');
    }

    if (minutes > 0) {
        return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    return `${seconds}s`;
}

function formatShortDateLabel(timestampMs: unknown): string {
    if (typeof timestampMs !== 'number') return '';
    if (!Number.isFinite(timestampMs)) return '';
    try {
        const date = new Date(timestampMs);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function normalizeMetaText(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampMetaText(value: string, maxLength: number): string {
    const normalized = normalizeMetaText(value);
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    const trimmed = normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
    return `${trimmed}…`;
}

function getBaseUrlFromRequest(req: any): string | null {
    const rawHost =
        (typeof req?.get === 'function' ? req.get('x-forwarded-host') || req.get('host') : undefined) ||
        req?.headers?.['x-forwarded-host'] ||
        req?.headers?.host;

    if (typeof rawHost !== 'string' || !rawHost.trim()) return null;
    const host = rawHost.split(',')[0].trim();

    const rawProto =
        (typeof req?.get === 'function' ? req.get('x-forwarded-proto') : undefined) || req?.headers?.['x-forwarded-proto'];
    const protoCandidate = typeof rawProto === 'string' && rawProto.trim() ? rawProto.split(',')[0].trim() : 'https';
    const proto = /^[a-z]+$/i.test(protoCandidate) ? protoCandidate : 'https';

    return `${proto}://${host}`;
}

function resolveFirebaseProjectIdFromEnv(): string | null {
    const candidates = [
        process.env.GCLOUD_PROJECT,
        process.env.GOOGLE_CLOUD_PROJECT,
        process.env.GOOGLE_CLOUD_PROJECT_ID,
        process.env.GCP_PROJECT,
    ];

    for (const candidate of candidates) {
        const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
        if (trimmed && /^[a-z0-9-]+$/i.test(trimmed)) return trimmed;
    }

    const firebaseConfig = typeof process.env.FIREBASE_CONFIG === 'string' ? process.env.FIREBASE_CONFIG.trim() : '';
    if (firebaseConfig) {
        try {
            const parsed = JSON.parse(firebaseConfig);
            const projectId = typeof parsed?.projectId === 'string' ? parsed.projectId.trim() : '';
            if (projectId && /^[a-z0-9-]+$/i.test(projectId)) return projectId;
        } catch {
            // ignore
        }
    }

    return null;
}

function inferFirebaseHostingBaseUrlFromEnv(): string | null {
    const projectId = resolveFirebaseProjectIdFromEnv();
    if (!projectId) return null;
    return `https://${projectId}.web.app`;
}

function getShareAssetsBaseUrl(requestBaseUrl: string | null): string | null {
    const hostingBaseUrl = inferFirebaseHostingBaseUrlFromEnv();
    if (!requestBaseUrl) return hostingBaseUrl;

    const normalized = requestBaseUrl.trim();
    if (normalized.includes('.cloudfunctions.net') || normalized.includes('.a.run.app')) {
        return hostingBaseUrl || normalized;
    }

    return normalized;
}

function getShareStoryIdFromRequest(req: any): string | null {
    const direct =
        (typeof req?.query?.storyId === 'string' ? req.query.storyId : undefined) ||
        (typeof req?.body?.storyId === 'string' ? req.body.storyId : undefined);

    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const path = typeof req?.path === 'string' ? req.path : '';
    const originalUrl =
        typeof req?.originalUrl === 'string' ? req.originalUrl : typeof req?.url === 'string' ? req.url : '';

    const source = path || originalUrl;
    const match = source.match(/^\/s\/([^/?#]+)/);
    if (!match) return null;

    const raw = match[1] || '';
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

/**
 * Cloud Function to serve an HTML share page with Open Graph tags.
 *
 * Intended to be used behind Firebase Hosting rewrites (see `firebase.json`).
 * Link preview bots generally do not execute client-side JS, so OG tags must be in the initial HTML response.
 */
export const share = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 30,
    },
    async (req, res) => {
        const requestId = getRequestId(req);
        const debugRaw = typeof req.query?.debug === 'string' ? req.query.debug.trim().toLowerCase() : '';
        const showDebug = debugRaw === '1' || debugRaw === 'true';

        try {
            const storyId = getShareStoryIdFromRequest(req);
            const requestBaseUrl = getBaseUrlFromRequest(req);
            const baseUrl = getShareAssetsBaseUrl(requestBaseUrl);
            const faviconUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/favicon.ico?v=1` : '/favicon.ico?v=1';

            if (!storyId || storyId.length > 200) {
                res.status(400);
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(
                    [
                        '<!doctype html>',
                        '<html lang="en">',
                        '<head>',
                        '<meta charset="utf-8" />',
                        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                        `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                        '<title>Storytime</title>',
                        '<meta name="description" content="Open a shared Storytime link to listen to a sleep story." />',
                        '</head>',
                        '<body>',
                        '<p>Missing or invalid story id.</p>',
                        '</body>',
                        '</html>',
                    ].join('\n')
                );
                return;
            }

            const doc = await admin.firestore().collection('stories').doc(storyId).get();
            if (!doc.exists) {
                res.status(404);
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(
                    [
                        '<!doctype html>',
                        '<html lang="en">',
                        '<head>',
                        '<meta charset="utf-8" />',
                        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                        `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                        '<title>Story not found • Storytime</title>',
                        '<meta name="description" content="This Storytime link is no longer available." />',
                        '</head>',
                        '<body>',
                        '<p>Story not found.</p>',
                        '</body>',
                        '</html>',
                    ].join('\n')
                );
                return;
            }

            const data = doc.data() || {};
            const storyTitle = typeof data.title === 'string' ? data.title : '';
            const storySummary = typeof data.summary === 'string' ? data.summary : '';
            const personaName = typeof data.personaName === 'string' ? data.personaName : '';
            const personaId = typeof data.personaId === 'string' ? data.personaId : '';
            const userName = typeof data.userName === 'string' ? data.userName : '';
            const audioUrl = typeof data.audioUrl === 'string' ? data.audioUrl : '';
            const coverImageUrl = typeof data.coverImageUrl === 'string' ? data.coverImageUrl : '';
            const duration = typeof data.duration === 'number' ? data.duration : undefined;
            const createdAt = typeof data.createdAt === 'number' ? data.createdAt : undefined;
            const isPublic = Boolean(data.isPublic);
            const playCount = typeof data.playCount === 'number' ? data.playCount : 0;
            const remixCount = typeof data.remixCount === 'number' ? data.remixCount : 0;
            const favoritedCount = typeof data.favoritedCount === 'number' ? data.favoritedCount : 0;
            const creatorAttribution = formatCreatorAttribution(userName) || '';
            const dateLabel = formatShortDateLabel(createdAt);
            const durationLabel = formatDurationLabel(duration);
            const topRightLabel = creatorAttribution
                ? (dateLabel ? `${dateLabel} • ${creatorAttribution}` : creatorAttribution)
                : dateLabel;
            const avatarUrl = personaId ? `/avatars/${encodeURIComponent(personaId)}.png` : '';

            const canonicalUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/s/${encodeURIComponent(storyId)}` : '';
            const fallbackImageUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/og.png` : '/og.png';
            const imageUrl = coverImageUrl || fallbackImageUrl;

            const title = storyTitle ? `${storyTitle} • Storytime` : 'Storytime';
            const description = clampMetaText(
                storySummary || 'Open a shared Storytime link to listen to a sleep story.',
                240
            );

            const measurementId = gaMeasurementId.value().trim();
            const analyticsViewParams: Record<string, unknown> | null = measurementId
                ? {
                    story_id: storyId,
                    ...(personaId ? { persona_id: personaId } : {}),
                    has_audio: audioUrl ? 1 : 0,
                    source: 'web_share',
                }
                : null;

            const analyticsHeadScript = measurementId
                ? [
                    `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(measurementId)}"></script>`,
                    '<script>',
                    'window.dataLayer = window.dataLayer || [];',
                    'function gtag(){window.dataLayer.push(arguments);}',
                    'gtag(\'js\', new Date());',
                    `gtag('config', ${JSON.stringify(measurementId)});`,
                    analyticsViewParams ? `gtag('event', 'share_view', ${JSON.stringify(analyticsViewParams)});` : '',
                    '</script>',
                ]
                    .filter(Boolean)
                    .join('\n')
                : '';

            const playCountTrackingScript = audioUrl
                ? [
                    '<script>',
                    '(function(){',
                    `var storyId=${JSON.stringify(storyId)};`,
                    `var personaId=${JSON.stringify(personaId || '')};`,
                    'var analyticsParams=(function(){var p={story_id:storyId,has_audio:1,source:"web_share"};if(personaId)p.persona_id=personaId;return p;})();',
                    'var audio=document.querySelector("audio");',
                    'if(!audio||!storyId)return;',
                    'var sent=false;',
                    'audio.addEventListener("play",function(){',
                    'if(sent)return;',
                    'sent=true;',
                    'try{',
                    'if(typeof window.gtag==="function"){window.gtag("event","share_audio_play",analyticsParams);}',
                    'fetch("/storyPlay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({storyId:storyId,source:"web"}),keepalive:true}).catch(function(){});',
                    '}catch(e){}',
                    '});',
                    'var ended=false;',
                    'audio.addEventListener("ended",function(){',
                    'if(ended)return;',
                    'ended=true;',
                    'try{',
                    'if(typeof window.gtag==="function"){window.gtag("event","share_audio_complete",analyticsParams);}',
                    '}catch(e){}',
                    '});',
                    '})();',
                    '</script>',
                ].join('\n')
                : '';

            const globeIcon = [
                '<svg class="badgeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                '<circle cx="12" cy="12" r="10" />',
                '<path d="M2 12h20" />',
                '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />',
                '</svg>',
            ].join('');

            const topLeftBadge = (personaName || durationLabel)
                ? [
                    '<div class="badge badgeTop badgeLeft">',
                    '<div class="badgeRow">',
                    avatarUrl ? `<img class="badgeAvatar" src="${escapeHtml(avatarUrl)}" alt="" />` : '',
                    personaName ? `<div class="badgeTitle">${escapeHtml(personaName)}</div>` : '',
                    durationLabel ? `<div class="badgeMuted">• ${escapeHtml(durationLabel)}</div>` : '',
                    '</div>',
                    '</div>',
                ]
                    .filter(Boolean)
                    .join('')
                : '';

            const topRightBadge = topRightLabel || isPublic
                ? [
                    '<div class="badge badgeTop badgeRight">',
                    '<div class="badgeMetaRow">',
                    topRightLabel ? `<span class="badgeMeta">${escapeHtml(topRightLabel)}</span>` : '',
                    isPublic ? globeIcon : '',
                    '</div>',
                    '</div>',
                ]
                    .filter(Boolean)
                    .join('')
                : '';

            const bottomLeftBadge = [
                '<div class="badge badgeBottom badgeLeft">',
                `<div class="badgeStoryTitle">${escapeHtml(storyTitle || 'Untitled Story')}</div>`,
                '</div>',
            ].join('');

            const coverBlock = [
                '<div class="coverWrap">',
                imageUrl ? `<img class="coverImg" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(storyTitle || 'Cover')}" />` : '',
                topLeftBadge,
                topRightBadge,
                bottomLeftBadge,
                '</div>',
            ]
                .filter(Boolean)
                .join('');

            const testFlightUrlRaw = (process.env.EXPO_PUBLIC_TESTFLIGHT_URL || process.env.TESTFLIGHT_URL || '').trim();
            const testFlightUrl = /^https?:\/\//i.test(testFlightUrlRaw) ? testFlightUrlRaw : 'https://testflight.apple.com/';
            const brandBlock = [
                `<a class="brand" href="${escapeHtml(testFlightUrl)}" target="_blank" rel="noopener noreferrer">`,
                `<img src="${escapeHtml(faviconUrl)}" alt="Storytime" />`,
                '<div class="brandText">',
                '<div class="brandName">Storytime</div>',
                '<div class="brandCta">Get the iOS beta on TestFlight</div>',
                '</div>',
                '</a>',
            ].join('');

            const statIconListen = [
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                '<path d="M4 13v6a2 2 0 002 2h2v-8H6a2 2 0 00-2 2z" />',
                '<path d="M20 13v6a2 2 0 01-2 2h-2v-8h2a2 2 0 012 2z" />',
                '<path d="M4 13a8 8 0 0116 0" />',
                '</svg>',
            ].join('');
            const statIconRemix = [
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                '<path d="M6 8v8" />',
                '<path d="M6 12h10" />',
                '<circle cx="6" cy="6" r="2" />',
                '<circle cx="6" cy="18" r="2" />',
                '<circle cx="18" cy="12" r="2" />',
                '</svg>',
            ].join('');
            const statIconFavorites = [
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
                '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />',
                '</svg>',
            ].join('');

            const statsBlock = [
                '<div class="actionRow">',
                `<div class="actionItem" aria-label="Listen count ${escapeHtml(formatCountLabel(playCount))}">${statIconListen}<div class="actionValue">${escapeHtml(formatCountLabel(playCount))}</div></div>`,
                `<div class="actionItem" aria-label="Remix count ${escapeHtml(formatCountLabel(remixCount))}">${statIconRemix}<div class="actionValue">${escapeHtml(formatCountLabel(remixCount))}</div></div>`,
                `<div class="actionItem" aria-label="Favorites count ${escapeHtml(formatCountLabel(favoritedCount))}">${statIconFavorites}<div class="actionValue">${escapeHtml(formatCountLabel(favoritedCount))}</div></div>`,
                '</div>',
            ].join('');

            res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(
                [
                    '<!doctype html>',
                    '<html lang="en">',
                    '<head>',
                    '<meta charset="utf-8" />',
                    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                    `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                    `<title>${escapeHtml(title)}</title>`,
                    `<meta name="description" content="${escapeHtml(description)}" />`,
                    '<meta property="og:locale" content="en" />',
                    '<meta property="og:type" content="website" />',
                    '<meta property="og:site_name" content="Storytime" />',
                    `<meta property="og:title" content="${escapeHtml(title)}" />`,
                    `<meta property="og:description" content="${escapeHtml(description)}" />`,
                    canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />` : '',
                    canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />` : '',
                    imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : '',
                    imageUrl ? `<meta property="og:image:alt" content="${escapeHtml(storyTitle || 'Storytime cover')}" />` : '',
                    '<meta name="twitter:card" content="summary_large_image" />',
                    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
                    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
                    imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : '',
                    analyticsHeadScript,
                    '<style>',
                    'body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0B0C12; color: #F5F7FF; }',
                    '* { box-sizing: border-box; }',
                    'main { max-width: 720px; margin: 0 auto; padding: 32px 16px; }',
                    '.card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; }',
                    '.brand { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); text-decoration: none; color: inherit; }',
                    '.brand img { width: 44px; height: 44px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); }',
                    '.brandName { font-size: 16px; font-weight: 600; }',
                    '.brandCta { font-size: 13px; color: rgba(245,247,255,0.75); }',
                    '.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }',
                    '.coverWrap { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); }',
                    '.coverImg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }',
                    '.badge { position: absolute; max-width: 78%; border-radius: 14px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.16); background: rgba(15,16,25,0.55); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }',
                    '.badgeTop { top: 12px; height: 42px; display: flex; align-items: center; }',
                    '.badgeBottom { bottom: 12px; }',
                    '.badgeLeft { left: 12px; }',
                    '.badgeRight { right: 12px; max-width: 78%; }',
                    '.badgeRow { display: flex; align-items: center; gap: 8px; min-width: 0; }',
                    '.badgeMetaRow { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }',
                    '.badgeAvatar { width: 18px; height: 18px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.08); }',
                    '.badgeTitle { font-size: 13px; font-weight: 600; color: rgba(245,247,255,0.98); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
                    '.badgeMuted { font-size: 12px; font-weight: 500; color: rgba(245,247,255,0.72); white-space: nowrap; }',
                    '.badgeMeta { font-size: 11px; font-weight: 500; color: rgba(245,247,255,0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
                    '.badgeIcon { width: 16px; height: 16px; color: rgba(245,247,255,0.72); flex: 0 0 auto; }',
                    '.badgeStoryTitle { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2; color: rgba(245,247,255,0.98); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }',
                    '.actionRow { display: flex; align-items: stretch; border-top: 1px solid rgba(255,255,255,0.12); margin-top: 12px; padding-top: 12px; }',
                    '.actionItem { flex: 1; padding: 12px 0; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; }',
                    '.actionItem + .actionItem { border-left: 1px solid rgba(255,255,255,0.12); }',
                    '.actionValue { font-size: 16px; font-weight: 700; color: rgba(245,247,255,0.98); }',
                    '.actionItem svg { width: 20px; height: 20px; color: rgba(245,247,255,0.72); }',
                    '.meta { color: rgba(245,247,255,0.75); font-size: 14px; line-height: 20px; margin: 16px 0 0; }',
                    '.summary { color: rgba(245,247,255,0.9); font-size: 16px; line-height: 24px; white-space: pre-wrap; }',
                    'audio { width: 100%; margin-top: 16px; }',
                    '.footer { margin-top: 16px; font-size: 12px; color: rgba(245,247,255,0.55); }',
                    'a { color: #A9C2FF; }',
                    '@media (max-width: 420px) { main { padding: 20px 12px; } .card { padding: 16px; } .badge { border-radius: 12px; padding: 9px 10px; } .badgeStoryTitle { font-size: 16px; } }',
                    '</style>',
                    '</head>',
                    '<body>',
                    '<main>',
                    '<div class="card">',
                    brandBlock,
                    `<h1 class="srOnly">${escapeHtml(storyTitle || 'Untitled Story')}</h1>`,
                    coverBlock,
                    statsBlock,
                    storySummary ? `<p class="summary">${escapeHtml(storySummary)}</p>` : '',
                    audioUrl ? `<audio controls controlsList="nodownload" preload="none" src="${escapeHtml(audioUrl)}"></audio>` : '<p class="meta">Audio is not available for this story.</p>',
                    playCountTrackingScript,
                    showDebug && canonicalUrl ? `<p class="footer">Link: <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></p>` : '',
                    showDebug ? `<p class="footer">Request: ${escapeHtml(requestId)}</p>` : '',
                    '</div>',
                    '</main>',
                    '</body>',
                    '</html>',
                ]
                    .filter(Boolean)
                    .join('\n')
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error rendering share page:', error);
            res.status(500);
            res.set('Content-Type', 'text/html; charset=utf-8');
            const requestBaseUrl = getBaseUrlFromRequest(req);
            const baseUrl = getShareAssetsBaseUrl(requestBaseUrl);
            const faviconUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/favicon.ico?v=1` : '/favicon.ico?v=1';
            res.send(
                [
                    '<!doctype html>',
                    '<html lang="en">',
                    '<head>',
                    '<meta charset="utf-8" />',
                    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                    `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                    '<title>Storytime</title>',
                    `<meta name="description" content="${escapeHtml(message || 'Internal server error')}" />`,
                    '</head>',
                    '<body>',
                    '<p>Internal server error.</p>',
                    '</body>',
                    '</html>',
                ].join('\n')
            );
        }
    }
);

function extractAdminToken(req: any): string {
    const header = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (header.toLowerCase().startsWith('bearer ')) {
        return header.slice(7).trim();
    }

    const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (queryToken) return queryToken;

    const bodyToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (bodyToken) return bodyToken;

    return '';
}

function parseAdminFormBody(req: any): Record<string, string> {
    const contentType = typeof req.headers?.['content-type'] === 'string' ? req.headers['content-type'] : '';
    const rawBody = (req as any)?.rawBody;

    if (contentType.includes('application/json') && req.body && typeof req.body === 'object') {
        return Object.fromEntries(
            Object.entries(req.body).map(([key, value]) => [key, typeof value === 'string' ? value : String(value)])
        );
    }

    if (rawBody && typeof rawBody?.toString === 'function') {
        const parsed = new URLSearchParams(rawBody.toString('utf8'));
        const result: Record<string, string> = {};
        parsed.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    return {};
}

const VALID_DAILY_CREATE_LIMITS = [1, 3, 5, 11] as const;

function normalizeDailyCreateLimit(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    const parsed = Math.floor(value);
    return VALID_DAILY_CREATE_LIMITS.includes(parsed as any) ? parsed : 1;
}

function normalizeDefaultStoryDurationSec(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 60;
    const parsed = Math.floor(value);
    return VALID_DURATIONS.includes(parsed as any) ? parsed : 60;
}

function formatDurationOptionLabel(durationSec: number): string {
    if (durationSec === 15) return '15s (demo)';
    if (durationSec === 60) return '60s (1 min)';
    if (durationSec === 300) return '300s (5 min)';
    if (durationSec === 600) return '600s (10 min)';
    return `${durationSec}s`;
}

export const adminFeatured = onRequest(
    {
        cors: true,
        invoker: 'public',
        memory: '512MiB',
        timeoutSeconds: 60,
        secrets: [adminPanelToken],
    },
    async (req, res) => {
        const token = extractAdminToken(req);
        const expected = adminPanelToken.value();

        if (!expected) {
            res.status(500).send('Missing ADMIN_PANEL_TOKEN secret.');
            return;
        }

        if (!token || token !== expected) {
            const requestBaseUrl = getBaseUrlFromRequest(req);
            const baseUrl = getShareAssetsBaseUrl(requestBaseUrl);
            const faviconUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/favicon.ico?v=1` : '/favicon.ico?v=1';
            res.set('Cache-Control', 'no-store');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.status(401).send(
                [
                    '<!doctype html>',
                    '<html lang="en">',
                    '<head>',
                    '<meta charset="utf-8" />',
                    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                    `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                    '<title>Admin • Storytime</title>',
                    '<style>',
                    'body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0B0C12; color: #F5F7FF; }',
                    'main { max-width: 640px; margin: 0 auto; padding: 36px 16px; }',
                    'h1 { font-size: 22px; margin: 0 0 10px; letter-spacing: -0.2px; }',
                    'p { margin: 8px 0; color: rgba(245,247,255,0.75); line-height: 1.5; }',
                    '.panel { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 16px; }',
                    'form { display: flex; gap: 10px; margin-top: 12px; }',
                    'input { flex: 1; background: rgba(0,0,0,0.18); color: #F5F7FF; border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; padding: 12px; font-size: 14px; }',
                    'button { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18); color: #F5F7FF; padding: 12px 14px; border-radius: 12px; font-weight: 700; cursor: pointer; }',
                    'code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; font-size: 13px; }',
                    'a { color: #A9C2FF; }',
                    '</style>',
                    '</head>',
                    '<body>',
                    '<main>',
                    '<h1>Admin Panel</h1>',
                    '<div class="panel">',
                    '<p>Enter the admin token to continue.</p>',
                    '<p>Tip: open <code>/admin?token=&lt;ADMIN_PANEL_TOKEN&gt;</code> (or send <code>Authorization: Bearer &lt;token&gt;</code>).</p>',
                    '<form method="GET" action="/admin">',
                    '<input type="password" name="token" placeholder="ADMIN_PANEL_TOKEN" autocomplete="current-password" />',
                    '<button type="submit">Continue</button>',
                    '</form>',
                    '<p>This token is stored as a Firebase Functions secret named <code>ADMIN_PANEL_TOKEN</code>.</p>',
                    '</div>',
                    '</main>',
                    '</body>',
                    '</html>',
                ].join('\n')
            );
            return;
        }

        const requestBaseUrl = getBaseUrlFromRequest(req);
        const baseUrl = getShareAssetsBaseUrl(requestBaseUrl);
        const faviconUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/favicon.ico?v=1` : '/favicon.ico?v=1';

        const adminPath = '/admin';
        const tokenParam = encodeURIComponent(token);

        if (req.method === 'POST') {
            const body = parseAdminFormBody(req);
            const intentRaw = typeof body.intent === 'string' ? body.intent.trim().toLowerCase() : '';

            if (intentRaw === 'config') {
                const dailyLimitRaw = typeof body.dailyCreateLimit === 'string' ? body.dailyCreateLimit.trim() : '';
                const durationRaw =
                    typeof body.defaultStoryDurationSec === 'string' ? body.defaultStoryDurationSec.trim() : '';

                const dailyLimitParsed = dailyLimitRaw ? Number.parseInt(dailyLimitRaw, 10) : NaN;
                const durationParsed = durationRaw ? Number.parseInt(durationRaw, 10) : NaN;

                const updates: Record<string, any> = {};
                if (Number.isFinite(dailyLimitParsed)) {
                    if (!VALID_DAILY_CREATE_LIMITS.includes(dailyLimitParsed as any)) {
                        res.status(400).send('dailyCreateLimit must be one of: 1, 3, 5, 11.');
                        return;
                    }
                    updates.dailyCreateLimit = dailyLimitParsed;
                }

                if (Number.isFinite(durationParsed)) {
                    if (!VALID_DURATIONS.includes(durationParsed as any)) {
                        res.status(400).send(`defaultStoryDurationSec must be one of: ${VALID_DURATIONS.join(', ')}.`);
                        return;
                    }
                    updates.defaultStoryDurationSec = durationParsed;
                }

                if (!Object.keys(updates).length) {
                    res.status(400).send('No config updates submitted.');
                    return;
                }

                updates.updatedAt = Date.now();
                await admin.firestore().collection('config').doc('app').set(updates, { merge: true });

                res.status(303);
                res.set('Location', `${adminPath}?token=${tokenParam}`);
                res.send('');
                return;
            }

            const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
            const featuredRaw = typeof body.isFeatured === 'string' ? body.isFeatured.trim() : '';
            const nextFeatured = featuredRaw === '1' || featuredRaw.toLowerCase() === 'true';

            if (!storyId || storyId.length > 200) {
                res.status(400).send('Missing or invalid storyId.');
                return;
            }

            await admin.firestore().collection('stories').doc(storyId).set(
                nextFeatured ? { isFeatured: true, isPublic: true } : { isFeatured: false },
                { merge: true }
            );

            res.status(303);
            res.set('Location', `${adminPath}?token=${tokenParam}`);
            res.send('');
            return;
        }

        const configSnapshot = await admin.firestore().collection('config').doc('app').get();
        const configData = configSnapshot.exists ? configSnapshot.data() || {} : {};
        const configDailyLimit = normalizeDailyCreateLimit((configData as any).dailyCreateLimit);
        const configDurationSec = normalizeDefaultStoryDurationSec((configData as any).defaultStoryDurationSec);
        const configUpdatedAtMs = typeof (configData as any).updatedAt === 'number' ? (configData as any).updatedAt : null;

        const storiesRef = admin.firestore().collection('stories');

        const publicSnapshot = await storiesRef
            .where('isPublic', '==', true)
            .orderBy('playCount', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(60)
            .get();

        let featuredSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
        try {
            featuredSnapshot = await storiesRef
                .where('isFeatured', '==', true)
                .orderBy('playCount', 'desc')
                .orderBy('createdAt', 'desc')
                .limit(60)
                .get();
        } catch (error) {
            console.warn('[adminFeatured] featured query fallback', {
                message: error instanceof Error ? error.message : String(error),
            });
            featuredSnapshot = await storiesRef
                .where('isFeatured', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(60)
                .get();
        }

        const publicCandidates = publicSnapshot.docs
            .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
            .filter(({ data }) => !data.isFeatured);

        const featuredStories = featuredSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));

        const renderStoryRow = (story: { id: string; data: Record<string, any> }, action: 'feature' | 'unfeature') => {
            const data = story.data || {};
            const title = typeof data.title === 'string' ? data.title : 'Untitled';
            const personaName = typeof data.personaName === 'string' ? data.personaName : '';
            const coverImageUrl = typeof data.coverImageUrl === 'string' ? data.coverImageUrl : '';
            const creator = formatCreatorAttribution(typeof data.userName === 'string' ? data.userName : undefined);
            const playCount = formatCountLabel(typeof data.playCount === 'number' ? data.playCount : 0);
            const remixCount = formatCountLabel(typeof data.remixCount === 'number' ? data.remixCount : 0);
            const favoritedCount = formatCountLabel(typeof data.favoritedCount === 'number' ? data.favoritedCount : 0);

            const actionLabel = action === 'feature' ? 'Feature' : 'Unfeature';
            const actionValue = action === 'feature' ? '1' : '0';
            const actionClass = action === 'feature' ? 'btn' : 'btn btnSecondary';

            const stats = [
                `<span title="Listen">${escapeHtml(playCount)}</span>`,
                `<span title="Remix">${escapeHtml(remixCount)}</span>`,
                `<span title="Favorites">${escapeHtml(favoritedCount)}</span>`,
            ].join('<span class="dot">•</span>');

            return [
                '<div class="row">',
                coverImageUrl ? `<img class="thumb" src="${escapeHtml(coverImageUrl)}" alt="" />` : '<div class="thumb placeholder"></div>',
                '<div class="rowBody">',
                `<div class="rowTitle">${escapeHtml(title)}</div>`,
                '<div class="rowMeta">',
                creator ? `<span>By ${escapeHtml(creator)}</span>` : '',
                personaName ? `<span>${escapeHtml(personaName)}</span>` : '',
                `<span class="statsInline">${stats}</span>`,
                '</div>',
                '</div>',
                '<form class="rowAction" method="POST" action="' + adminPath + '">',
                `<input type="hidden" name="token" value="${escapeHtml(token)}" />`,
                `<input type="hidden" name="storyId" value="${escapeHtml(story.id)}" />`,
                `<input type="hidden" name="isFeatured" value="${escapeHtml(actionValue)}" />`,
                `<button class="${actionClass}" type="submit">${escapeHtml(actionLabel)}</button>`,
                '</form>',
                '</div>',
            ]
                .filter(Boolean)
                .join('');
        };

        const candidatesHtml = publicCandidates.length
            ? publicCandidates.map((story) => renderStoryRow(story, 'feature')).join('')
            : '<p class="empty">No public stories waiting for curation.</p>';

        const featuredHtml = featuredStories.length
            ? featuredStories.map((story) => renderStoryRow(story, 'unfeature')).join('')
            : '<p class="empty">No featured stories yet.</p>';

        res.set('Cache-Control', 'no-store');
        res.set('Content-Type', 'text/html; charset=utf-8');

        const configDailyOptions = VALID_DAILY_CREATE_LIMITS.map((value) => {
            const selected = value === configDailyLimit ? ' selected' : '';
            return `<option value="${value}"${selected}>${value}</option>`;
        }).join('');

        const configDurationOptions = VALID_DURATIONS.map((value) => {
            const selected = value === configDurationSec ? ' selected' : '';
            return `<option value="${value}"${selected}>${escapeHtml(formatDurationOptionLabel(value))}</option>`;
        }).join('');

        const configUpdatedLabel = typeof configUpdatedAtMs === 'number' && Number.isFinite(configUpdatedAtMs)
            ? new Date(configUpdatedAtMs).toISOString()
            : null;

        res.send(
            [
                '<!doctype html>',
                '<html lang="en">',
                '<head>',
                '<meta charset="utf-8" />',
                '<meta name="viewport" content="width=device-width, initial-scale=1" />',
                `<link rel="icon" href="${escapeHtml(faviconUrl)}" />`,
                '<title>Featured Curation • Storytime</title>',
                '<style>',
                'body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0B0C12; color: #F5F7FF; }',
                'main { max-width: 980px; margin: 0 auto; padding: 32px 16px; }',
                'h1 { font-size: 22px; margin: 0 0 20px; letter-spacing: -0.2px; }',
                'h2 { font-size: 16px; margin: 24px 0 12px; color: rgba(245,247,255,0.9); }',
                '.panel { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 16px; }',
                '.panel + .panel { margin-top: 18px; }',
                '.configForm { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin: 0; }',
                '.configField { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }',
                '.configLabel { font-size: 12px; color: rgba(245,247,255,0.7); }',
                '.configSelect { background: rgba(0,0,0,0.18); color: #F5F7FF; border: 1px solid rgba(255,255,255,0.16); border-radius: 12px; padding: 10px 12px; font-size: 14px; }',
                '.configHint { margin: 10px 0 0; font-size: 12px; color: rgba(245,247,255,0.55); }',
                '.row { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }',
                '.row:last-child { border-bottom: 0; }',
                '.thumb { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); }',
                '.thumb.placeholder { display: block; }',
                '.rowBody { flex: 1; min-width: 0; }',
                '.rowTitle { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
                '.rowMeta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: rgba(245,247,255,0.7); margin-top: 4px; }',
                '.statsInline { display: inline-flex; align-items: center; gap: 6px; }',
                '.dot { opacity: 0.4; }',
                '.rowAction { margin: 0; }',
                '.btn { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18); color: #F5F7FF; padding: 10px 12px; border-radius: 12px; font-weight: 600; cursor: pointer; }',
                '.btnSecondary { background: rgba(255,255,255,0.06); }',
                '.empty { color: rgba(245,247,255,0.7); margin: 0; padding: 8px; }',
                '</style>',
                '</head>',
                '<body>',
                '<main>',
                '<h1>Featured Curation</h1>',
                '<div class="panel">',
                '<h2>Runtime Defaults</h2>',
                '<form class="configForm" method="POST" action="' + adminPath + '">',
                `<input type="hidden" name="token" value="${escapeHtml(token)}" />`,
                '<input type="hidden" name="intent" value="config" />',
                '<div class="configField">',
                '<div class="configLabel">Daily create cap</div>',
                `<select class="configSelect" name="dailyCreateLimit">${configDailyOptions}</select>`,
                '</div>',
                '<div class="configField">',
                '<div class="configLabel">Default story duration</div>',
                `<select class="configSelect" name="defaultStoryDurationSec">${configDurationOptions}</select>`,
                '</div>',
                '<button class="btn" type="submit">Save</button>',
                '</form>',
                '<p class="configHint">Applies to signed-in app clients. Demo builds can override duration via EXPO_PUBLIC_TEST_STORY_DURATION_SEC.</p>',
                configUpdatedLabel ? `<p class="configHint">Last updated: ${escapeHtml(configUpdatedLabel)}</p>` : '',
                '</div>',
                '<div class="panel">',
                '<h2>Top Public (Not Featured)</h2>',
                candidatesHtml,
                '<h2>Featured</h2>',
                featuredHtml,
                '</div>',
                '</main>',
                '</body>',
                '</html>',
            ].join('\n')
        );
    }
);
