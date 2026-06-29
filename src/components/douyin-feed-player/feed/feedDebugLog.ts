/** DEV：console 单行日志 + STALL 环形缓冲 tail */

export const FEED_DEBUG_LOG_ENABLED = false;

const MAX_ENTRIES = 400;

const TRACKED_EVENTS = new Set([
    'player init',
    'suppress next preload',
    'resume next preload',
    'sync',
    'dispatch',
    'dispatch skip holdPause',
    'schedule',
    'schedule skip holdPause',
    'pause',
    'play ok',
    'chain play ok',
    'chain mark',
    'chain consume',
    'chain NotAllowed → muted retry',
    'play blocked until gesture',
    'play rejected',
    'play retry',
    'play cancelled',
    'ended',
    'advance after ended',
    'ended stack neighbor',
    'ios ended defer until exit fs',
    'ios ended flush after exit fs',
    'ios chain muted bootstrap',
    'ios chain bootstrap fail',
    'ios chain retry',
    'ios chain neighbor recover',
    'ios chain neighbor recover scheduled',
    'ios chain recover immediate bounce',
    'ios chain recover delayed bounce',
    'chain unmute on playing',
    'ios chain unmuted bounce ok',
    'ios chain unmuted bounce fail',
    'slotChange ended-stack recover',
    'STALL active unexpected pause',
    'STALL post-neighbor paused',
    'touch',
    'navigate',
    'goToIndex',
    'user play tap',
    'dispatch mp4',
    'ended mp4',
    'schedule mp4',
    'pause mp4',
    'play ok mp4',
    'play blocked mp4',
    'play rejected mp4',
    'chain schedule mp4',
    'chain play ok mp4',
    'user play tap mp4',
]);

type FeedDbgContext = {
    activeIndex: number;
    len: number;
};

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

export function setFeedDbgContext(patch: Partial<FeedDbgContext>) {
    if (!FEED_DEBUG_LOG_ENABLED) return;
    context = { ...context, ...patch };
}

export function feedDbg(event: string, detail?: Record<string, unknown>) {
    if (!FEED_DEBUG_LOG_ENABLED) return;
    if (!TRACKED_EVENTS.has(event)) return;
    pushEntry(event, detail);
}

export function collectFeedDebugLog(): string {
    if (!FEED_DEBUG_LOG_ENABLED) return '# qd-feed-points disabled\n';

    const header = [
        `createdAt=${new Date().toISOString()}`,
        `context=${compactValue(context)}`,
    ];

    return [
        '# qd-feed-points',
        ...header,
        '',
        '# events',
        ...entries,
        '',
    ].join('\n');
}

export function downloadFeedDebugLog(): void {
    if (!FEED_DEBUG_LOG_ENABLED) return;

    const text = collectFeedDebugLog();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `douyin-feed-debug-${stamp}.txt`;

    void navigator.clipboard?.writeText(text).catch(() => undefined);

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
