import { clearNativeVideoHls, setNativeVideoSrc } from './setNativeVideoSrc';

/**
 * 抖音H5-iOS播放适配分析.md — cancelLoading / _removeVideoSource
 * 暂停并移除 video src，取消进行中的 native 拉流
 */
export function suspendNativeVideo(video: HTMLVideoElement): void {
    clearNativeVideoHls(video);
    video.pause();
    video.removeAttribute('src');
    Array.from(video.querySelectorAll('source')).forEach((n) => n.remove());
    video.load();
}

export function resumeNativeVideo(
    video: HTMLVideoElement,
    url: string,
    opts: { autoplay?: boolean; muted?: boolean; startTime?: number } = {},
): void {
    setNativeVideoSrc(video, url, opts);
}
