import { WebVTT } from 'videojs-vtt.js';
import type { RefObject } from 'react';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { fetchEpisodeDetailOrNull, type EpisodeFetchOpts } from './episodeDetailCache';
import { resolveEpisodePlaybackUrls } from './videoPlayerPlaybackUrls';
import { SPEED } from './videoPlayerConstants';
import { hasVideoSessionUserUnmuted } from './videoSessionMute';
import { isPerformanceNavigationReload } from './videoPlayerUtils';

export type LoadEpisodeRuntime = {
    videoRef: RefObject<HTMLVideoElement | null>;
    subtitlesRef: RefObject<VTTCue[]>;
    autoplayKickTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
    getStaticBase: () => string;
    speed: number;
    fromHomeVideoPlayback: boolean;
    legacyEpisodeAutoplayRef: RefObject<boolean>;
    /** 竖滑邻居格：挂片与 UI，不自动播放 */
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
    /** 传给 `fetchEpisodeDetailOrNull`：用于 `movie/episode` 的 `auto_unlock` */
    episodeFetchOpts?: EpisodeFetchOpts;
};

export async function runLoadEpisodeForPlayer(
    rt: LoadEpisodeRuntime,
    id: number,
    loading: boolean,
): Promise<void> {
    /** 换集 / 重拉详情前清掉上一集的自动隐藏定时器，避免对已切到「付费锁页」仍用旧 closure 执行 hide */
    window.clearTimeout(rt.controllerTimerRef.current);

    const applyEpisode = async (d: IPlayerEpisode) => {
        window.clearTimeout(rt.controllerTimerRef.current);
        rt.setLoading(false);
        rt.setEpisode(d);
        rt.setShowTapToUnmute(false);

        /** 锁定集（如 VIP 非会员）：只展示锁页，不拉字幕、不挂片源、不 play（滑到该集时再走本分支一次即可） */
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
            /** 锁页必须常驻：`showController(true)` 会起 10s 定时器，此时 React 尚未提交 lock，`hideController` 仍读到旧 `episode.lock` 会把整块 UI 透明掉 */
            rt.showController(false);
            return;
        }

        const urls = resolveEpisodePlaybackUrls(d, rt.getStaticBase());
        rt.setPlaybackSources(urls);

        if (urls.length === 0) {
            rt.setWaiting(false);
            return;
        }

        const subtitleStr = d.subtitle != null ? String(d.subtitle) : '';
        if (subtitleStr) {
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
        } else {
            rt.subtitlesRef.current = [];
        }

        await Promise.resolve();

        if (!rt.videoRef.current) {
            return;
        }

        if (rt.autoplayKickTimerRef.current) {
            clearTimeout(rt.autoplayKickTimerRef.current);
            rt.autoplayKickTimerRef.current = null;
        }
        const el = rt.videoRef.current;
        el.removeAttribute('src');
        el.playbackRate = SPEED[rt.speed];
        try {
            el.load();
        } catch {
            // ignore
        }
        el.currentTime = 0;

        if (rt.suppressPlayback) {
            el.muted = true;
            el.pause();
            rt.setPlaying(false);
            rt.setWaiting(false);
            rt.setCanPlay(false);
            rt.setShowTapToUnmute(false);
            rt.showController(false);
            return;
        }

        const isPcViewport =
            typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        const isReload = isPerformanceNavigationReload();
        /** 带推广/归因等 query（如 `?A100C100`）且未显式禁止自动播：与「无 query 的站内进播放页」一样先试有声，失败再静音并允许展示「取消静音」 */
        const marketingSoundQuery =
            typeof location !== 'undefined' &&
            location.search.length > 1 &&
            location.search.indexOf('auto_play=0') === -1;
        const sessionUnmuted = hasVideoSessionUserUnmuted();
        /** PC：整页刷新、带归因 query、或站内冷链（可结合 session 少打蒙层） */
        const showTapToUnmutePc =
            isPcViewport &&
            (isReload ||
                marketingSoundQuery ||
                (!rt.fromHomeVideoPlayback && (!sessionUnmuted || isReload)));
        /** PC 全屏点按开声蒙层（H5 改由 `VideoPlayer` 按 `video.muted` + 底栏音量是否点过控制） */
        const showTapToUnmuteOnMutedAutoplay = showTapToUnmutePc;
        const allowSoundAutoplay = rt.fromHomeVideoPlayback || !isPcViewport || marketingSoundQuery;
        const isColdVideoAutoplay = !allowSoundAutoplay;

        const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
        rt.legacyEpisodeAutoplayRef.current = false;

        if (location.search.indexOf('auto_play=0') === -1) {
            if (useLegacyEpisodePlayback) {
                el.muted = false;
                el.play()
                    .then(() => {
                        rt.setPlaying(true);
                    })
                    .catch(() => {
                        console.log('自动播放失败');
                        rt.showController(false);
                        rt.setWaiting(false);
                        rt.setCanPlay(true);
                    });
            } else {
                if (allowSoundAutoplay) {
                    el.muted = false;
                } else {
                    el.muted = true;
                    rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
                }
                const runPlay = () => {
                    const v = rt.videoRef.current;
                    if (!v) {
                        return;
                    }
                    const onPlayFail = () => {
                        console.log('自动播放失败');
                        rt.showController(false);
                        rt.setWaiting(false);
                        rt.setCanPlay(true);
                        rt.setShowTapToUnmute(false);
                    };
                    v.play()
                        .then(() => {
                            rt.setPlaying(true);
                        })
                        .catch(() => {
                            if (allowSoundAutoplay && !v.muted) {
                                v.muted = true;
                                rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
                                v.play()
                                    .then(() => rt.setPlaying(true))
                                    .catch(onPlayFail);
                                return;
                            }
                            onPlayFail();
                        });
                };
                const delayMs = isPcViewport && isColdVideoAutoplay ? 300 : 0;
                if (delayMs > 0) {
                    rt.autoplayKickTimerRef.current = setTimeout(runPlay, delayMs);
                } else {
                    runPlay();
                }
            }
        } else {
            el.muted = false;
        }

        rt.controllerTimerRef.current = window.setTimeout(() => {
            rt.hideController();
        }, 10000);
    };

    const d = await fetchEpisodeDetailOrNull(id, loading, rt.episodeFetchOpts);
    if (!d) {
        rt.setPlaybackSources([]);
        return;
    }
    await applyEpisode(d);
}
