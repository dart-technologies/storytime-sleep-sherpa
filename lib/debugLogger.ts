type LogMeta = Record<string, unknown> | string | number | boolean | null | undefined;

function trim(value: string | undefined): string {
    return (value || '').trim();
}

export type DebugLogMode = 'off' | 'latency' | 'verbose';

export function getDebugLogMode(): DebugLogMode {
    const value = trim(process.env.EXPO_PUBLIC_DEBUG).toLowerCase();

    if (value === 'off' || value === 'none') return 'off';
    if (value === 'latency' || value === 'steps' || value === 'step') return 'latency';
    if (value === 'verbose' || value === 'true' || value === '1' || value === 'on') return 'verbose';

    // Default behavior:
    // - Dev: enable logs, but keep them focused on latency.
    // - Prod: disable unless explicitly enabled above.
    return __DEV__ ? 'latency' : 'off';
}

export function isDebugLoggingEnabled(): boolean {
    return getDebugLogMode() !== 'off';
}

export function isVerboseDebugLoggingEnabled(): boolean {
    return getDebugLogMode() === 'verbose';
}

export function createRequestId(prefix = 'req'): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${ts}_${rand}`;
}

export type FlowLogger = {
    flowId: string;
    requestId: string;
    log: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    error: (message: string, meta?: LogMeta) => void;
    step: (name: string, meta?: LogMeta) => void;
    end: (meta?: LogMeta) => void;
};

export function createFlowLogger(flowName: string, options?: { requestId?: string; meta?: LogMeta }): FlowLogger {
    const mode = getDebugLogMode();
    const enabled = mode !== 'off';
    const startMs = Date.now();
    const requestId = options?.requestId || createRequestId(flowName.toLowerCase().replace(/\s+/g, ''));
    const flowId = `${flowName.toLowerCase().replace(/\s+/g, '-')}_${startMs.toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    const prefix = `[${flowName}]#${flowId}`;

    const write = (level: 'log' | 'warn' | 'error', message: string, meta?: LogMeta) => {
        if (!enabled) return;
        if (mode === 'latency') {
            const isLatencyLine = message.startsWith('STEP ') || message === 'END';
            if (!isLatencyLine && level !== 'error') return;
        }
        const elapsedMs = Date.now() - startMs;
        const nowIso = new Date().toISOString();
        const line = `[${nowIso}] ${prefix} +${elapsedMs}ms ${message}`;
        if (mode !== 'verbose' || meta === undefined) {
            // eslint-disable-next-line no-console
            console[level](line);
            return;
        }
        // eslint-disable-next-line no-console
        console[level](line, meta);
    };

    const logger: FlowLogger = {
        flowId,
        requestId,
        log: (message, meta) => write('log', message, meta),
        warn: (message, meta) => write('warn', message, meta),
        error: (message, meta) => write('error', message, meta),
        step: (name, meta) => write('log', `STEP ${name}`, meta),
        end: (meta) => write('log', 'END', meta),
    };

    if (mode === 'verbose') {
        logger.log('START', options?.meta);
    }
    return logger;
}
