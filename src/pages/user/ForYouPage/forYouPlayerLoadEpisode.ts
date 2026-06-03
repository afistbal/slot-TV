import { WebVTT } from 'videojs-vtt.js';
import type { RefObject } from 'react';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { fetchEpisodeDetailOrNull, type EpisodeFetchOpts } from '@/pages/user/VideoPage/episodeDetailCache';
import { resolveEpisodePlaybackUrls } from '@/pages/user/VideoPage/videoPlayerPlaybackUrls';
import { SPEED } from '@/pages/user/VideoPage/videoPlayerConstants';
import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { preferForyouSoundAutoplay } from '@/pages/user/ForYouPage/foryouAutoplayPolicy';
import { hasVideoSessionUserUnmuted } from '@/pages/user/VideoPage/videoSessionMute';

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
            (el.readyState >= 1 || el.networkState === HTMLMediaElement.NETWORK_LOADING);

        if (rt.suppressPlayback) {
            el.playbackRate = SPEED[rt.speed];
            el.pause();
            rt.setPlaying(false);
            rt.setWaiting(false);
            rt.setCanPlay(false);
            rt.setShowTapToUnmute(false);
            rt.showController(false);
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
        } else if (!skipReload) {
            el.currentTime = 0;
        }

        const isPcViewport =
            typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        const sessionUnmuted = hasVideoSessionUserUnmuted();
        const isH5 = !isPcViewport;
        const isFeedColdAutoplay = Boolean(rt.isFeedColdAutoplay);
        /** 仅冷启动首条静音；首页进入 / 滑切 /（H5）会话已开声 → 有声（见 FORYOU_AUTOPLAY.md） */
        const preferSoundAutoplay =
            preferForyouSoundAutoplay(isFeedColdAutoplay) ||
            (isH5 && sessionUnmuted && !isFeedColdAutoplay);
        const isColdVideoAutoplay = !preferSoundAutoplay;
        /** PC 冷启动静音时展示 `.xgplayer-unmute` */
        const showTapToUnmuteOnMutedAutoplay = isPcViewport && isFeedColdAutoplay;

        const useLegacyEpisodePlayback = rt.legacyEpisodeAutoplayRef.current;
        rt.legacyEpisodeAutoplayRef.current = false;

        if (location.search.indexOf('auto_play=0') === -1) {
            if (useLegacyEpisodePlayback) {
                /** H5 竖滑（含 iOS）：手势链内与安卓一致，先试有声；冷启动或失败再静音 */
                if (preferSoundAutoplay) {
                    el.muted = false;
                    rt.onVideoMutedUiSync?.(false);
                } else {
                    el.muted = true;
                    rt.onVideoMutedUiSync?.(true);
                }
                const runLegacyPlay = () => {
                    const v = rt.videoRef.current;
                    if (!v) {
                        return;
                    }
                    v.play()
                        .then(() => rt.setPlaying(true))
                        .catch(() => {
                            if (preferSoundAutoplay && !v.muted) {
                                v.muted = true;
                                rt.onVideoMutedUiSync?.(true);
                                v.play()
                                    .then(() => rt.setPlaying(true))
                                    .catch(() => {
                                        rt.showController(false);
                                        rt.setWaiting(false);
                                        rt.setCanPlay(true);
                                    });
                                return;
                            }
                            rt.showController(false);
                            rt.setWaiting(false);
                            rt.setCanPlay(true);
                        });
                };
                if (rt.isForYouFeed && el.readyState < 1) {
                    el.addEventListener('loadedmetadata', runLegacyPlay, { once: true });
                } else {
                    runLegacyPlay();
                }
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
                        if (!(isPcViewport && v.muted && showTapToUnmuteOnMutedAutoplay)) {
                            rt.setShowTapToUnmute(false);
                        }
                    };
                    const fallbackMutedAutoplay = () => {
                        /** iOS 滑切后 unmuted play 失败时仍须静音起播，否则会卡在首帧 */
                        if (
                            rt.isForYouFeed &&
                            isH5 &&
                            sessionUnmuted &&
                            !isFeedColdAutoplay &&
                            !isIosLikeDevice()
                        ) {
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
                const schedulePlay = () => {
                    if (rt.isForYouFeed && el.readyState < 1) {
                        el.addEventListener('loadedmetadata', runPlay, { once: true });
                        return;
                    }
                    runPlay();
                };
                if (delayMs > 0) {
                    rt.autoplayKickTimerRef.current = setTimeout(schedulePlay, delayMs);
                } else {
                    schedulePlay();
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
    if (rt.shouldAbort?.()) {
        return;
    }
    await applyEpisode(d);
}
