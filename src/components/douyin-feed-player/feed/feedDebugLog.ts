/** DEV：console 单行日志 + STALL 环形缓冲 tail */

const ENABLED = import.meta.env.DEV;
const MAX_ENTRIES = 400;

type FeedDbgContext = {
    activeIndex: number;
    len: number;
};

const WARN_EVENTS = new Set([
    'play rejected',
    'play blocked until gesture',
    'buffer resume fail',
    'buffer pause low water',
    'ios chain bootstrap fail',
    'STALL active unexpected pause',
    'STALL active playing unattributed',
    'STALL post-neighbor paused',
]);

const entries: string[] = [];
let seq = 0;
let context: FeedDbgContext = { activeIndex: 0, len: 0 };

function compactValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function formatDetail(detail?: Record<string, unknown>): string {
    if (!detail) return '';
    const parts = Object.entries(detail).map(([k, v]) => `${k}=${compactValue(v)}`);
    return parts.length ? ` ${parts.join(' ')}` : '';
}

function pushEntry(event: string, detail?: Record<string, unknown>): void {
    const line = `${++seq} ${new Date().toISOString().slice(11, 23)} ${event}${formatDetail(detail)}`;
    entries.push(line);
    if (entries.length > MAX_ENTRIES) {
        entries.shift();
    }
}

function tailSummary(count = 10): string {
    return entries.slice(-count).join(' | ');
}

function logStall(event: string, detail?: Record<string, unknown>) {
    console.error('[douyin-feed] STALL', {
        event,
        active: context.activeIndex,
        len: context.len,
        ...detail,
        tail: tailSummary(10),
    });
}

export function setFeedDbgContext(patch: Partial<FeedDbgContext>) {
    context = { ...context, ...patch };
}

export function feedDbg(event: string, detail?: Record<string, unknown>) {
    if (!ENABLED) return;

    pushEntry(event, detail);

    const oneLine = `[douyin-feed] ${event}${formatDetail(detail)}`;

    if (WARN_EVENTS.has(event)) {
        logStall(event, detail);
        return;
    }

    console.log(oneLine);
}
