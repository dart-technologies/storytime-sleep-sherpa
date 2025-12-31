export function formatDurationLabel(durationSec: number | undefined): string | null {
    if (typeof durationSec !== 'number') return null;
    if (!Number.isFinite(durationSec)) return null;
    if (durationSec <= 0) return null;

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

export function formatDateLabel(timestampMs: number | undefined): string | null {
    if (typeof timestampMs !== 'number') return null;
    if (!Number.isFinite(timestampMs)) return null;
    try {
        const date = new Date(timestampMs);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return null;
    }
}

export function formatCountLabel(count: number | undefined): string {
    if (typeof count !== 'number') return '0';
    if (!Number.isFinite(count)) return '0';
    const normalized = Math.max(0, Math.floor(count));
    if (normalized < 1000) return String(normalized);

    try {
        return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(normalized);
    } catch {
        return normalized.toLocaleString();
    }
}

export function formatCreatorAttribution(displayName: string | undefined | null): string | null {
    const trimmed = String(displayName || '').trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (!parts.length) return null;

    const firstName = parts[0] || '';
    if (!firstName) return null;

    const lastPart = parts.length > 1 ? (parts[parts.length - 1] || '') : '';
    const lastInitial = lastPart ? lastPart.trim().replace(/[^A-Za-z]/g, '')[0] : '';
    if (!lastInitial) return firstName;

    return `${firstName} ${lastInitial.toUpperCase()}`;
}

export function formatBytes(bytes: number | undefined): string {
    const value = typeof bytes === 'number' && Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
    if (value < 1024) return `${value} B`;
    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
}
