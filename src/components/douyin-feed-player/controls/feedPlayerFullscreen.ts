export const IMMERSIVE_FULLSCREEN_CLASS = 'video-fullscreen-target--immersive';
export const IMMERSIVE_FULLSCREEN_EVENT = 'douyin-feed-immersive-change';

export function getFullscreenElement(): Element | null {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isIosNativeVideoFullscreen(video: HTMLVideoElement | null | undefined): boolean {
    if (!video) return false;
    const v = video as HTMLVideoElement & {
        webkitDisplayingFullscreen?: boolean;
        webkitPresentationMode?: string;
    };
    return v.webkitDisplayingFullscreen === true || v.webkitPresentationMode === 'fullscreen';
}
