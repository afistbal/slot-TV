import { WebVTT } from 'videojs-vtt.js';

export type FeedSubtitleLoadResult =
    | { ok: true; cues: VTTCue[]; url: string }
    | { ok: false; url: string; error: string };

/** 拉取并解析 VTT（对齐 ForYouPlayer forYouPlayerLoadEpisode loadSubtitles） */
export async function loadFeedSubtitleCues(subtitleUrl: string): Promise<FeedSubtitleLoadResult> {
    const url = subtitleUrl.trim();
    if (!url) {
        return { ok: false, url: '', error: 'empty subtitle url' };
    }

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`subtitle HTTP ${res.status}`);
        }
        const text = await res.text();
        const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
        const cues: VTTCue[] = [];
        parser.oncue = (cue) => {
            cues.push(cue);
        };
        parser.parse(text);
        parser.flush();

        if (cues.length === 0) {
            console.warn('[douyin-feed-player] subtitle parsed with 0 cues', url);
        }

        return { ok: true, cues, url };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[douyin-feed-player] subtitle load failed', url, message);
        return { ok: false, url, error: message };
    }
}
