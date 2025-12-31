import type { Row } from 'tinybase';
import type { StoryGeneration } from '../../lib/models/story';

export function omitUndefined<T extends Record<string, any>>(value: T): T {
    const result: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
        const current = value[key];
        if (current === undefined) return;
        result[key] = current;
    });
    return result as T;
}

export function sanitizeFirestoreValue(value: unknown): unknown {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) {
        const sanitized = value
            .map((item) => sanitizeFirestoreValue(item))
            .filter((item) => item !== undefined);
        return sanitized;
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        Object.keys(obj).forEach((key) => {
            const sanitized = sanitizeFirestoreValue(obj[key]);
            if (sanitized === undefined) return;
            result[key] = sanitized;
        });
        return result;
    }
    return undefined;
}

export function sanitizeForTinyBaseRow(data: Record<string, any>): Row {
    const sanitized: Row = {};
    Object.keys(data).forEach((key) => {
        const value = data[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
            return;
        }
        if (value === null || value === undefined) return;
        try {
            sanitized[key] = JSON.stringify(value);
        } catch {
            // ignore non-serializable values
        }
    });
    return sanitized;
}

function parseJsonIfString<T>(value: unknown): T | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return undefined;
    }
}

export function normalizeStoryGeneration(value: unknown): StoryGeneration | undefined {
    if (!value) return undefined;
    if (typeof value === 'object') return value as StoryGeneration;
    const parsed = parseJsonIfString<StoryGeneration>(value);
    return parsed;
}

