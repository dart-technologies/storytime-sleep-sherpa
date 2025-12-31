import { Response } from 'express';

/**
 * Valid duration options in seconds.
 * - 15 seconds is used for short "test stories" during development to save API credits.
 * - 60 seconds is a short production option (1 minute).
 * - 300/600 are the standard production durations (5 or 10 minutes).
 */
export const VALID_DURATIONS = [15, 60, 300, 600] as const;
export type ValidDuration = (typeof VALID_DURATIONS)[number];

/**
 * Required persona fields for story generation.
 */
export interface PersonaInput {
    name: string;
    voiceProfile?: string;
    specialty?: string;
}

/**
 * Validates persona object structure.
 */
export function validatePersona(persona: unknown): persona is PersonaInput {
    if (!persona || typeof persona !== 'object') {
        return false;
    }
    const p = persona as Record<string, unknown>;
    return typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 100;
}

/**
 * Validates duration is an allowed value.
 */
export function validateDuration(durationSec: unknown): durationSec is ValidDuration {
    return typeof durationSec === 'number' && VALID_DURATIONS.includes(durationSec as ValidDuration);
}

/**
 * Validates base64 image string.
 * - Must be a non-empty string
 * - Must be valid base64 format
 * - Size limit: 10MB decoded
 */
export function validateBase64Image(imageBase64: unknown): { valid: boolean; error?: string } {
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
        return { valid: false, error: 'imageBase64 must be a non-empty string' };
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Check for valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
        return { valid: false, error: 'Invalid base64 encoding' };
    }

    // Estimate decoded size (base64 is ~4/3 of original size)
    const estimatedBytes = (base64Data.length * 3) / 4;
    const maxBytes = 10 * 1024 * 1024; // 10MB

    if (estimatedBytes > maxBytes) {
        return { valid: false, error: 'Image exceeds 10MB size limit' };
    }

    return { valid: true };
}

/**
 * Validates conversation history array.
 */
export function validateConvoHistory(
    history: unknown
): { valid: boolean; sanitized: Array<{ role: string; content: string }> } {
    if (!Array.isArray(history)) {
        return { valid: true, sanitized: [] };
    }

    const sanitized = history
        .filter(
            (item): item is { role: string; content: string } =>
                item &&
                typeof item === 'object' &&
                typeof item.role === 'string' &&
                typeof item.content === 'string'
        )
        .slice(0, 50) // Limit history length
        .map((item) => ({
            role: item.role.slice(0, 20),
            content: item.content.slice(0, 2000), // Limit content length per message
        }));

    return { valid: true, sanitized };
}

/**
 * Sends a validation error response.
 */
export function sendValidationError(res: Response, field: string, message: string): void {
    res.status(400).json({
        error: 'Validation Error',
        detail: { field, message },
    });
}
