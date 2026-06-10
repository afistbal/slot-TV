/**
 * 抖音H5-iOS播放适配分析.md §7.3
 * 对标 player-9 _setPlayerSrc
 */
export function setNativeVideoSrc(
    video: HTMLVideoElement,
    url: string,
    opts: { autoplay?: boolean; muted?: boolean; startTime?: number },
) {
    video.removeAttribute('src');
    Array.from(video.querySelectorAll('source')).forEach((n) => n.remove());
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    if (opts.muted) video.muted = true;

    const onMeta = () => {
        if (opts.startTime != null) video.currentTime = opts.startTime;
        if (opts.autoplay) {
            video.play().catch(() => {
                video.muted = true;
                video.play().catch(() => undefined);
            });
        }
        video.removeEventListener('loadedmetadata', onMeta);
    };

    video.addEventListener('loadedmetadata', onMeta);

    video.src = url;
    video.load();

    // iOS：在手势链内同步 play，勿等 loadedmetadata（suspend 恢复时常已超时）
    if (opts.autoplay) {
        video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => undefined);
        });
    }
}
