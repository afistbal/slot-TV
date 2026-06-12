import { useCallback, useState } from 'react';

import { dumpFeedDbgLog, exportFeedDbgLog } from './feedDebugLog';

/** DEV：下载环形缓冲日志 txt */
export function FeedLogExportChip() {
    const [hint, setHint] = useState<string | null>(null);

    const onExport = useCallback(() => {
        const count = dumpFeedDbgLog().split('\n').length - 1;
        const mode = exportFeedDbgLog();
        setHint(mode === 'download' ? `已下载 ${count} 条` : '下载失败');
        window.setTimeout(() => setHint(null), 2500);
    }, []);

    if (!import.meta.env.DEV) {
        return null;
    }

    return (
        <button
            type="button"
            className="douyin-feed-log-chip"
            onClick={onExport}
            aria-label="下载播放调试日志"
        >
            {hint ?? '日志'}
        </button>
    );
}
