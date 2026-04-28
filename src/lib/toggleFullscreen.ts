import type { RefObject } from "react";

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitEnterFullScreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitPresentationMode?: "inline" | "fullscreen" | "picture-in-picture";
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenContainerElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * 跨平台切换视频全屏（iOS Safari / Android Chrome / 桌面浏览器）。
 * - iOS: 优先走 video.webkitEnterFullscreen（系统播放器，无法完全控制菜单）
 * - 其它: 优先 video.requestFullscreen，贴近原生全屏体验
 * - 退出: document.exitFullscreen + webkit 兜底
 */
export async function toggleVideoFullscreen(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef?: RefObject<HTMLElement | null>,
  options?: { preferContainer?: boolean },
) {
  const wrap = containerRef?.current ?? null;
  const video = videoRef.current as FullscreenVideoElement | null;
  if (!video) return;
  const preferContainer = options?.preferContainer === true;

  const doc = document as FullscreenDocument;
  const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  const iosVideoFullscreen =
    video.webkitDisplayingFullscreen === true || video.webkitPresentationMode === "fullscreen";

  if (fsEl || iosVideoFullscreen) {
    await document.exitFullscreen().catch(() => {});
    if (video.webkitExitFullscreen) {
      try {
        video.webkitExitFullscreen();
      } catch {
        // ignore
      }
    }
    if (doc.webkitExitFullscreen) {
      await Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
    }
    return;
  }

  const el = (wrap ?? video.parentElement) as FullscreenContainerElement | null;
  if (preferContainer) {
    if (el?.requestFullscreen) {
      const ok = await el
        .requestFullscreen()
        .then(() => true)
        .catch(() => false);
      if (ok) {
        return;
      }
    }
    if (el?.webkitRequestFullscreen) {
      const ok = await Promise.resolve(el.webkitRequestFullscreen())
        .then(() => true)
        .catch(() => false);
      if (ok) {
        return;
      }
    }
  }

  if (video.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
    } catch {
      // ignore
    }
    return;
  }
  if (video.webkitEnterFullScreen) {
    try {
      video.webkitEnterFullScreen();
    } catch {
      // ignore
    }
    return;
  }

  if (video.requestFullscreen) {
    await video.requestFullscreen().catch(() => {});
    return;
  }

  if (el?.requestFullscreen) {
    await el.requestFullscreen().catch(() => {});
    return;
  }
  if (el?.webkitRequestFullscreen) {
    await Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
  }
}
