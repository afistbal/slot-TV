import { WebVTT } from 'videojs-vtt.js';
import type { RefObject } from 'react';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { fetchEpisodeDetailOrNull, type EpisodeFetchOpts } from '@/pages/user/VideoPage/episodeDetailCache';
import { resolveEpisodePlaybackUrls } from '@/pages/user/VideoPage/videoPlayerPlaybackUrls';
import { SPEED } from '@/pages/user/VideoPage/videoPlayerConstants';
import { hasVideoSessionUserUnmuted } from '@/pages/user/VideoPage/videoSessionMute';
import { isPerformanceNavigationReload } from '@/pages/user/VideoPage/videoPlayerUtils';

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
};

export async function runLoadEpisodeForForYouPlayer(
    rt: LoadEpisodeRuntime,
    id: number,
    loading: boolean,
): Promise<void> {
    /** ???? / ?????????????????????????????????????????????????????????????????????????????????? closure ????? hide */
    window.clearTimeout(rt.controllerTimerRef.current);

    const applyEpisode = async (d: IPlayerEpisode) => {
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
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => resolve());
                });
            });
        }
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

        const resumeSec =
            rt.isForYouFeed && rt.resumeTimeSec != null && rt.resumeTimeSec > 0
                ? rt.resumeTimeSec
                : 0;
        if (resumeSec > 0) {
            const applyResume = () => {
                const v = rt.videoRef.current;
                if (!v) {
                    return;
                }
                const d = v.duration;
                const t =
                    Number.isFinite(d) && d > 0
                        ? Math.min(resumeSec, Math.max(0, d - 0.25))
                        : resumeSec;
                try {
                    v.currentTime = t;
                } catch {
                    // ignore seek before ready
                }
            };
            if (el.readyState >= 1) {
                applyResume();
            } else {
                el.addEventListener('loadedmetadata', applyResume, { once: true });
            }
        } else {
            el.currentTime = 0;
        }

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
        /** ?????????????query???? `?A100C100`???????????????????????????????? query ???????????????????????????????????????????????????????????????????*/
        const marketingSoundQuery =
            typeof location !== 'undefined' &&
            location.search.length > 1 &&
            location.search.indexOf('auto_play=0') === -1;
        const sessionUnmuted = hasVideoSessionUserUnmuted();
        /** PC????????????????????? query???????????????????????? session ????????????*/
        const showTapToUnmutePc =
            isPcViewport &&
            (isReload ||
                marketingSoundQuery ||
                (!rt.fromHomeVideoPlayback && (!sessionUnmuted || isReload)));
        /** PC ????????????????????H5 ?????? `VideoPlayer` ???`video.muted` + ??????????????????????????*/
        const showTapToUnmuteOnMutedAutoplay = showTapToUnmutePc;
        const isH5 = !isPcViewport;
        const allowSoundAutoplay = rt.fromHomeVideoPlayback || isH5 || marketingSoundQuery;
        const preferSoundAutoplay =
            allowSoundAutoplay || (Boolean(rt.isForYouFeed) && isH5 && sessionUnmuted);
        const isColdVideoAutoplay = !preferSoundAutoplay;

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
                        console.log('??????????????');
                        rt.showController(false);
                        rt.setWaiting(false);
                        rt.setCanPlay(true);
                    });
            } else {
                if (preferSoundAutoplay) {
                    el.muted = false;
                    rt.onVideoMutedUiSync?.(false);
                } else {
                    el.muted = true;
                    rt.onVideoMutedUiSync?.(true);
                    rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
                }
                const runPlay = () => {
                    const v = rt.videoRef.current;
                    if (!v) {
                        return;
                    }
                    const onPlayFail = () => {
                        console.log('autoplay failed');
                        rt.showController(false);
                        rt.setWaiting(false);
                        rt.setCanPlay(true);
                        rt.setShowTapToUnmute(false);
                    };
                    const fallbackMutedAutoplay = () => {
                        if (rt.isForYouFeed && isH5 && sessionUnmuted) {
                            onPlayFail();
                            return;
                        }
                        v.muted = true;
                        rt.onVideoMutedUiSync?.(true);
                        rt.setShowTapToUnmute(showTapToUnmuteOnMutedAutoplay);
                        v.play()
                            .then(() => rt.setPlaying(true))
                            .catch(onPlayFail);
                    };
                    v.play()
                        .then(() => {
                            rt.setPlaying(true);
                        })
                        .catch(() => {
                            if (preferSoundAutoplay && !v.muted) {
                                fallbackMutedAutoplay();
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
