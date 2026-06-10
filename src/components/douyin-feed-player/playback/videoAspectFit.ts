/**
 * 对标抖音 Feed playerWrap + ForYouPlayer：
 * - routes-route.ceffa524.js L4827：`isVertical = video.height > video.width`
 * - ForYouPlayer：`videoWidth > videoHeight` → landscape → object-contain，否则 cover
 */
import type Player from 'xgplayer';

import { readVideoOrientation } from '@/pages/user/VideoPage/videoOrientation';

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

    if (applyVideoObjectFit(video)) {
        /* vertical */
    }
    syncSlotAspectClasses(slotEl, video);

    try {
        (player as Player & { resize?: () => void }).resize?.();
    } catch {
        /* ignore resize before layout */
    }
}

export function attachVideoAspectFit(player: Player, slotEl: HTMLElement | null): () => void {
    const sync = () => syncPlayerAspectFit(player, slotEl);

    player.on('loadedmetadata', sync);
    player.on('canplay', sync);

    const video = player.video as HTMLVideoElement | undefined;
    video?.addEventListener('loadedmetadata', sync);

    const ro =
        typeof ResizeObserver !== 'undefined' && slotEl
            ? new ResizeObserver(() => sync())
            : null;
    if (ro && slotEl) ro.observe(slotEl);

    sync();

    return () => {
        player.off('loadedmetadata', sync);
        player.off('canplay', sync);
        video?.removeEventListener('loadedmetadata', sync);
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

    video.addEventListener('loadedmetadata', sync);
    sync();

    const ro =
        typeof ResizeObserver !== 'undefined' && slotEl
            ? new ResizeObserver(() => sync())
            : null;
    if (ro && slotEl) ro.observe(slotEl);

    return () => {
        video.removeEventListener('loadedmetadata', sync);
        ro?.disconnect();
    };
}
