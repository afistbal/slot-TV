function formatVttTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number, w: number) => String(n).padStart(w, '0');
    return `${pad(h, 2)}:${pad(m, 2)}:${s.toFixed(3).padStart(6, '0')}`;
}

/** snapToLines=false 时 line 为距顶百分比 */
export function linePercentFromBottomPx(video: HTMLVideoElement, bottomPx: number): number {
    const h = video.getBoundingClientRect().height || video.clientHeight || window.innerHeight;
    if (h <= bottomPx + 1) {
        return 85;
    }
    return Math.max(50, Math.min(96, ((h - bottomPx) / h) * 100));
}

/** WebVTT size 百分比：左右各留 horizontalInsetPx */
export function cueSizePercentFromHorizontalInset(
    video: HTMLVideoElement,
    horizontalInsetPx: number,
): number {
    const w = video.getBoundingClientRect().width || video.clientWidth || window.innerWidth;
    if (w <= horizontalInsetPx * 2 + 1) {
        return 90;
    }
    return Math.max(50, Math.min(100, ((w - horizontalInsetPx * 2) / w) * 100));
}

export function isPhonePortrait(): boolean {
    return window.innerHeight >= window.innerWidth;
}

const IOS_NATIVE_HORIZONTAL_INSET_PX = 16;

const IOS_NATIVE_CUE_STYLE = `STYLE
::cue {
  background: none;
  background-color: transparent;
  color: #ffffff;
  font-weight: 700;
  text-shadow: 2px 2px 4px #000, -2px -2px 4px #000;
}
`;

/** iOS 原生全屏：透明底 VTT + 按距底像素定位 */
export function buildIosNativeVttBlob(
    cues: VTTCue[],
    video: HTMLVideoElement,
    bottomPx: number,
): string {
    const line = linePercentFromBottomPx(video, bottomPx);
    const size = cueSizePercentFromHorizontalInset(video, IOS_NATIVE_HORIZONTAL_INSET_PX);
    const header = `WEBVTT

${IOS_NATIVE_CUE_STYLE}

`;
    const body = cues
        .map((cue) => {
            const text = cue.text.replace(/\r/g, '');
            return `${formatVttTimestamp(cue.startTime)} --> ${formatVttTimestamp(cue.endTime)} line:${line.toFixed(2)}% align:center position:50% size:${size.toFixed(2)}%
${text}`;
        })
        .join('\n\n');
    return URL.createObjectURL(new Blob([header + body], { type: 'text/vtt' }));
}

export type IosNativeSubtitleTrackHandle = {
    track: TextTrack | null;
    trackEl: HTMLTrackElement | null;
    blobUrl: string | null;
};

export function clearIosNativeSubtitleTrack(
    video: HTMLVideoElement,
    handle: IosNativeSubtitleTrackHandle,
): void {
    if (handle.trackEl) {
        handle.trackEl.remove();
        handle.trackEl = null;
    }
    if (handle.blobUrl) {
        URL.revokeObjectURL(handle.blobUrl);
        handle.blobUrl = null;
    }
    handle.track = null;
    for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden';
    }
}

export function mountIosNativeSubtitleTrack(
    video: HTMLVideoElement,
    sourceCues: VTTCue[],
    show: boolean,
): IosNativeSubtitleTrackHandle {
    const handle: IosNativeSubtitleTrackHandle = {
        track: null,
        trackEl: null,
        blobUrl: null,
    };

    if (sourceCues.length === 0) {
        return handle;
    }

    const bottomPx = isPhonePortrait() ? 150 : 36;
    handle.blobUrl = buildIosNativeVttBlob(sourceCues, video, bottomPx);
    handle.trackEl = document.createElement('track');
    handle.trackEl.kind = 'captions';
    handle.trackEl.src = handle.blobUrl;
    handle.trackEl.srclang = 'en';
    handle.trackEl.label = 'Subtitles';
    handle.trackEl.default = true;
    video.appendChild(handle.trackEl);
    handle.track = handle.trackEl.track;

    const activate = () => {
        if (!handle.track) {
            return;
        }
        handle.track.mode = show ? 'showing' : 'hidden';
    };
    handle.trackEl.addEventListener('load', activate, { once: true });
    window.setTimeout(activate, 0);

    return handle;
}
