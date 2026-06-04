import { WebVTT } from 'videojs-vtt.js';
import type { RefObject } from 'react';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { fetchEpisodeDetailOrNull, type EpisodeFetchOpts } from '@/pages/user/VideoPage/episodeDetailCache';
import { resolveEpisodePlaybackUrls } from '@/pages/user/VideoPage/videoPlayerPlaybackUrls';
import { SPEED } from '@/pages/user/VideoPage/videoPlayerConstants';
import {
    applyForyouResumeSeek,
    canForyouWarmStart,
    kickForyouAutoplay,
} from '@/pages/user/ForYouPage/foryouPlaybackKick';
import {
    ensureForyouIosVideoLoad,
    isForyouIosPlayback,
    kickForyouIosAutoplay,
} from '@/pages/user/ForYouPage/foryouIosPlayback';
import {
    primeForyouNeighborBuffer,
    resyncForyouVideoSources,
} from '@/pages/user/ForYouPage/foryouFeedMedia';

export type LoadEpisodeRuntime = {
    videoRef: RefObject<HTMLVideoElement | null>;
    subtitlesRef: RefObject<VTTCue[]>;
    autoplayKickTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
    getStaticBase: () => string;
    speed: number;
    fromHomeVideoPlayback: boolean;
    legacyEpisodeAutoplayRef: RefObject<boolean>;
    /** ????????????????????UI??????????????? */
    suppressPlayback?: boolean;
    setLoading: (v: boolean) => void;
    setEpisode: (d: IPlayerEpisode) => void;
    setPlaybackSources: (urls: string[]) => void;
    setShowTapToUnmute: (v: boolean) => void;
    setWaiting: (v: boolean) => void;
    setPlaying: (v: boolean) => void;
    setCanPlay: (v: boolean) => void;
    showController: (autoClose?: boolean) => void;
    hideController: () => void;
    controllerTimerRef: RefObject<number>;
    /** ??? `fetchEpisodeDetailOrNull`???????`movie/episode` ???`auto_unlock` */
    episodeFetchOpts?: EpisodeFetchOpts;
    isForYouFeed?: boolean;
    onVideoMutedUiSync?: (muted: boolean) => void;
    /** For You ??????????????? */
    resumeTimeSec?: number;
    /** 返回 true 时不再改 video / 起播（快速切条或卸载） */
    shouldAbort?: () => boolean;
    /** For You 整页 F5 后首条冷启动（仅首条 true；滑切后为 false，勿用 navigation.reload 判滑切） */
    isFeedColdAutoplay?: boolean;
    /** 邻格 paused + preload=auto 时，挂源后主动多拉几秒媒体 */
    primeNeighborBuffer?: boolean;
};

export async function runLoadEpisodeForForYouPlayer(
    rt: LoadEpisodeRuntime,
    id: number,
    loading: boolean,
): Promise<void> {
    /** ???? / ?????????????????????????????????????????????????????????????????????????????????? closure ????? hide */
    window.clearTimeout(rt.controllerTimerRef.current);

    const applyEpisode = async (d: IPlayerEpisode) => {
        if (rt.shouldAbort?.()) {
            return;
        }
        window.clearTimeout(rt.controllerTimerRef.current);
        rt.setLoading(false);
        rt.setEpisode(d);
        rt.setShowTapToUnmute(false);

        /** ????????????VIP ???????????????????????????????????????????? play?????????????????????????????????? */
        if (d.lock === true) {
            rt.setPlaybackSources([]);
            rt.subtitlesRef.current = [];
            if (rt.autoplayKickTimerRef.current) {
                clearTimeout(rt.autoplayKickTimerRef.current);
                rt.autoplayKickTimerRef.current = null;
            }
            await Promise.resolve();
            const el = rt.videoRef.current;
            if (el) {
                el.pause();
                try {
                    el.load();
                } catch {
                    // ignore
                }
            }
            rt.setWaiting(false);
            rt.setPlaying(false);
            rt.setCanPlay(false);
            rt.setShowTapToUnmute(false);
            /** ???????????`showController(true)` ??? 10s ?????????????? React ??????? lock??`hideController` ???????? `episode.lock` ?????????? UI ?????????*/
            rt.showController(false);
            return;
        }

        const urls = resolveEpisodePlaybackUrls(d, rt.getStaticBase());
        rt.setPlaybackSources(urls);

        if (urls.length === 0) {
            rt.setWaiting(false);
            return;
        }

        const loadSubtitles = async () => {
            const subtitleStr = d.subtitle != null ? String(d.subtitle) : '';
            if (!subtitleStr) {
                rt.subtitlesRef.current = [];
                return;
            }
            const subUrl =
                subtitleStr.startsWith('http://') || subtitleStr.startsWith('https://')
                    ? subtitleStr
                    : `${rt.getStaticBase()}/${subtitleStr}`;
            try {
                const res = await fetch(subUrl);
                if (!res.ok) {
                    throw new Error(`subtitle HTTP ${res.status}`);
                }
                const text = await res.text();
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues: VTTCue[] = [];
                parser.oncue = (cue) => {
                    cues.push(cue);
                };
                parser.onflush = () => {
                    rt.subtitlesRef.current = cues;
                };
                parser.parse(text);
                parser.flush();
            } catch (e) {
                rt.subtitlesRef.current = [];
                console.warn('[Video] subtitle load skipped (CORS/network/parse)', subUrl, e);
            }
        };

        if (rt.isForYouFeed) {
            rt.subtitlesRef.current = [];
            void loadSubtitles();
        } else {
            await loadSubtitles();
        }

        await Promise.resolve();

        if (rt.shouldAbort?.()) {
            return;
        }

        if (rt.isForYouFeed && urls.length > 0) {
            for (let i = 0; i < 6; i += 1) {
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });
                if (rt.shouldAbort?.()) {
                    return;
                }
                const el = rt.videoRef.current;
                if (!el) {
                    continue;
                }
                const mounted = Array.from(el.querySelectorAll('source')).map(
                    (s) => s.getAttribute('src') ?? '',
                );
                if (
                    mounted.length >= urls.length &&
                    urls.every((u, idx) => mounted[idx] === u)
                ) {
                    break;
                }
            }
        } else if (!rt.videoRef.current) {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => resolve());
                });
            });
        }
        if (rt.shouldAbort?.() || !rt.videoRef.current) {
            return;
        }

        if (rt.autoplayKickTimerRef.current) {
            clearTimeout(rt.autoplayKickTimerRef.current);
            rt.autoplayKickTimerRef.current = null;
        }
        const el = rt.videoRef.current;
        const existingSources = Array.from(el.querySelectorAll('source')).map(
            (s) => s.getAttribute('src') ?? '',
        );
        const sameSources =
            urls.length > 0 &&
            existingSources.length === urls.length &&
            urls.every((u, idx) => existingSources[idx] === u);
        const skipReload =
            Boolean(rt.isForYouFeed) &&
            sameSources &&
            (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
                el.networkState === HTMLMediaElement.NETWORK_LOADING);

        if (rt.suppressPlayback) {
            el.playbackRate = SPEED[rt.speed];
            el.pause();
            rt.setPlaying(false);
            rt.setWaiting(false);
            rt.setCanPlay(false);
            rt.setShowTapToUnmute(false);
            rt.showController(false);
            if (rt.isForYouFeed && rt.primeNeighborBuffer && urls.length > 0) {
                primeForyouNeighborBuffer(el, urls);
            }
            return;
        }

        el.playbackRate = SPEED[rt.speed];
        /** For You 用 <source> 即可，勿再 load()（会与挂源重复拉 metadata，出现两次 206） */
        if (!skipReload && !rt.isForYouFeed) {
            if (!sameSources) {
                el.removeAttribute('src');
            }
            try {
                el.load();
            } catch {
                // ignore
            }
        }

        const resumeSec =
            rt.isForYouFeed && rt.resumeTimeSec != null && rt.resumeTimeSec > 0
                ? rt.resumeTimeSec
                : 0;
        if (resumeSec > 0) {
            applyForyouResumeSeek(el, resumeSec);
        } else if (!skipReload) {
            el.currentTime = 0;
        }

        if (rt.isForYouFeed && urls.length > 0) {
            /** abortForyouVideoLoad 会 strip DOM src；kick 前强制 resync 恢复 */
            resyncForyouVideoSources(el, urls);
        }

        if (rt.isForYouFeed && isForyouIosPlayback()) {
            ensureForyouIosVideoLoad(el);
        }

        if (location.search.indexOf('auto_play=0') === -1) {
            const isPcViewport =
                typeof window !== 'undefined' &&
                window.matchMedia('(min-width: 768px)').matches;
            if (rt.isForYouFeed && isForyouIosPlayback() && !isPcViewport) {
                kickForyouIosAutoplay(rt, el);
            } else {
                kickForyouAutoplay(rt, el);
            }
        } else {
            el.muted = false;
        }
    };

    const d = await fetchEpisodeDetailOrNull(id, loading, rt.episodeFetchOpts);
    if (!d) {
        rt.setPlaybackSources([]);
        return;
    }
    if (rt.shouldAbort?.()) {
        return;
    }
    await applyEpisode(d);
}

/** 滑到邻格已暖缓存的条：跳过 fetch/apply，直接续播 */
export function tryForyouWarmStartPlayback(
    rt: LoadEpisodeRuntime,
    episodeId: number,
    urls: string[],
    cachedEpisodeId: number | undefined,
): boolean {
    if (rt.suppressPlayback || !rt.isForYouFeed || rt.isFeedColdAutoplay) {
        return false;
    }
    if (cachedEpisodeId !== episodeId) {
        return false;
    }
    const el = rt.videoRef.current;
    if (!canForyouWarmStart(el, urls)) {
        return false;
    }
    if (!el) {
        return false;
    }
    if (rt.shouldAbort?.()) {
        return false;
    }
    const resumeSec =
        rt.resumeTimeSec != null && rt.resumeTimeSec > 0 ? rt.resumeTimeSec : 0;
    if (resumeSec > 0) {
        applyForyouResumeSeek(el, resumeSec);
    }
    el.playbackRate = SPEED[rt.speed];
    if (location.search.indexOf('auto_play=0') === -1) {
        if (urls.length > 0) {
            resyncForyouVideoSources(el, urls);
        }
        if (isForyouIosPlayback()) {
            ensureForyouIosVideoLoad(el);
        }
        const isPcViewport =
            typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        if (rt.isForYouFeed && isForyouIosPlayback() && !isPcViewport) {
            kickForyouIosAutoplay(rt, el);
        } else {
            kickForyouAutoplay(rt, el);
        }
    }
    return true;
}
