import Hls from 'hls.js';

const hlsByVideo = new WeakMap<HTMLVideoElement, Hls>();

function isHlsUrl(url: string): boolean {
    return /\.m3u8(?:[?#]|$)/i.test(url);
}

function playVideo(video: HTMLVideoElement) {
    video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => undefined);
    });
}

export function clearNativeVideoHls(video: HTMLVideoElement): void {
    const hls = hlsByVideo.get(video);
    if (!hls) return;
    hls.destroy();
    hlsByVideo.delete(video);
}

/**
 * 抖音H5-iOS播放适配分析.md §7.3
 * 对标 player-9 _setPlayerSrc
 */
export function setNativeVideoSrc(
    video: HTMLVideoElement,
    url: string,
    opts: { autoplay?: boolean; muted?: boolean; startTime?: number },
) {
    clearNativeVideoHls(video);
    video.removeAttribute('src');
    Array.from(video.querySelectorAll('source')).forEach((n) => n.remove());
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    if (opts.muted) video.muted = true;

    const onMeta = () => {
        if (opts.startTime != null) video.currentTime = opts.startTime;
        if (opts.autoplay) playVideo(video);
        video.removeEventListener('loadedmetadata', onMeta);
    };

    video.addEventListener('loadedmetadata', onMeta);

    if (isHlsUrl(url) && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
        });
        hlsByVideo.set(video, hls);
        if (opts.autoplay) {
            hls.once(Hls.Events.MANIFEST_PARSED, () => playVideo(video));
        }
        hls.loadSource(url);
        hls.attachMedia(video);
    } else {
        video.src = url;
        video.load();
    }

    // iOS: 同步 play，不等 loadedmetadata，避免手势链超时。
    if (opts.autoplay && !hlsByVideo.has(video)) {
        playVideo(video);
    }
}
