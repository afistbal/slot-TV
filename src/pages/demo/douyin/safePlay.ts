/** 切条卸载 video 时 play() 常被 AbortError 打断，属正常情况 */
export function safePlay(video: HTMLVideoElement): void {
    const p = video.play();
    if (p !== undefined) {
        void p.catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
                return;
            }
        });
    }
}
