type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };
let cleanup: (() => void) | undefined;

/** Only landscape videos on touch devices need an orientation lock. */
export async function lockVideoFullscreenOrientation(video: HTMLVideoElement): Promise<void> {
    if (!window.matchMedia('(pointer: coarse)').matches || video.videoWidth <= video.videoHeight || !video.videoWidth) return;
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) return;
    releaseVideoFullscreenOrientation();
    let active = true;
    const onExit = () => {
        const doc = document as Document & { webkitFullscreenElement?: Element | null };
        if (!document.fullscreenElement && !doc.webkitFullscreenElement) releaseVideoFullscreenOrientation();
    };
    cleanup = () => {
        active = false;
        document.removeEventListener('fullscreenchange', onExit);
        document.removeEventListener('webkitfullscreenchange', onExit);
        window.removeEventListener('pagehide', releaseVideoFullscreenOrientation);
        orientation.unlock?.();
    };
    document.addEventListener('fullscreenchange', onExit);
    document.addEventListener('webkitfullscreenchange', onExit);
    window.addEventListener('pagehide', releaseVideoFullscreenOrientation);
    try {
        await orientation.lock('landscape');
        // A fast Back press may arrive while lock() is still pending.
        if (!active) orientation.unlock?.();
    } catch {
        if (active) releaseVideoFullscreenOrientation();
    }
}

export function releaseVideoFullscreenOrientation(): void {
    const release = cleanup;
    cleanup = undefined;
    try { release?.(); } catch { /* Unsupported unlock must not block fullscreen exit. */ }
}
