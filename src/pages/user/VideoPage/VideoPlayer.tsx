import {
    ChevronLeft,
    Crown,
    Home,
    LayoutGrid,
    Minimize,
    Pause,
    PlayIcon,
    Star,
    Unlock,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import fullscreenIcon from '@/assets/images/is_full_screen_icon.88dfd7dd.png';
import nextEpisodeIcon from '@/assets/images/12164930-c692-11ef-a2d6-41216ff1602c.png';
import pcBackIcon from '@/assets/icons/video-pc-back.svg';
import paidEpisodeLockIcon from '@/assets/images/7f47ede0-ef83-11f0-84ad-6b5693b490dc.png';
import shareEntryIcon from '@/assets/icons/share/share-entry.svg';
import { cn } from '@/lib/utils';
import { toggleVideoFullscreen } from '@/lib/toggleFullscreen';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useNavigate } from 'react-router';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import { useUserStore } from '@/stores/user';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
// import UnlockEpisode from '@/widgets/UnlockEpisode';
import Forward from '@/components/Forward';
// import { useLoadingStore } from "@/stores/loading";
import { SPEED } from './videoPlayerConstants';
import { canNavigateBack } from './videoPlayerUtils';
import { getFullscreenElement } from './videoPlayerFullscreen';
import { resolveVideoPosterUrl } from './videoPlayerShareUrl';
import { captureVideoFrameDataUrlWithSeekRetry } from './videoFramePoster';
import { getEpisodePeekFrame, setEpisodePeekFrame } from './episodeFrameQueueStore';
import { runLoadEpisodeForPlayer } from './videoPlayerLoadEpisode';
import { markVideoSessionUserUnmuted } from './videoSessionMute';
import { formatVideoClock } from './videoPlayerTimeFormat';
import { putEpisodeDetailCache } from './episodeDetailCache';
import {
    VideoPlayerEpisodeSpeedIntroDrawers,
    VideoPlayerH5CommerceDrawers,
    VideoPlayerPcCommerceDialogs,
    VideoPlayerPcEpisodeAside,
    useVideoPlayerShare,
} from './videoPlayerOverlays';

/** PC 侧栏分集：每页最多 50 集（与下述 tab 文案一致） */
function buildPcEpisodeTabRanges(maxEpisode: number): { start: number; end: number }[] {
    if (maxEpisode < 1) {
        return [{ start: 1, end: 1 }];
    }
    return Array.from({ length: Math.ceil(maxEpisode / 50) }, (_, i) => {
        const start = i * 50 + 1;
        const end = Math.min(start + 49, maxEpisode);
        return { start, end };
    });
}

function pcEpisodeTabIndexForEpisodeNo(
    episodeNo: number,
    ranges: { start: number; end: number }[],
): number {
    const i = ranges.findIndex((r) => episodeNo >= r.start && episodeNo <= r.end);
    return i >= 0 ? i : 0;
}

export function VideoPlayer({
    id,
    data,
    onSetEpisode,
    fromHomeVideoPlayback,
    legacyEpisodeAutoplayRef,
    playbackPolicy = 'autoplay',
    ...props
}: {
    id: number;
    index: number;
    data: IPlayerData;
    onSetEpisode: (index: number) => void;
    fullscreenTargetRef: RefObject<HTMLDivElement | null>;
    shouldKeepFullscreen: boolean;
    onFullscreenPrefChange: (value: boolean) => void;
    onEpisodeFullscreenReady: () => void;
    shouldIgnoreFullscreenExit: () => boolean;
    /** 站内带 `VIDEO_FROM_HOME_STATE` 或路由栈上一页（非整页刷新）：PC 可走有声；直链/刷新仍走静音冷启动 */
    fromHomeVideoPlayback: boolean;
    /** 换集走 video-old 式播放（无声优静音策略） */
    legacyEpisodeAutoplayRef: RefObject<boolean>;
    /** 当前集正常播；竖滑相邻格仅挂片+控件，不自动播放 */
    playbackPolicy?: 'autoplay' | 'paused';
}) {
    // const loadingStore = useLoadingStore();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const configStore = useConfigStore();
    const wrapRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressWrapRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const progressCurrentRef = useRef<HTMLDivElement>(null);
    const progressDragStartRef = useRef(false);
    const controllerRef = useRef<HTMLDivElement>(null);
    const subtitleRef = useRef<HTMLDivElement>(null);
    const episodeRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const intl = useIntl();
    const userStore = useUserStore();
    const controllerTimerRef = useRef(0);
    const controllerIsShow = useRef(true);
    const subtitlesRef = useRef<VTTCue[]>([]);
    const [playing, setPlaying] = useState(false);
    const [canPlay, setCanPlay] = useState(false);
    const setWaiting = useCallback((..._args: unknown[]) => {}, []);
    const [framePosterDataUrl, setFramePosterDataUrl] = useState(() => getEpisodePeekFrame(id) ?? '');
    const [current, setCurrent] = useState('00:00');
    const [duration, setDuration] = useState('00:00');
    const [subtitle, setSubtitle] = useState(-1);
    const [episode, setEpisode] = useState<IPlayerEpisode>();
    const [episodeStatus, setEpisodeStatus] = useState(false);
    const [favorite, setFavorite] = useState(data.info.is_favorite === 1);
    const [vip, setVip] = useState(false);
    // const [unlockEpisodeOpen, setUnlockEpisodeOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [playbackSources, setPlaybackSources] = useState<string[]>([]);
    const [speedOpen, setSpeedOpen] = useState(false);
    const [speed, setSpeed] = useState(parseInt(localStorage.getItem('playback_speed') || '1', 10));
    const [introduction, setIntroduction] = useState(false);
    const isDesktop = useMinWidth768();
    const staticBase = useMemo(() => String(configStore.config['static'] ?? ''), [configStore.config['static']]);
    const {
        shareOpen,
        setShareOpen,
        shareEmbedCode,
        setShareEmbedCode,
        shareShowControls,
        setShareShowControls,
        handleShareAction,
        handleCopyEmbedCode,
    } = useVideoPlayerShare(data, staticBase);
    /** 未解锁：无 poster；已解锁：仅用截帧 data URL，失败则黑底（不用 `info.image`） */
    const unlockVisualOnly = episode?.lock === true;
    const frameTrim = framePosterDataUrl.trim();
    const videoPosterAttr = unlockVisualOnly ? undefined : frameTrim.length > 0 ? frameTrim : undefined;
    /** 仅分享弹窗预览卡：用剧封 `info.image`（与播放器 poster 截帧分离） */
    const shareCardPosterUrl = useMemo(
        () => resolveVideoPosterUrl(staticBase, data.info.image),
        [staticBase, data.info.image],
    );
    const [desktopEpisodeTab, setDesktopEpisodeTab] = useState(0);
    const [pcFullscreen, setPcFullscreen] = useState(false);
    const [progressHover, setProgressHover] = useState(false);
    const [progressDragging, setProgressDragging] = useState(false);
    /** 冷启动/刷新：静音自动播时展示（PC 用 `.xgplayer-unmute-bt`，H5 用底部按钮层） */
    const [showTapToUnmute, setShowTapToUnmute] = useState(false);
    /** 与 `<video>.muted` 同步，用于底部音量图标（对标 douyin BaseMusic 入口） */
    const [videoMutedUi, setVideoMutedUi] = useState(true);
    /** H5：用户点过底栏音量按钮后不再出全屏「点按取消静音」蒙层（本集内）；换 `id` 重置 */
    const [h5UserDismissedUnmuteOverlay, setH5UserDismissedUnmuteOverlay] = useState(false);
    const progressActiveElementRef = useRef<HTMLDivElement | null>(null);
    const fullscreenRestoreInFlightRef = useRef(false);
    const fullscreenRestoreEpisodeRef = useRef<number | null>(null);
    /** 因页签/窗口不可见而自动暂停时置 true，回到前台仅在此情况下自动续播 */
    const pausedByDocumentVisibilityRef = useRef(false);
    /** 对标 NetShort `playWithDelay(300)`：直链/刷新 PC 静音自动播前稍迟再 play，且切换 md 断点前需清掉 */
    const autoplayKickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const {
        fullscreenTargetRef,
        shouldKeepFullscreen,
        onFullscreenPrefChange,
        onEpisodeFullscreenReady,
        shouldIgnoreFullscreenExit,
    } = props;
    const isFullscreenUi = shouldKeepFullscreen || pcFullscreen;
    /** 主格与邻格均用 metadata，便于邻格在拖拽时尽快出首帧占位（比 none 少黑屏） */
    const videoPreload: 'none' | 'metadata' = 'metadata';

    /** H5：与 `<video>.muted` 一致且正在播时出全屏点按开声蒙层；用户点过底栏音量后不再出 */
    const showH5FullscreenUnmuteOverlay =
        !isDesktop &&
        videoMutedUi &&
        playing &&
        !h5UserDismissedUnmuteOverlay &&
        episode?.lock === false &&
        location.search.indexOf('auto_play=0') === -1;

    async function forceExitFullscreen(options?: { skipVideoWebKitExit?: boolean }) {
        const video = videoRef.current as (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
        // 必须先退出浏览器全屏再改 React 布局；否则 PC 会在 fullscreen 内先插入侧栏，exitFullscreen 易失败或需点两次。
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }
        // webkitendfullscreen 时系统已退出，再调一次易导致播放被停掉。
        if (!options?.skipVideoWebKitExit && video?.webkitExitFullscreen) {
            try {
                video.webkitExitFullscreen();
            } catch {
                // ignore
            }
        }
        // 与 video 一致：从 iOS 系统视频全屏回调里进来时勿再调，避免干扰内联续播。
        if (!options?.skipVideoWebKitExit && doc.webkitExitFullscreen) {
            await Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
        }
        onFullscreenPrefChange(false);
        setPcFullscreen(false);
    }

    function handleBack() {
        if (canNavigateBack()) {
            navigate(-1);
        } else {
            navigate('/');
        }
    }

    function handleControllerTouchStart() {
        if (controllerIsShow.current) {
            hideController();
        } else {
            showController();
        }
    }

    function showController(autoClose = true) {
        if (controllerRef.current === null) {
            return;
        }
        window.clearTimeout(controllerTimerRef.current);
        controllerIsShow.current = true;
        controllerRef.current.style.opacity = '1';
        if (autoClose) {
            controllerTimerRef.current = window.setTimeout(() => {
                hideController();
            }, 10000);
        }
    }

    function hideController() {
        if (controllerRef.current === null) {
            return;
        }
        if (episode?.lock === true) {
            return;
        }
        window.clearTimeout(controllerTimerRef.current);
        controllerRef.current.style.opacity = '0';
        controllerIsShow.current = false;
    }

    function handleDesktopControllerMouseEnter() {
        showController(false);
    }

    function handleDesktopControllerMouseLeave() {
        hideController();
    }

    async function loadData(episodeId: number, showLoading = false) {
        const suppressPlayback = playbackPolicy === 'paused';
        setCanPlay(false);
        await runLoadEpisodeForPlayer(
            {
                videoRef,
                subtitlesRef,
                autoplayKickTimerRef,
                getStaticBase: () => String(configStore.config['static'] ?? ''),
                speed,
                fromHomeVideoPlayback,
                legacyEpisodeAutoplayRef,
                suppressPlayback,
                setLoading,
                setEpisode,
                setShowTapToUnmute,
                setWaiting,
                setPlaying,
                setCanPlay,
                setPlaybackSources,
                showController,
                hideController,
                controllerTimerRef,
                episodeFetchOpts: {
                    viewerIsVip: userStore.isVIP(),
                },
            },
            episodeId,
            showLoading,
        );
    }

    function handleVipEmbedClose() {
        setVip(false);
    }

    /** 充值/VIP 支付成功：RadixRc 已拉最新 `movie/episode`，写入缓存并走同一套 `loadData` 更新播放 */
    function handleEmbedPaySuccessEpisodeDetail(d: IPlayerEpisode) {
        putEpisodeDetailCache(Number(d.id) || id, d);
        void loadData(id, false);
    }

    function handleSetEpisode(index: number) {
        onSetEpisode(index);
    }

    function hasNextEpisode() {
        return props.index < data.episodes.length - 1;
    }

    function handleJumpNextEpisode(ev?: MouseEvent | React.MouseEvent<HTMLElement>) {
        ev?.preventDefault();
        ev?.stopPropagation();
        if (!hasNextEpisode()) {
            return;
        }
        legacyEpisodeAutoplayRef.current = true;
        showController();
        handleSetEpisode(props.index + 1);
    }

    function handleToggleEpisode() {
        setEpisodeStatus(!episodeStatus);
        if (!episodeStatus) {
            setTimeout(() => {
                episodeRef.current
                    ?.querySelectorAll(`[data-episode="${episode?.episode}"]`)
                    .forEach((v) => {
                        v.scrollIntoView({
                            block: 'center',
                            inline: 'center',
                        });
                    });
            }, 300);
        }
    }

    function handleToggleFavorite() {
        // PC 侧栏收藏不在 controllerRef 内；勿与 H5 内层控制条共用「控制器显隐」门禁，否则自动隐层后侧栏星标无法点击。
        if (!isDesktop && !controllerIsShow.current) {
            return;
        }

        if (!skipRemoteApi) {
            api('movie/favorite', {
                method: 'post',
                data: {
                    id: data.info.id,
                    time: videoRef.current?.currentTime,
                },
                loading: false,
            });
        }

        setFavorite(!favorite);
    }

    function handleToggleVip(ev?: MouseEvent) {
        ev?.stopPropagation();
        if (userStore.signed && userStore.isVIP()) {
            return;
        }
        if (!vip) {
            void forceExitFullscreen();
            showController();
        }
        setVip((open) => !open);
    }

    function handleToggleUnlockEpisode(open: boolean) {
        // if (!open) {
            // setUnlockEpisodeOpen(false);
            // setVip(true);
            // return;
        // }
        // api<number>('movie/episode/unlock', {
        //     method: 'post',
        //     data: { id: episode?.id },
        // }).then((res) => {
        //     if (res.d === 1) {
        //         setUnlockEpisodeOpen(!unlockEpisodeOpen);
        //     } else if (res.d === 2) {
        //         location.reload();
        //     }
        // });
        if (open) {
            void forceExitFullscreen();
        }
        setVip(open);
    }

    // async function handleToggleUnlock() {
    //     loadingStore.show();
    //     const result = await api('movie/episode/will-unlock', {
    //         data: {
    //             id: episode?.id,
    //         },
    //         loading: false,
    //     });

    //     if (result.c !== 0) {
    //         loadingStore.hide()
    //         return;
    //     }

    //     /* @ts-ignore */
    //     const adResult = await window.flutter_inappwebview.callHandler('showAd');

    //     if (!adResult) {
    //         loadingStore.hide()
    //         return;
    //     }

    //     const unlockResult = await api('movie/episode/do-unlock', {
    //         method: 'post',
    //         data: {
    //             id: episode?.id,
    //             cipher: result.d,
    //         },
    //         loading: false,
    //     });

    //     if (unlockResult.c !== 0) {
    //         loadingStore.hide()
    //         return;
    //     }

    //     loadingStore.hide();

    //     onReload();
    // }

    function handleTogglePlay(e: React.MouseEvent<HTMLElement>) {
        if (videoRef.current === null) {
            return;
        }
        if (!controllerIsShow.current) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {
                console.log('点击播放失败');
            });
        } else {
            videoRef.current.pause();
        }
        showController();
        setPlaying(!videoRef.current.paused);
    }

    function processTouchStart(element: HTMLDivElement, x: number) {
        if (!controllerIsShow.current) {
            return;
        }
        if (!videoRef.current) {
            return;
        }
        if (videoRef.current.duration <= 0) {
            return;
        }
        showController();
        progressDragStartRef.current = true;
        progressActiveElementRef.current = element;
        setProgressDragging(true);
        const rect = element.getBoundingClientRect();
        let width = x - rect.left;
        if (width < 0) {
            width = 0;
        } else if (width > rect.width) {
            width = rect.width;
        }
        progressCurrentRef.current!.style.width = `${width}px`;
        videoRef.current.currentTime = (width / rect.width) * videoRef.current.duration;
    }

    function processTouchMove(element: HTMLDivElement, x: number) {
        if (!controllerIsShow.current) {
            return;
        }
        if (!videoRef.current) {
            return;
        }
        if (videoRef.current.duration <= 0) {
            return;
        }
        if (!progressDragStartRef.current) {
            return;
        }
        showController();
        const rect = element.getBoundingClientRect();
        let width = x - rect.left;
        if (width < 0) {
            width = 0;
        } else if (width > rect.width) {
            width = rect.width;
        }
        progressCurrentRef.current!.style.width = `${width}px`;
        videoRef.current.currentTime = (width / rect.width) * videoRef.current.duration;
    }

    function handleProgressTouchStart(e: React.TouchEvent<HTMLDivElement>) {
        processTouchStart(e.currentTarget as HTMLDivElement, e.touches[0].clientX);
    }

    function handleProgressTouchMove(e: React.TouchEvent<HTMLDivElement>) {
        processTouchMove(e.currentTarget as HTMLDivElement, e.touches[0].clientX);
    }

    function handleProgressMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        processTouchStart(e.currentTarget as HTMLDivElement, e.clientX);
    }

    function handleProgressMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        processTouchMove(e.currentTarget as HTMLDivElement, e.clientX);
    }

    function handleProgressMouseEnter() {
        setProgressHover(true);
    }

    function handleProgressMouseLeave() {
        if (!progressDragging) {
            setProgressHover(false);
        }
    }

    function handleSpeedOpen(open?: boolean) {
        if (typeof open === 'boolean') {
            setSpeedOpen(open);
            return;
        }
        setSpeedOpen((prev) => !prev);
    }

    function handleSelectSpeed(index: number) {
        if (!videoRef.current) {
            return;
        }
        setSpeedOpen(false);
        setSpeed(index);
        localStorage.setItem('playback_speed', index.toString());
        videoRef.current.playbackRate = SPEED[index];
    }

    function handleSpeedControlClick(e: React.MouseEvent<HTMLDivElement>) {
        e.stopPropagation();
        if (isFullscreenUi) {
            const next = (speed + 1) % SPEED.length;
            handleSelectSpeed(next);
            showController();
            return;
        }
        handleSpeedOpen();
    }

    function handleIntroduction() {
        setIntroduction(!introduction);
    }

    function handleTapToUnmute() {
        const v = videoRef.current;
        if (!v) {
            return;
        }
        markVideoSessionUserUnmuted();
        v.muted = false;
        setVideoMutedUi(false);
        setShowTapToUnmute(false);
        void v.play().then(() => setPlaying(true)).catch(() => {});
        showController();
    }

    function handleToggleVideoMute(ev: MouseEvent<HTMLButtonElement>) {
        ev.stopPropagation();
        const v = videoRef.current;
        if (!v || episode?.lock) {
            return;
        }
        if (!isDesktop) {
            setH5UserDismissedUnmuteOverlay(true);
        }
        if (v.muted) {
            handleTapToUnmute();
            return;
        }
        v.muted = true;
        setVideoMutedUi(true);
        showController();
    }

    async function handleToggleFullscreen(e: React.MouseEvent<HTMLDivElement>) {
        e.stopPropagation();
        if (isFullscreenUi) {
            await forceExitFullscreen();
            showController();
            return;
        }
        await toggleVideoFullscreen(videoRef, fullscreenTargetRef, {
            preferContainer: true,
            // 桌面保留容器全屏 + 侧栏；移动端容器全屏在 iOS 常失败，需回退 webkitEnterFullscreen。
            disableNativeVideoFullscreen: isDesktop,
        });
        const nowFullscreen = Boolean(getFullscreenElement());
        // 桌面仅在实际进入 document 全屏时记偏好；iOS 原生 video 全屏常无 fullscreenElement，仍走意图兜底。
        if (nowFullscreen || !isDesktop) {
            onFullscreenPrefChange(true);
        }
        setPcFullscreen(nowFullscreen);
        showController();
    }

    async function handleExitPcFullscreen() {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        }
    }

    useEffect(() => {
        setH5UserDismissedUnmuteOverlay(false);
    }, [id]);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        void loadData(id);
    }, [id, isDesktop, sessionBootstrapReady, playbackPolicy, fromHomeVideoPlayback]);

    useEffect(() => {
        if (playbackPolicy !== 'paused' || controllerRef.current === null) {
            return;
        }
        if (loading) {
            return;
        }
        window.clearTimeout(controllerTimerRef.current);
        controllerIsShow.current = true;
        controllerRef.current.style.opacity = '1';
    }, [playbackPolicy, loading, id]);

    useEffect(() => {
        return () => {
            if (autoplayKickTimerRef.current) {
                clearTimeout(autoplayKickTimerRef.current);
                autoplayKickTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        setFramePosterDataUrl(getEpisodePeekFrame(id) ?? '');
    }, [id]);

    /** 换集后组件会 remount 或 episode 更新；tab 须落在「当前集」所在区间，否则会停在默认 1-50 */
    useEffect(() => {
        if (!isDesktop || !data) {
            return;
        }
        const epNo = episode?.episode;
        if (epNo == null || !Number.isFinite(epNo)) {
            return;
        }
        const maxEpisode = data.episodes.reduce((m, v) => Math.max(m, v.episode), 0);
        const ranges = buildPcEpisodeTabRanges(maxEpisode);
        const nextTab = pcEpisodeTabIndexForEpisodeNo(epNo, ranges);
        setDesktopEpisodeTab((prev) => (prev === nextTab ? prev : nextTab));
    }, [isDesktop, data, id, episode?.episode]);

    useEffect(() => {
        if (loading || !episode || episode.lock || playbackSources.length === 0) {
            return;
        }
        const v = videoRef.current;
        if (!v) {
            return;
        }
        const onLoadedData = () => {
            void (async () => {
                const url = await captureVideoFrameDataUrlWithSeekRetry(v);
                if (url) {
                    setFramePosterDataUrl(url);
                    setEpisodePeekFrame(id, url);
                }
            })();
        };
        v.addEventListener('loadeddata', onLoadedData);
        return () => v.removeEventListener('loadeddata', onLoadedData);
    }, [loading, id, episode?.id, episode?.lock, playbackSources]);

    useEffect(() => {
        if (loading) {
            return;
        }

        const v = videoRef.current;
        if (v === null) {
            return;
        }

        const syncUiFromVideoTime = () => {
            if (videoRef.current === null) {
                return;
            }
            const el = videoRef.current;
            const d = el.duration;
            const ct = el.currentTime;
            const durOk = Number.isFinite(d) && d > 0;
            const pct = durOk ? Math.min(100, Math.ceil((ct / d) * 100)) : 0;
            if (progressCurrentRef.current) {
                progressCurrentRef.current.style.width = `${pct}%`;
            }
            setCurrent(formatVideoClock(ct));
            setDuration(durOk ? formatVideoClock(d) : '00:00');
        };

        const videoTimeUpdate = () => {
            syncUiFromVideoTime();
            if (videoRef.current === null) {
                return;
            }
            let nextCue = -1;
            const t = videoRef.current.currentTime;
            for (let i = 0; i < subtitlesRef.current.length; i++) {
                const c = subtitlesRef.current[i];
                if (t >= c.startTime && t <= c.endTime && c.text.trim() !== '') {
                    nextCue = i;
                    break;
                }
            }
            setSubtitle(nextCue);
        };

        v.addEventListener('timeupdate', videoTimeUpdate);
        v.addEventListener('loadedmetadata', syncUiFromVideoTime);

        const progressEl = progressWrapRef.current;
        const progressTouchMove = (e: TouchEvent) => {
            e.preventDefault();
        };
        if (progressEl) {
            progressEl.addEventListener('touchmove', progressTouchMove);
        }

        const videoEnded = () => {
            setPlaying(false);
            legacyEpisodeAutoplayRef.current = true;
            onSetEpisode(props.index + 1);
        };

        v.addEventListener('ended', videoEnded);

        const videoCanPlay = () => {
            setCanPlay(true);
            setWaiting(false);
            syncUiFromVideoTime();
            onEpisodeFullscreenReady();
        };

        v.addEventListener('canplay', videoCanPlay);

        const videoPlaying = () => {
            setWaiting(false);
        };
        v.addEventListener('playing', videoPlaying);

        const syncMutedFromVideo = () => {
            const el = videoRef.current;
            if (el) {
                setVideoMutedUi(el.muted);
            }
        };
        syncMutedFromVideo();
        v.addEventListener('volumechange', syncMutedFromVideo);

        const videoError = () => {
            setWaiting(false);
            setPlaying(false);
            if (import.meta.env.DEV) {
                console.warn('[Video] media error', videoRef.current?.error);
            }
        };

        v.addEventListener('error', videoError);

        const mouseUp = () => {
            progressDragStartRef.current = false;
            progressActiveElementRef.current = null;
            setProgressDragging(false);
        };
        const mouseMove = (e: globalThis.MouseEvent) => {
            if (!progressDragStartRef.current || !progressActiveElementRef.current) {
                return;
            }
            processTouchMove(progressActiveElementRef.current, e.clientX);
        };
        const touchMoveWhenDrag = (e: TouchEvent) => {
            if (!progressDragStartRef.current || !progressActiveElementRef.current) {
                return;
            }
            e.preventDefault();
            processTouchMove(progressActiveElementRef.current, e.touches[0]?.clientX ?? 0);
        };
        const touchEnd = () => {
            mouseUp();
        };
        window.addEventListener('mouseup', mouseUp);
        window.addEventListener('mousemove', mouseMove);
        window.addEventListener('touchmove', touchMoveWhenDrag, { passive: false });
        window.addEventListener('touchend', touchEnd);
        window.addEventListener('touchcancel', touchEnd);

        return () => {
            v.removeEventListener('timeupdate', videoTimeUpdate);
            v.removeEventListener('loadedmetadata', syncUiFromVideoTime);
            v.removeEventListener('ended', videoEnded);
            v.removeEventListener('canplay', videoCanPlay);
            v.removeEventListener('playing', videoPlaying);
            v.removeEventListener('volumechange', syncMutedFromVideo);
            v.removeEventListener('error', videoError);
            progressEl?.removeEventListener('touchmove', progressTouchMove);
            window.removeEventListener('mouseup', mouseUp);
            window.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('touchmove', touchMoveWhenDrag);
            window.removeEventListener('touchend', touchEnd);
            window.removeEventListener('touchcancel', touchEnd);
        };
    }, [loading, id, episode?.lock]);

    useEffect(() => {
        const onVisibilityChange = () => {
            const v = videoRef.current;
            if (!v || episode?.lock || loading) {
                return;
            }
            if (document.visibilityState === 'hidden') {
                if (!v.paused) {
                    pausedByDocumentVisibilityRef.current = true;
                    v.pause();
                    setPlaying(false);
                }
            } else if (pausedByDocumentVisibilityRef.current) {
                pausedByDocumentVisibilityRef.current = false;
                if (v.ended) {
                    return;
                }
                void v.play().then(() => setPlaying(true)).catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [episode?.lock, loading]);

    useEffect(() => {
        if (wrapRef.current === null) {
            return;
        }

        const touchMove = (e: TouchEvent) => {
            e.preventDefault();
        };

        wrapRef.current.addEventListener('touchmove', touchMove);

        return () => {
            wrapRef.current?.removeEventListener('touchmove', touchMove);
        };
    }, []);

    useEffect(() => {
        if (!episode) {
            return;
        }
        // if (episode.lock) {
        //     setUnlockEpisodeOpen(true);
        // }
        if (episode.lock) {
            void forceExitFullscreen();
            setVip(true);
        }
    }, [episode]);

    useEffect(() => {
        const video = videoRef.current as
            | (HTMLVideoElement & {
                  webkitDisplayingFullscreen?: boolean;
              })
            | null;
        const onFullscreenChange = () => {
            const inFullscreen = Boolean(getFullscreenElement());
            setPcFullscreen(inFullscreen);
            if (!inFullscreen && !isDesktop && props.shouldKeepFullscreen) {
                return;
            }
            if (!inFullscreen && shouldKeepFullscreen && shouldIgnoreFullscreenExit()) {
                return;
            }
            onFullscreenPrefChange(inFullscreen);
        };
        const onWebkitBeginFullscreen = () => {
            setPcFullscreen(true);
            onFullscreenPrefChange(true);
            const v = videoRef.current;
            if (!v || episode?.lock || location.search.indexOf('auto_play=0') !== -1) {
                return;
            }
            /** iOS 系统全屏常在非手势链路上触发，浏览器会静音；在回调栈内尝试恢复有声 */
            if (v.muted) {
                v.muted = false;
                markVideoSessionUserUnmuted();
                setShowTapToUnmute(false);
                setVideoMutedUi(false);
                void v.play().then(() => setPlaying(true)).catch(() => {});
            }
        };
        /** iOS 退出系统全屏后常会处于 paused；单次 play 常失败，需同步先试一次再短时多次重试。 */
        const resumeInlineAfterNativeFullscreenExit = () => {
            const attempt = () => {
                const v = videoRef.current;
                if (!v || episode?.lock || location.search.indexOf('auto_play=0') !== -1 || v.ended) {
                    if (v) {
                        setPlaying(!v.paused);
                    }
                    return;
                }
                if (!v.paused) {
                    setPlaying(true);
                    return;
                }
                void v.play().then(() => setPlaying(true)).catch(() => {});
            };
            attempt();
            for (const ms of [32, 100, 280, 600]) {
                window.setTimeout(attempt, ms);
            }
        };
        const onWebkitEndFullscreen = () => {
            setPcFullscreen(false);
            if (shouldIgnoreFullscreenExit()) {
                return;
            }
            // 在 webkit 回调栈内先试 play，再恢复 UI；部分 iOS 版本离开回调后 play 会被策略拦。
            {
                const v = videoRef.current;
                if (
                    v &&
                    !episode?.lock &&
                    location.search.indexOf('auto_play=0') === -1 &&
                    !v.ended &&
                    v.paused
                ) {
                    void v.play().then(() => setPlaying(true)).catch(() => {});
                }
            }
            void forceExitFullscreen({ skipVideoWebKitExit: true }).finally(() => {
                resumeInlineAfterNativeFullscreenExit();
            });
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
        video?.addEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen as EventListener);
        video?.addEventListener('webkitendfullscreen', onWebkitEndFullscreen as EventListener);
        onFullscreenChange();
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener(
                'webkitfullscreenchange',
                onFullscreenChange as EventListener,
            );
            video?.removeEventListener(
                'webkitbeginfullscreen',
                onWebkitBeginFullscreen as EventListener,
            );
            video?.removeEventListener(
                'webkitendfullscreen',
                onWebkitEndFullscreen as EventListener,
            );
        };
    }, [isDesktop, shouldKeepFullscreen, shouldIgnoreFullscreenExit, onFullscreenPrefChange, episode?.lock, setPlaying, setShowTapToUnmute, setVideoMutedUi]);

    useEffect(() => {
        fullscreenRestoreInFlightRef.current = false;
        fullscreenRestoreEpisodeRef.current = null;
    }, [id]);

    useEffect(() => {
        if (!shouldKeepFullscreen) {
            return;
        }
        if (playbackPolicy === 'paused') {
            return;
        }
        if (fullscreenRestoreEpisodeRef.current === id || fullscreenRestoreInFlightRef.current) {
            return;
        }
        if (getFullscreenElement()) {
            return;
        }
        if (!videoRef.current || !canPlay || loading || episode?.lock) {
            return;
        }
        fullscreenRestoreInFlightRef.current = true;
        void toggleVideoFullscreen(videoRef, fullscreenTargetRef, {
            preferContainer: true,
            disableNativeVideoFullscreen: isDesktop || fromHomeVideoPlayback,
        })
            .then(() => {
                const inFullscreen = Boolean(getFullscreenElement());
                setPcFullscreen(inFullscreen);
                if (isDesktop) {
                    onFullscreenPrefChange(inFullscreen);
                    return;
                }
                if (!inFullscreen && !shouldKeepFullscreen) {
                    onFullscreenPrefChange(false);
                }
            })
            .finally(() => {
                fullscreenRestoreInFlightRef.current = false;
                fullscreenRestoreEpisodeRef.current = id;
            });
    }, [
        canPlay,
        loading,
        episode?.lock,
        isDesktop,
        id,
        shouldKeepFullscreen,
        fullscreenTargetRef,
        onFullscreenPrefChange,
        playbackPolicy,
        fromHomeVideoPlayback,
    ]);

    if (isDesktop) {
        const currentEpisodeNo = episode?.episode ?? props.index + 1;
        const maxEpisode = data.episodes.reduce((m, v) => Math.max(m, v.episode), 0);
        const tabRanges = buildPcEpisodeTabRanges(maxEpisode);
        const activeTab = Math.min(desktopEpisodeTab, Math.max(0, tabRanges.length - 1));
        const selectedRange = tabRanges[activeTab] ?? { start: 1, end: maxEpisode };
        const filteredEpisodes = data.episodes.filter(
            (v) => v.episode >= selectedRange.start && v.episode <= selectedRange.end,
        );

        return (
            <div className="video-player-root h-full w-full relative" ref={wrapRef}>
                <div className="h-full w-full relative opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 flex bg-black">
                        <div className="relative flex-1 flex justify-center items-center bg-black">
                            <div className="relative h-full max-h-full aspect-[9/16] w-auto max-w-full overflow-hidden">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover absolute"
                                playsInline
                                poster={videoPosterAttr}
                                preload={videoPreload}
                                {...({
                                    fetchPriority: playbackPolicy === 'paused' ? 'low' : 'high',
                                } as React.HTMLAttributes<HTMLVideoElement>)}
                                controlsList="nodownload noplaybackrate noremoteplayback"
                                disablePictureInPicture
                                disableRemotePlayback
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                {playbackSources.map((srcUrl, i) => (
                                    <source key={`${id}-${i}`} src={srcUrl} type="video/mp4" />
                                ))}
                            </video>
                            {isDesktop &&
                                showTapToUnmute &&
                                playing &&
                                episode?.lock === false &&
                                location.search.indexOf('auto_play=0') === -1 && (
                                    <div
                                        className="xgplayer-unmute"
                                        role="button"
                                        tabIndex={0}
                                        aria-label={intl.formatMessage({ id: 'video_tap_to_unmute' })}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTapToUnmute();
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleTapToUnmute();
                                            }
                                        }}
                                    >
                                        <span className="xgplayer-unmute-bt" aria-hidden="true">
                                            <FormattedMessage id="video_tap_to_unmute" />
                                        </span>
                                    </div>
                                )}
                            <div
                                className={cn(
                                    'absolute bottom-0 left-0 right-0 z-[5] mx-auto flex w-10/12 flex-col items-center justify-end gap-1 text-center pointer-events-none',
                                    isFullscreenUi ? 'pb-12' : 'pb-[124px]',
                                )}
                                ref={subtitleRef}
                            >
                                {subtitle > -1 && subtitlesRef.current.length > 0 && (
                                    <div className="video-player-subtitle-text text-white px-2 py-1 rounded-md text-2xl font-bold">
                                        {subtitlesRef.current[subtitle].text.replace(/<[^>]*>?/gm, '')}
                                    </div>
                                )}
                            </div>
                            <div
                                className={cn(
                                    'video-player-ui relative w-full h-full transition-opacity duration-300 ease-linear',
                                    /** 静音蒙层在 DOM 序在前；全屏控制器含 translateZ(0) 时会盖住蒙层并吞点击，需让事件穿透到 .xgplayer-unmute */
                                    showTapToUnmute && 'pointer-events-none',
                                )}
                                ref={controllerRef}
                                onMouseEnter={handleDesktopControllerMouseEnter}
                                onMouseLeave={handleDesktopControllerMouseLeave}
                            >
                                {canPlay &&
                                    episode?.lock === false &&
                                    !showTapToUnmute &&
                                    !playing && (
                                        <div
                                            className="w-20 h-20 rounded-full bg-black flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto cursor-pointer"
                                            onClick={handleTogglePlay}
                                        >
                                            <PlayIcon className="text-white w-10 h-10" />
                                        </div>
                                    )}
                                {episode?.lock === true && (
                                    <div className="absolute inset-0 flex-center flex-col leading-normal mb-6 text-sm px-8 md:px-[70px]">
                                        <img src={paidEpisodeLockIcon} alt="" className="h-16 w-16" />
                                        <p className="text-center text-[20px] font-bold text-white/90 mt-6 mb-10 w-[320px]">
                                            <FormattedMessage id="pay_unlock_toast_locked_episode" />
                                        </p>
                                        <div
                                            className="flex justify-center items-center p-4 px-12 gap-2 text-white text-xl rounded-full bg-linear-to-r from-amber-400 to-red-400 font-bold cursor-pointer"
                                            onClick={() => handleToggleUnlockEpisode(true)}
                                        >
                                            <Unlock className="w-5 h-5 stroke-4" />
                                            <div>
                                                <FormattedMessage id="unlock_now" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {episode?.lock === false && (
                                    <div
                                        className="absolute bg-black/30 w-full bottom-0 text-white h-[76px] overflow-hidden text-sm p-4 pt-0 flex gap-1 items-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleIntroduction();
                                        }}
                                    >
                                        {data.info.introduction ? (
                                            <>
                                                <div className="text-ellipsis line-clamp-3 leading-5 text-white/90">
                                                    {data.info.introduction}
                                                </div>
                                                <div>
                                                    <Forward />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-center items-center w-full">
                                                <FormattedMessage id="no_introduction_available" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {episode?.lock === false && (
                                    <div
                                        className="absolute bg-black/30 w-full mx-auto pl-4 pr-2 left-0 right-0 h-10 flex bottom-0 mb-[76px] items-center"
                                        ref={progressWrapRef}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {canPlay && (
                                            <button
                                                type="button"
                                                className="shrink-0 flex items-center justify-center border-0 bg-transparent px-2 py-0 mr-2 text-white cursor-pointer touch-manipulation"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTogglePlay(e);
                                                }}
                                            >
                                                {playing ? (
                                                    <Pause className="w-5 h-5" aria-hidden />
                                                ) : (
                                                    <PlayIcon className="w-5 h-5" aria-hidden />
                                                )}
                                            </button>
                                        )}
                                        <div
                                            className="flex-1 flex items-center justify-center"
                                            ref={progressRef}
                                            onMouseDown={handleProgressMouseDown}
                                            onMouseMove={handleProgressMouseMove}
                                            onMouseEnter={handleProgressMouseEnter}
                                            onMouseLeave={handleProgressMouseLeave}
                                            onTouchStart={handleProgressTouchStart}
                                            onTouchMove={handleProgressTouchMove}
                                        >
                                            <div className="video-player-progress-track w-full h-1 bg-white/50 rounded-full overflow-visible">
                                                <div className="bg-white/80 h-1 w-0 rounded-full relative" ref={progressCurrentRef}>
                                                    <span
                                                        className={cn(
                                                            'video-player-progress-thumb',
                                                            (progressHover || progressDragging) &&
                                                                'video-player-progress-thumb--visible',
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-white text-xs flex items-center justify-center pl-3 whitespace-nowrap text-nowrap">
                                            {current} / {duration}
                                        </div>
                                        <div
                                            className="text-white text-xs flex shrink-0 items-center justify-center pl-3 pr-2"
                                            onClick={handleSpeedControlClick}
                                        >
                                            {SPEED[speed]}x
                                        </div>
                                        {episode?.lock === false && (
                                            <button
                                                type="button"
                                                data-vertical-swipe-ignore
                                                className="shrink-0 flex items-center justify-center border-0 bg-transparent p-0 pl-3 pr-3 text-white cursor-pointer touch-manipulation"
                                                onClick={handleToggleVideoMute}
                                                aria-label={
                                                    videoMutedUi
                                                        ? intl.formatMessage({
                                                              id: 'video_sound_unmute',
                                                              defaultMessage: 'Unmute',
                                                          })
                                                        : intl.formatMessage({
                                                              id: 'video_sound_mute',
                                                              defaultMessage: 'Mute',
                                                          })
                                                }
                                            >
                                                {videoMutedUi ? (
                                                    <VolumeX className="w-5 h-5" aria-hidden />
                                                ) : (
                                                    <Volume2 className="w-5 h-5" aria-hidden />
                                                )}
                                            </button>
                                        )}
                                        {hasNextEpisode() && (
                                            <div
                                                className="video-player-next-episode-trigger text-white text-xs flex items-center justify-center px-2 cursor-pointer"
                                                onClick={(e) => void handleJumpNextEpisode(e)}
                                            >
                                                <img
                                                    src={nextEpisodeIcon}
                                                    alt="next episode"
                                                    className="video-player-next-episode-icon"
                                                />
                                            </div>
                                        )}
                                        <div
                                            className="text-white text-xs flex shrink-0 items-center justify-center px-2 cursor-pointer"
                                            onClick={handleToggleFullscreen}
                                        >
                                            {isFullscreenUi ? (
                                                <Minimize className="w-5 h-5" />
                                            ) : (
                                                <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            </div>
                            {!pcFullscreen && (
                                <div className="video-player-pc-close-btn" onClick={handleBack}>
                                    <img src={pcBackIcon} alt="back" className="w-6 h-6" />
                                </div>
                            )}
                        </div>
                        <VideoPlayerPcEpisodeAside
                            pcFullscreen={pcFullscreen}
                            onExitPcFullscreen={handleExitPcFullscreen}
                            currentEpisodeNo={currentEpisodeNo}
                            data={data}
                            viewerIsVip={userStore.isVIP()}
                            favorite={favorite}
                            onToggleFavorite={handleToggleFavorite}
                            onToggleVip={handleToggleVip}
                            onOpenShare={() => setShareOpen(true)}
                            tabRanges={tabRanges}
                            activeTab={activeTab}
                            onSelectEpisodeTab={setDesktopEpisodeTab}
                            filteredEpisodes={filteredEpisodes}
                            onSelectEpisodeByListIndex={handleSetEpisode}
                        />
                    </div>
                    <VideoPlayerEpisodeSpeedIntroDrawers
                        data={data}
                        episodeIndex={props.index}
                        staticBase={staticBase}
                        viewerIsVip={userStore.isVIP()}
                        episodeStatus={episodeStatus}
                        onToggleEpisodeDrawer={handleToggleEpisode}
                        episode={episode}
                        episodeRef={episodeRef}
                        onSelectEpisodeIndex={handleSetEpisode}
                        speedOpen={speedOpen}
                        onSpeedDrawerOpenChange={handleSpeedOpen}
                        speed={speed}
                        onSelectSpeed={handleSelectSpeed}
                        introduction={introduction}
                        onIntroductionOpenChange={handleIntroduction}
                        onCloseIntroductionLinks={() => setIntroduction(false)}
                    />
                    <VideoPlayerPcCommerceDialogs
                        vip={vip}
                        onVipOpenChange={setVip}
                        onVipEmbedClose={handleVipEmbedClose}
                        embedVideoEpisodeRowId={id}
                        onEmbedPaySuccessEpisodeDetail={handleEmbedPaySuccessEpisodeDetail}
                        vipHeaderEpisodeUnlockCoins={episode != null ? episode.unlock_coins : undefined}
                        shareOpen={shareOpen}
                        onShareOpenChange={setShareOpen}
                        shareEmbedCode={shareEmbedCode}
                        shareShowControls={shareShowControls}
                        onToggleShareShowControls={() => setShareShowControls((v) => !v)}
                        posterUrl={shareCardPosterUrl}
                        title={data.info.title}
                        introduction={data.info.introduction}
                        onShareAction={handleShareAction}
                        onCopyEmbedCode={handleCopyEmbedCode}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="video-player-root h-full w-full relative" ref={wrapRef}>
            <div className="h-full w-full relative opacity-100 transition-opacity duration-500">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover absolute"
                    playsInline
                    poster={videoPosterAttr}
                    preload={videoPreload}
                    {...({
                        fetchPriority: playbackPolicy === 'paused' ? 'low' : 'high',
                    } as React.HTMLAttributes<HTMLVideoElement>)}
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {playbackSources.map((srcUrl, i) => (
                        <source key={`${id}-${i}`} src={srcUrl} type="video/mp4" />
                    ))}
                </video>
                {!isDesktop &&
                    showH5FullscreenUnmuteOverlay && (
                        <button
                            type="button"
                            className="absolute inset-0 z-[25] flex cursor-pointer items-center justify-center border-0 bg-black/35 px-6 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleTapToUnmute();
                            }}
                            aria-label={intl.formatMessage({ id: 'video_tap_to_unmute' })}
                        >
                            <span
                                className="pointer-events-none rounded-full border border-white/15 bg-black/80 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
                                aria-hidden="true"
                            >
                                <FormattedMessage id="video_tap_to_unmute" />
                            </span>
                        </button>
                    )}
                <div
                    className={cn(
                        'absolute bottom-0 left-0 right-0 z-[5] mx-auto flex w-10/12 flex-col items-center justify-end gap-1 text-center pointer-events-none',
                        isFullscreenUi ? 'pb-12' : 'pb-[124px]',
                    )}
                    ref={subtitleRef}
                >
                    {subtitle > -1 && subtitlesRef.current.length > 0 && (
                        <div className="video-player-subtitle-text text-white px-2 py-1 rounded-md text-2xl font-bold">
                            {subtitlesRef.current[subtitle].text.replace(/<[^>]*>?/gm, '')}
                        </div>
                    )}
                </div>
                <div
                    className={cn(
                        'video-player-ui relative w-full h-full transition-opacity duration-300 ease-linear',
                        /** 与 PC 一致：静音蒙层出现时勿让全屏控制层挡在「取消静音」之上 */
                        showH5FullscreenUnmuteOverlay && 'pointer-events-none',
                    )}
                    ref={controllerRef}
                    onClick={handleControllerTouchStart}
                >
                    {!isFullscreenUi && (
                        <div
                            className="flex justify-between h-16 items-center bg-black absolute top-0 w-full transition-opacity ease-linear"
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div
                                onClick={handleBack}
                                className="text-white w-10 h-16 flex justify-center items-center shrink-0"
                            >
                                {canNavigateBack() ? (
                                    <ChevronLeft className="w-5 h-5" />
                                ) : (
                                    <Home className="w-5 h-5" />
                                )}
                            </div>
                            <div className="text-white text-lg font-bold text-ellipsis flex-1 whitespace-nowrap overflow-hidden pr-2">
                                {data.info.title}
                            </div>
                            <div className="text-white shrink-0 font-bold">
                                {episode?.episode ?? '..'} / {data.episodes.length}
                            </div>
                            <Link
                                to="/"
                                className="text-white w-10 h-16 flex justify-center items-center shrink-0"
                            >
                                <Home className="w-5 h-5" />
                            </Link>
                        </div>
                    )}
                    {canPlay &&
                        episode?.lock === false &&
                        !showH5FullscreenUnmuteOverlay &&
                        !playing && (
                            <div
                                className="w-20 h-20 rounded-full bg-black flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto cursor-pointer"
                                onClick={handleTogglePlay}
                            >
                                <PlayIcon className="text-white w-10 h-10" />
                            </div>
                        )}
                    {episode?.lock === true && (
                        <div>
                            <div
                                className="absolute top-0 left-0 right-0 bottom-0 m-auto h-16 flex justify-center items-center "
                                onClick={() => handleToggleUnlockEpisode(true)}
                            >
                                <div className="flex justify-center items-center p-4 px-12 gap-2 text-white text-xl rounded-full bg-linear-to-r from-amber-400 to-red-400 font-bold">
                                    <Unlock className="w-5 h-5 stroke-4" />
                                    <div>
                                        <FormattedMessage id="unlock_now" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isFullscreenUi && (
                        <div
                            className="w-10 h-36 absolute right-4 m-auto bottom-56 flex flex-col gap-4"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showController();
                            }}
                        >
                            <div
                                className={cn(
                                    'flex flex-col gap-1 items-center',
                                    userStore.signed && userStore.isVIP() && 'hidden',
                                )}
                                onClick={
                                    userStore.signed && userStore.isVIP()
                                        ? undefined
                                        : (e) => handleToggleVip(e)
                                }
                            >
                                <Crown className="w-8 h-8 text-[#ffd000] fill-[#ffd000]" />
                                <div className="h-4 leading-4 text-[#ffd000] text-xs text-center">
                                    <FormattedMessage id="shopping_vip_fab_label" />
                                </div>
                            </div>
                            <div
                                className="flex flex-col gap-1 items-center relative"
                                onClick={handleToggleFavorite}
                            >
                                <Star
                                    className={cn(
                                        'w-8 h-8 text-white fill-white',
                                        favorite && 'fill-[#ffd000] stroke-[#ffd000]',
                                    )}
                                />
                                <div className="h-4 leading-4 text-white text-xs text-center">
                                    {data.info.favorite}K
                                </div>
                            </div>
                            <div
                                className="flex flex-col gap-1 items-center"
                                onClick={handleToggleEpisode}
                            >
                                <LayoutGrid className="w-8 h-8 text-white fill-white" />
                                <div className="h-4 leading-4 text-white text-xs text-center">
                                    <FormattedMessage id="episode_list" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 items-center" onClick={() => setShareOpen(true)}>
                                <img src={shareEntryIcon} alt="" className="w-8 h-8" />
                                <div className="h-4 leading-4 text-white text-xs text-center">
                                    {intl.formatMessage({ id: 'share' })}
                                </div>
                            </div>
                        </div>
                    )}
                    {!isFullscreenUi && episode?.lock === false && (
                        <div
                            className="absolute bg-black/30 w-full bottom-0 text-white h-[76px] overflow-hidden text-sm p-4 pt-0 flex gap-1 items-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleIntroduction();
                            }}
                        >
                            {data.info.introduction ? (
                                <>
                                    <div className="text-ellipsis line-clamp-3 leading-5 text-white/90">
                                        {data.info.introduction}
                                    </div>
                                    <div>
                                        <Forward />
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-center items-center w-full">
                                    <FormattedMessage id="no_introduction_available" />
                                </div>
                            )}
                        </div>
                    )}
                    {episode?.lock === false && (
                        <div
                            className={cn(
                                'absolute bg-black/30 w-full mx-auto pl-4 pr-2 left-0 right-0 h-10 flex items-center bottom-0',
                                isFullscreenUi ? 'mb-0' : 'mb-[76px]',
                            )}
                            ref={progressWrapRef}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {canPlay && (
                                <button
                                    type="button"
                                    className="shrink-0 flex items-center justify-center border-0 bg-transparent px-2 py-0 mr-2 text-white cursor-pointer touch-manipulation"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePlay(e);
                                    }}
                                >
                                    {playing ? (
                                        <Pause className="w-5 h-5" aria-hidden />
                                    ) : (
                                        <PlayIcon className="w-5 h-5" aria-hidden />
                                    )}
                                </button>
                            )}
                            <div
                                className="flex-1 flex items-center justify-center"
                                ref={progressRef}
                                onMouseDown={handleProgressMouseDown}
                                onMouseMove={handleProgressMouseMove}
                                onMouseEnter={handleProgressMouseEnter}
                                onMouseLeave={handleProgressMouseLeave}
                                onTouchStart={handleProgressTouchStart}
                                onTouchMove={handleProgressTouchMove}
                            >
                                <div className="video-player-progress-track w-full h-1 bg-white/50 rounded-full overflow-visible">
                                    <div className="bg-white/80 h-1 w-0 rounded-full relative" ref={progressCurrentRef}>
                                        <span
                                            className={cn(
                                                'video-player-progress-thumb',
                                                (progressHover || progressDragging) &&
                                                    'video-player-progress-thumb--visible',
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="text-white text-xs flex items-center justify-center pl-4 whitespace-nowrap text-nowrap">
                                {current} / {duration}
                            </div>
                            <div
                                className="text-white text-xs flex shrink-0 items-center justify-center pl-4 pr-2"
                                onClick={handleSpeedControlClick}
                            >
                                {SPEED[speed]}x
                            </div>
                            {episode?.lock === false && (
                                <button
                                    type="button"
                                    data-vertical-swipe-ignore
                                    className="shrink-0 flex items-center justify-center border-0 bg-transparent p-0 pl-3 pr-4 text-white cursor-pointer touch-manipulation"
                                    onClick={handleToggleVideoMute}
                                    aria-label={
                                        videoMutedUi
                                            ? intl.formatMessage({
                                                  id: 'video_sound_unmute',
                                                  defaultMessage: 'Unmute',
                                              })
                                            : intl.formatMessage({
                                                  id: 'video_sound_mute',
                                                  defaultMessage: 'Mute',
                                              })
                                    }
                                >
                                    {videoMutedUi ? (
                                        <VolumeX className="w-5 h-5" aria-hidden />
                                    ) : (
                                        <Volume2 className="w-5 h-5" aria-hidden />
                                    )}
                                </button>
                            )}
                            {hasNextEpisode() && (
                                <div
                                    className="video-player-next-episode-trigger text-white text-xs flex items-center justify-center px-2 cursor-pointer"
                                    onClick={(e) => void handleJumpNextEpisode(e)}
                                >
                                    <img
                                        src={nextEpisodeIcon}
                                        alt="next episode"
                                        className="video-player-next-episode-icon"
                                    />
                                </div>
                            )}
                            <div
                                className="text-white text-xs flex shrink-0 items-center justify-center px-2 cursor-pointer"
                                onClick={handleToggleFullscreen}
                            >
                                {isFullscreenUi ? (
                                    <Minimize className="w-5 h-5" />
                                ) : (
                                    <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <VideoPlayerEpisodeSpeedIntroDrawers
                    data={data}
                    episodeIndex={props.index}
                    staticBase={staticBase}
                    viewerIsVip={userStore.isVIP()}
                    episodeStatus={episodeStatus}
                    onToggleEpisodeDrawer={handleToggleEpisode}
                    episode={episode}
                    episodeRef={episodeRef}
                    onSelectEpisodeIndex={handleSetEpisode}
                    speedOpen={speedOpen}
                    onSpeedDrawerOpenChange={handleSpeedOpen}
                    speed={speed}
                    onSelectSpeed={handleSelectSpeed}
                    introduction={introduction}
                    onIntroductionOpenChange={handleIntroduction}
                    onCloseIntroductionLinks={() => setIntroduction(false)}
                />
                <VideoPlayerH5CommerceDrawers
                    vip={vip}
                    onVipOpenChange={setVip}
                    onVipEmbedClose={handleVipEmbedClose}
                    embedVideoEpisodeRowId={id}
                    onEmbedPaySuccessEpisodeDetail={handleEmbedPaySuccessEpisodeDetail}
                    vipHeaderEpisodeUnlockCoins={episode != null ? episode.unlock_coins : undefined}
                    shareOpen={shareOpen}
                    onShareOpenChange={setShareOpen}
                    shareEmbedCode={shareEmbedCode}
                    shareShowControls={shareShowControls}
                    onToggleShareShowControls={() => setShareShowControls((v) => !v)}
                    onClearShareEmbedCode={() => setShareEmbedCode('')}
                    posterUrl={shareCardPosterUrl}
                    title={data.info.title}
                    onShareAction={handleShareAction}
                    onCopyEmbedCode={handleCopyEmbedCode}
                />
                {/* <UnlockEpisode
                    open={unlockEpisodeOpen}
                    coins={episode?.unlock_coins ?? 0}
                    onOpenChange={handleToggleUnlockEpisode}
                /> */}
            </div>
        </div>
    );
}
