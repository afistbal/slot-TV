/**
 * 对标抖音 Feed playerWrap + ForYouPlayer：
 * - routes-route.ceffa524.js L4827：`isVertical = video.height > video.width`
 * - ForYouPlayer：`videoWidth > videoHeight` → landscape → object-contain，否则 cover
 */
import type Player from 'xgplayer';

import { readVideoOrientation } from '@/pages/user/VideoPage/videoOrientation';

/** 控制台 filter `[douyin-aspect]`；仅当前 active 条打一条 */
const ASPECT_DEBUG = true;

export type AspectFitLogContext = {
    slotIndex: number;
    isActive: () => boolean;
};

function aspectDbg(message: string, detail: Record<string, unknown>) {
    if (!ASPECT_DEBUG) return;
    console.log(`[douyin-aspect] ${message}`, detail);
}

/** 当前滑到的 active 条：metadata 就绪后打一条 */
export function logActiveSlideAspect(
    video: HTMLVideoElement,
    slotEl: HTMLElement | null,
    slotIndex: number,
    player?: Player,
): void {
    if (!ASPECT_DEBUG) return;

    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;

    const orientation = readVideoOrientation(video);
    const xgRoot = video.closest('.xgplayer') as HTMLElement | null;
    const rect = slotEl?.getBoundingClientRect();

    aspectDbg(`active #${slotIndex}`, {
        videoWidth,
        videoHeight,
        orientation,
        objectFit: getComputedStyle(video).objectFit,
        slot: rect ? `${Math.round(rect.width)}×${Math.round(rect.height)}` : null,
        xgFill: xgRoot?.getAttribute('data-xgfill'),
        mode: player ? 'xgplayer' : 'native',
        srcTail: video.currentSrc ? video.currentSrc.slice(-48) : '',
    });
}

export function isVerticalVideo(videoWidth: number, videoHeight: number): boolean {
    if (videoWidth > videoHeight) return false;
    if (videoWidth < videoHeight) return true;
    return false;
}

export function isLandscapeVideo(video: HTMLVideoElement): boolean {
    return readVideoOrientation(video) === 'landscape';
}

/** 对标抖音 baseWidth / baseHeight 判定 */
export function shouldUseBaseHeight(
    containerWidth: number,
    containerHeight: number,
    videoWidth: number,
    videoHeight: number,
): boolean {
    if (!containerWidth || !containerHeight || !videoWidth || !videoHeight) {
        return false;
    }
    const videoAspect = videoWidth / videoHeight;
    return containerWidth / videoAspect >= containerHeight;
}

export function applyVideoObjectFit(video: HTMLVideoElement): boolean {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return false;

    const landscape = isLandscapeVideo(video);
    video.style.objectFit = landscape ? 'contain' : 'cover';
    video.style.objectPosition = 'center center';
    return !landscape;
}

/** xgplayer resize() 会写 root 内联 width（横屏 fixHeight 路径 ≈1180px），盖过 CSS；Feed 用 object-fit 即可 */
function normalizeXgplayerRootLayout(player: Player, video: HTMLVideoElement): void {
    const root = (player as Player & { root?: HTMLElement }).root;
    if (!root) return;

    const landscape = isLandscapeVideo(video);
    const fill = landscape ? 'contain' : 'cover';

    root.style.width = '100%';
    root.style.height = '100%';
    root.style.paddingTop = '0';
    root.setAttribute('data-xgfill', fill);
    video.style.objectFit = fill;
    video.style.objectPosition = 'center center';
}

export function syncSlotAspectClasses(
    slotEl: HTMLElement | null,
    video: HTMLVideoElement,
): void {
    if (!slotEl) return;

    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;

    const vertical = isVerticalVideo(videoWidth, videoHeight);
    const rect = slotEl.getBoundingClientRect();
    const baseHeight = shouldUseBaseHeight(rect.width, rect.height, videoWidth, videoHeight);

    slotEl.classList.toggle('douyin-player-slot--vertical', vertical);
    slotEl.classList.toggle('douyin-player-slot--horizontal', !vertical);
    slotEl.classList.toggle('douyin-player-slot--base-height', baseHeight);
    slotEl.classList.toggle('douyin-player-slot--base-width', !baseHeight);
}

export function syncPlayerAspectFit(player: Player, slotEl: HTMLElement | null): void {
    const video = player.video as HTMLVideoElement | undefined;
    if (!video) return;

    const landscape = isLandscapeVideo(video);

    applyVideoObjectFit(video);
    syncSlotAspectClasses(slotEl, video);

    if (!landscape) {
        try {
            (player as Player & { resize?: () => void }).resize?.();
        } catch {
            /* ignore resize before layout */
        }
    }

    normalizeXgplayerRootLayout(player, video);
}

export function attachVideoAspectFit(
    player: Player,
    slotEl: HTMLElement | null,
): () => void {
    const sync = () => syncPlayerAspectFit(player, slotEl);

    const onLoadedMetadata = () => sync();
    const onResize = () => sync();

    player.on('loadedmetadata', onLoadedMetadata);

    const ro =
        typeof ResizeObserver !== 'undefined' && slotEl
            ? new ResizeObserver(onResize)
            : null;
    if (ro && slotEl) ro.observe(slotEl);

    sync();

    return () => {
        player.off('loadedmetadata', onLoadedMetadata);
        ro?.disconnect();
    };
}

export function attachNativeVideoAspectFit(
    video: HTMLVideoElement,
    slotEl: HTMLElement | null,
): () => void {
    const sync = () => {
        applyVideoObjectFit(video);
        syncSlotAspectClasses(slotEl, video);
    };

    const onLoadedMetadata = () => sync();
    const onResize = () => sync();

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    sync();

    const ro =
        typeof ResizeObserver !== 'undefined' && slotEl
            ? new ResizeObserver(onResize)
            : null;
    if (ro && slotEl) ro.observe(slotEl);

    return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        ro?.disconnect();
    };
}

/** 切到 active 条时打一条（metadata 未就绪则等 loadedmetadata） */
export function logAspectWhenActive(
    player: Player | null,
    slotEl: HTMLElement | null,
    ctx: AspectFitLogContext,
): () => void {
    if (!ctx.isActive() || !player) return () => undefined;

    const tryLog = () => {
        if (!ctx.isActive()) return;
        const video = player.video as HTMLVideoElement | undefined;
        if (!video?.videoWidth) return;
        syncPlayerAspectFit(player, slotEl);
        logActiveSlideAspect(video, slotEl, ctx.slotIndex, player);
    };

    tryLog();

    const video = player.video as HTMLVideoElement | undefined;
    if (video && !video.videoWidth) {
        const onMeta = () => {
            tryLog();
            video.removeEventListener('loadedmetadata', onMeta);
        };
        video.addEventListener('loadedmetadata', onMeta);
        return () => video.removeEventListener('loadedmetadata', onMeta);
    }

    return () => undefined;
}

export function logNativeAspectWhenActive(
    video: HTMLVideoElement | null | undefined,
    slotEl: HTMLElement | null,
    ctx: AspectFitLogContext,
): () => void {
    if (!ctx.isActive() || !video) return () => undefined;

    const tryLog = () => {
        if (!ctx.isActive()) return;
        if (!video.videoWidth) return;
        applyVideoObjectFit(video);
        syncSlotAspectClasses(slotEl, video);
        logActiveSlideAspect(video, slotEl, ctx.slotIndex);
    };

    tryLog();

    if (!video.videoWidth) {
        const onMeta = () => {
            tryLog();
            video.removeEventListener('loadedmetadata', onMeta);
        };
        video.addEventListener('loadedmetadata', onMeta);
        return () => video.removeEventListener('loadedmetadata', onMeta);
    }

    return () => undefined;
}
