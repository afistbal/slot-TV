const APP_RECOVERY_QUERY_KEY = '_app_recovery';
const APP_REPAIR_QUERY_KEY = '_app_repair';
const RECOVERY_STORAGE_PREFIX = 'slot:pwa-boot-recovery:';
const RECOVERY_ATTEMPT_TTL_MS = 5 * 60 * 1000;

interface BootRecoveryController {
    isReady: () => boolean;
    ready: () => void;
    recover: (reason?: unknown) => boolean;
    repair: () => Promise<void>;
    showFailure: (reason?: unknown) => void;
}

declare global {
    interface Window {
        __YOGO_BOOT_RECOVERY__?: BootRecoveryController;
    }
}

let recoveryInProgress = false;
let listenersInstalled = false;
let applicationReady = false;

function isApplicationReady(): boolean {
    return window.__YOGO_BOOT_RECOVERY__?.isReady() ?? applicationReady;
}

function appVersion(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content.trim() || __APP_VERSION__ || 'unknown';
}

function recoveryStorageKey(version = appVersion()): string {
    return `${RECOVERY_STORAGE_PREFIX}${version}`;
}

function wasRecoveryAttemptedRecently(version: string): boolean {
    try {
        const attemptedAt = Number(window.sessionStorage.getItem(recoveryStorageKey(version)) || 0);
        return Date.now() - attemptedAt < RECOVERY_ATTEMPT_TTL_MS;
    } catch {
        return false;
    }
}

function markRecoveryAttempt(version: string): void {
    try {
        window.sessionStorage.setItem(recoveryStorageKey(version), String(Date.now()));
    } catch {
        // The URL marker is the fallback when sessionStorage is unavailable.
    }
}

function updateServiceWorkerBriefly(): Promise<unknown> {
    if (!('serviceWorker' in navigator)) return Promise.resolve();

    return Promise.race([
        navigator.serviceWorker.getRegistration('/').then((registration) => {
            if (!registration) return undefined;
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            return registration.update().catch(() => undefined);
        }).catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
    ]);
}

function replaceWithRecoveryUrl(version: string): void {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(APP_RECOVERY_QUERY_KEY, version);
    window.location.replace(nextUrl.toString());
}

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
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|script load failed|stylesheet load failed|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS|dynamically imported module/i.test(text);
}

/**
 * Start one automatic recovery for the current HTML version. The inline
 * controller in index.html is preferred because it also exists when the entry
 * bundle itself cannot load; this fallback keeps non-index entry points safe.
 */
export function reloadAfterChunkLoadError(error: unknown): boolean {
    if (!isChunkLoadError(error)) return false;

    const bootRecovery = window.__YOGO_BOOT_RECOVERY__;
    if (bootRecovery) {
        return bootRecovery.recover(error);
    }

    if (recoveryInProgress || !navigator.onLine) return false;

    const version = appVersion();
    const currentUrl = new URL(window.location.href);
    const attemptedByUrl = currentUrl.searchParams.get(APP_RECOVERY_QUERY_KEY) === version;
    if (attemptedByUrl || wasRecoveryAttemptedRecently(version)) return false;

    recoveryInProgress = true;
    markRecoveryAttempt(version);
    void updateServiceWorkerBriefly().finally(() => replaceWithRecoveryUrl(version));
    return true;
}

/** Mark React as mounted and clear recovery markers only after a healthy boot. */
export function markAppBootReady(): void {
    applicationReady = true;
    const bootRecovery = window.__YOGO_BOOT_RECOVERY__;
    if (bootRecovery) {
        bootRecovery.ready();
        return;
    }

    try {
        window.sessionStorage.removeItem(recoveryStorageKey());
    } catch {
        // Ignore storage failures.
    }

    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has(APP_RECOVERY_QUERY_KEY) && !currentUrl.searchParams.has(APP_REPAIR_QUERY_KEY)) {
        return;
    }
    currentUrl.searchParams.delete(APP_RECOVERY_QUERY_KEY);
    currentUrl.searchParams.delete(APP_REPAIR_QUERY_KEY);
    window.history.replaceState(window.history.state, '', currentUrl.toString());
}

/**
 * User-initiated last resort. It only removes this origin's root worker and
 * Workbox precache; login data, localStorage and IndexedDB remain untouched.
 */
export async function repairPwaAndReload(): Promise<void> {
    const bootRecovery = window.__YOGO_BOOT_RECOVERY__;
    if (bootRecovery) {
        await bootRecovery.repair();
        return;
    }

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration('/');
            await registration?.unregister();
        }
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('workbox-precache'))
                    .map((name) => caches.delete(name)),
            );
        }
    } catch {
        // Best effort: the cache-busting navigation can still recover the app.
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(APP_RECOVERY_QUERY_KEY, appVersion());
    nextUrl.searchParams.set(APP_REPAIR_QUERY_KEY, String(Date.now()));
    window.location.replace(nextUrl.toString());
}

export function installChunkLoadRecovery(): void {
    if (listenersInstalled) return;
    listenersInstalled = true;

    window.addEventListener('vite:preloadError', ((event: Event) => {
        const preloadEvent = event as Event & { payload?: unknown };
        // Background route prefetches deliberately catch their own failures.
        // Before React mounts, however, a preload error means the app cannot boot.
        if (isApplicationReady()) return;
        if (reloadAfterChunkLoadError(preloadEvent.payload)) {
            event.preventDefault();
        }
    }) as EventListener);

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

        if (target instanceof HTMLLinkElement && target.href.includes('/assets/')) {
            const isBootAsset = (target.rel === 'stylesheet' || target.rel === 'modulepreload') &&
                !isApplicationReady();
            if (isBootAsset) {
                reloadAfterChunkLoadError(`${target.rel === 'stylesheet' ? 'stylesheet' : 'script'} load failed: ${target.href}`);
                return;
            }
        }

        reloadAfterChunkLoadError(event.error || event.message);
    }, true);
}
