const CHUNK_RELOAD_STORAGE_KEY = 'slot:pwa-chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN_MS = 15 * 1000;
const CHUNK_RELOAD_QUERY_KEY = '_chunk_reload';

export function describeChunkLoadError(error: unknown): string {
    if (error instanceof Error) {
        return [error.name, error.message, error.stack].filter(Boolean).join('\n');
    }

    if (typeof error === 'string') return error;

    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

export function isChunkLoadError(error: unknown): boolean {
    const text = describeChunkLoadError(error);
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|script load failed|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(text);
}

export function reloadAfterChunkLoadError(error: unknown): boolean {
    if (!isChunkLoadError(error)) return false;

    const now = Date.now();
    let lastReload = 0;

    try {
        lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    } catch {
        lastReload = 0;
    }

    if (now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return false;

    try {
        window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    } catch {
        // Ignore storage failures; the reload is still the safest recovery.
    }

    /**
     * 普通 reload 可能继续命中旧 HTML；追加一次性查询参数，强制浏览器/CDN 获取最新应用壳。
     * 新页面启动后会立即从地址栏移除该参数。
     */
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(CHUNK_RELOAD_QUERY_KEY, String(now));
    window.location.replace(nextUrl.toString());
    return true;
}

export function installChunkLoadRecovery(): void {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(CHUNK_RELOAD_QUERY_KEY)) {
        currentUrl.searchParams.delete(CHUNK_RELOAD_QUERY_KEY);
        window.history.replaceState(window.history.state, '', currentUrl.toString());
    }

    window.addEventListener('unhandledrejection', (event) => {
        if (reloadAfterChunkLoadError(event.reason)) {
            event.preventDefault();
        }
    });

    window.addEventListener('error', (event) => {
        const target = event.target;
        if (target instanceof HTMLScriptElement && target.src.includes('/assets/')) {
            reloadAfterChunkLoadError(`script load failed: ${target.src}`);
            return;
        }

        reloadAfterChunkLoadError(event.error || event.message);
    }, true);
}
