/** 诊断日志（默认关闭）；排查 iOS 播放时改为 `ENABLED = true` 并挂载 FeedDebugPanel */
const ENABLED = false;

export function feedDbg(_event: string, _detail?: Record<string, unknown>) {
    if (!ENABLED) return;
}
