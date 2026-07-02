import { WebVTT } from 'videojs-vtt.js';

export type FeedSubtitleLoadResult =
    | { ok: true; cues: VTTCue[]; url: string }
    | { ok: false; url: string; error: string };

const subtitleLoadCache = new Map<string, Promise<FeedSubtitleLoadResult>>();

export async function loadFeedSubtitleCues(subtitleUrl: string): Promise<FeedSubtitleLoadResult> {
    const url = subtitleUrl.trim();
    if (!url) {
        return { ok: false, url: '', error: 'empty subtitle url' };
    }

    if (shouldSkipDevCrossOriginSubtitle(url)) {
        return { ok: false, url, error: 'dev cross-origin subtitle skipped' };
    }

    const cached = subtitleLoadCache.get(url);
    if (cached) {
        return cached;
    }

    const promise = loadFeedSubtitleCuesUncached(url);
    subtitleLoadCache.set(url, promise);
    return promise;
}

function shouldSkipDevCrossOriginSubtitle(url: string): boolean {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
        return false;
    }
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
        return false;
    }
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}

async function loadFeedSubtitleCuesUncached(url: string): Promise<FeedSubtitleLoadResult> {
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

        if (cues.length === 0 && import.meta.env.DEV) {
            console.warn('[douyin-feed-player] subtitle parsed with 0 cues', url);
        }

        return { ok: true, cues, url };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, url, error: message };
    }
}
