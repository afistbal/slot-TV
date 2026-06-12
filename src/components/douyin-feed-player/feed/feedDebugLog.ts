/** DEV：环形缓冲 + 单行日志；全量导出点页面「日志」或 __douyinFeedLogCopy() */

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

export function dumpFeedDbgLog(): string {
    const firstSeq = entries.length ? Number(entries[0]?.split(' ')[0]) : 0;
    const truncated = firstSeq > 1;
    const header = `# douyin-feed log active=${context.activeIndex} len=${context.len} count=${entries.length} seq=${firstSeq}-${seq}${truncated ? ' truncated=early' : ''}`;
    return [header, ...entries].join('\n');
}

function feedLogFilename(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `douyin-feed-log-${stamp}.txt`;
}

export function downloadFeedDbgLog(): boolean {
    const text = dumpFeedDbgLog();
    try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = feedLogFilename();
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch {
        return false;
    }
}

export async function copyFeedDbgLog(): Promise<boolean> {
    const text = dumpFeedDbgLog();
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* fallback */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

export type FeedDbgExportMode = 'download' | 'fail';

/** 统一下载 txt（移动端剪贴板不可靠） */
export function exportFeedDbgLog(): FeedDbgExportMode {
    return downloadFeedDbgLog() ? 'download' : 'fail';
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

declare global {
    interface Window {
        __douyinFeedLogDump?: () => string;
        __douyinFeedLogCopy?: () => Promise<boolean>;
        __douyinFeedLogDownload?: () => boolean;
        __douyinFeedLogExport?: () => FeedDbgExportMode;
    }
}

if (ENABLED && typeof window !== 'undefined') {
    window.__douyinFeedLogDump = dumpFeedDbgLog;
    window.__douyinFeedLogCopy = copyFeedDbgLog;
    window.__douyinFeedLogDownload = downloadFeedDbgLog;
    window.__douyinFeedLogExport = exportFeedDbgLog;
    console.log('[douyin-feed] 日志缓冲已开；点左下角「日志」下载 txt');
}
