import {
    Check,
    ChevronLeft,
    Crown,
    Home,
    LayoutGrid,
    LoaderCircle,
    Pause,
    PlayIcon,
    Star,
    Unlock,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { WebVTT } from 'videojs-vtt.js';
import { Swiper, SwiperSlide, type SwiperClass, type SwiperRef } from 'swiper/react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import lockIcon from '@/assets/lock.svg';
import episodeLockBadgeIcon from '@/assets/icons/episode-lock-badge.svg';
import activeEpisodeBadgeGif from '@/assets/images/f24458e0-c6ae-11f0-84ad-6b5693b490dc.gif';
import fullscreenIcon from '@/assets/images/is_full_screen_icon.88dfd7dd.png';
import nextEpisodeIcon from '@/assets/images/12164930-c692-11ef-a2d6-41216ff1602c.png';
import pcBackIcon from '@/assets/icons/video-pc-back.svg';
import pcFullscreenExitHandleBg from '@/assets/images/9061da60-c404-11ef-a2d6-41216ff1602c.png';
import paidEpisodeLockIcon from '@/assets/images/7f47ede0-ef83-11f0-84ad-6b5693b490dc.png';
import { cn } from '@/lib/utils';
import { toggleVideoFullscreen } from '@/lib/toggleFullscreen';
import { FormattedMessage, useIntl } from 'react-intl';
import RadixRc from '@/pages/user/RadixRc';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlinePlayerData, offlinePlayerEpisode } from '@/mocks/videoOffline';
import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';
import Loader from '@/components/Loader';
import { useUserStore } from '@/stores/user';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
// import UnlockEpisode from '@/widgets/UnlockEpisode';
import Forward from '@/components/Forward';
import Image from '@/components/Image';
// import { useLoadingStore } from "@/stores/loading";

const SPEED = [0.75, 1.0, 1.25, 1.5, 2.0];

function isOpaqueTagId(value: string) {
    return /^[a-f0-9]{10,}$/i.test(value);
}

function formatTagText(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (s) => s.toUpperCase());
}

function getTagDisplayText(tag: { name: string; unique_id: string }) {
    const name = String(tag.name ?? '').trim();
    const uid = String(tag.unique_id ?? '').trim();
    // 某些接口会把 name 返回为内部哈希ID，优先展示更可读的字段
    if (name && !isOpaqueTagId(name)) {
        return name;
    }
    if (uid && !isOpaqueTagId(uid)) {
        return formatTagText(uid);
    }
    return name || uid || '-';
}

export default function Component() {
    // const configStore = useConfigStore();
    const rootStore = useRootStore();
    const params = useParams();
    const navigate = useNavigate();
    const swiperRef = useRef<SwiperRef>(null);
    const [data, setData] = useState<IPlayerData>();
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [keepFullscreen, setKeepFullscreen] = useState(false);
    const fullscreenTargetRef = useRef<HTMLDivElement>(null);
    const suppressFullscreenExitUntilRef = useRef(0);
    const switchingEpisodeInFullscreenRef = useRef(false);

    function markFullscreenTransition() {
        if (!keepFullscreen) {
            return;
        }
        switchingEpisodeInFullscreenRef.current = true;
        suppressFullscreenExitUntilRef.current = Date.now() + 1800;
    }

    const handleEpisodeFullscreenReady = useCallback(() => {
        switchingEpisodeInFullscreenRef.current = false;
    }, []);

    const shouldIgnoreFullscreenExit = useCallback(
        () =>
            switchingEpisodeInFullscreenRef.current ||
            Date.now() <= suppressFullscreenExitUntilRef.current,
        [],
    );

    function handleSetEpisode(index: number) {
        if (swiperRef.current === null) {
            return;
        }
        markFullscreenTransition();
        if (index > (data?.episodes.length ?? 0) - 1) {
            index = (data?.episodes.length ?? 0) - 1;
        }
        if (index < 0) {
            index = 0;
        }
        swiperRef.current.swiper.slideTo(index, 0);
        setCurrent(index);
        navigate(`/video/${params['id']}/${index + 1}${location.search}`, {
            replace: true,
        });
    }

    function handleSlideChange(swiper: SwiperClass) {
        markFullscreenTransition();
        setCurrent(swiper.activeIndex);
        navigate(`/video/${params['id']}/${swiper.activeIndex + 1}${location.search}`, {
            replace: true,
        });
    }

    function handleAfterInit(swiper: SwiperClass) {
        let index = parseInt(params['index'] ?? '-1', 10);
        if (isNaN(index)) {
            return;
        }
        index -= 1;
        if (index < 0 || index >= (data?.episodes.length ?? 0)) {
            index = 0;
        }

        setCurrent(index);
        setInitialized(true);
        swiper.slideTo(index, 0);
    }

    async function loadData() {
        if (skipRemoteApi) {
            setData(offlinePlayerData);
            setLoading(false);
            return;
        }
        const result = await api<IPlayerData>('movie/info', {
            data: {
                id: params['id'],
            },
            loading: false,
        });
        if (result.c !== 0) {
            setLoading(false);
            return;
        }
        setData(result.d);
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        rootStore.setTheme('dark');
        return () => {
            rootStore.setTheme('light');
        };
    }, []);

    return loading ? (
        <div className="w-full h-full flex justify-center items-center">
            <Loader color="light" />
        </div>
    ) : (
        <div ref={fullscreenTargetRef} className="w-full h-full">
            <Swiper
                ref={swiperRef}
                slidesPerView={1}
                onSlideChange={handleSlideChange}
                onAfterInit={handleAfterInit}
                direction="vertical"
                touchStartPreventDefault={false}
                className="video-vertical-swiper w-full h-full overflow-hidden bg-black select-none"
            >
                {data?.episodes.map((v, k) => (
                    <SwiperSlide
                        key={v.id}
                        className={`w-full h-full bg-center bg-cover`}
                        // style={{
                        //     backgroundImage: `url('${configStore.config['static']}/${data.info.image}')`,
                        // }}
                    >
                        {current === k && initialized && (
                            <Player
                                id={v.id}
                                index={k}
                                data={data}
                                onSetEpisode={handleSetEpisode}
                                fullscreenTargetRef={fullscreenTargetRef}
                                shouldKeepFullscreen={keepFullscreen}
                                onFullscreenPrefChange={setKeepFullscreen}
                                onEpisodeFullscreenReady={handleEpisodeFullscreenReady}
                                shouldIgnoreFullscreenExit={shouldIgnoreFullscreenExit}
                            />
                        )}
                        {(current - 1 === k || current + 1 === k) && (
                            <div className="video-vertical-slide-label w-full h-full flex justify-center items-center text-2xl text-white">
                                <div>
                                    <FormattedMessage id="episode" /> {v.episode} /{' '}
                                    {data.episodes.length}
                                </div>
                            </div>
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}

function Player({
    id,
    data,
    onSetEpisode,
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
}) {
    // const loadingStore = useLoadingStore();
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
    const [waiting, setWaiting] = useState(true);
    const [current, setCurrent] = useState('00:00');
    const [duration, setDuration] = useState('00:00');
    const [subtitle, setSubtitle] = useState(-1);
    const [episode, setEpisode] = useState<IPlayerEpisode>();
    const [episodeStatus, setEpisodeStatus] = useState(false);
    const [favorite, setFavorite] = useState(data.info.is_favorite === 1);
    const [vip, setVip] = useState(false);
    const handleVipEmbedClose = useCallback(() => setVip(false), []);
    // const [unlockEpisodeOpen, setUnlockEpisodeOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [speedOpen, setSpeedOpen] = useState(false);
    const [speed, setSpeed] = useState(parseInt(localStorage.getItem('playback_speed') || '1', 10));
    const [introduction, setIntroduction] = useState(false);
    const isDesktop = useMinWidth768();
    const [desktopEpisodeTab, setDesktopEpisodeTab] = useState(0);
    const [pcFullscreen, setPcFullscreen] = useState(false);
    const [progressHover, setProgressHover] = useState(false);
    const [progressDragging, setProgressDragging] = useState(false);
    const progressActiveElementRef = useRef<HTMLDivElement | null>(null);
    const fullscreenRestoreInFlightRef = useRef(false);
    const fullscreenRestoreEpisodeRef = useRef<number | null>(null);
    const {
        fullscreenTargetRef,
        shouldKeepFullscreen,
        onFullscreenPrefChange,
        onEpisodeFullscreenReady,
        shouldIgnoreFullscreenExit,
    } = props;
    const isFullscreenUi = shouldKeepFullscreen || pcFullscreen;

    function getFullscreenElement() {
        const doc = document as Document & { webkitFullscreenElement?: Element | null };
        return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    }

    async function forceExitFullscreen() {
        const video = videoRef.current as (HTMLVideoElement & { webkitExitFullscreen?: () => void }) | null;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }
        if (video?.webkitExitFullscreen) {
            try {
                video.webkitExitFullscreen();
            } catch {
                // ignore
            }
        }
        if (doc.webkitExitFullscreen) {
            await Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
        }
        onFullscreenPrefChange(false);
        setPcFullscreen(false);
    }

    function handleBack() {
        if (window.history.length > 1) {
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

    function setProgress(value: number) {
        if (progressCurrentRef.current === null) {
            return;
        }
        if (videoRef.current === null) {
            return;
        }
        progressCurrentRef.current.style.width = `${value}%`;
        setCurrent(
            Math.floor(videoRef.current.currentTime / 60)
                .toString()
                .padStart(2, '0') +
                ':' +
                Math.floor(videoRef.current.currentTime % 60)
                    .toString()
                    .padStart(2, '0'),
        );
        setDuration(
            Math.floor(videoRef.current.duration / 60)
                .toString()
                .padStart(2, '0') +
                ':' +
                Math.floor(videoRef.current.duration % 60)
                    .toString()
                    .padStart(2, '0'),
        );
    }

    async function loadData(id: number, loading = false) {
        const applyEpisode = async (d: IPlayerEpisode) => {
            setLoading(false);
            setEpisode(d);

            if (!d.video) {
                setWaiting(false);
                return;
            }

            if (d.subtitle) {
                const subUrl =
                    d.subtitle.startsWith('http://') || d.subtitle.startsWith('https://')
                        ? d.subtitle
                        : `${configStore.config['static']}/${d.subtitle}`;
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
                        subtitlesRef.current = cues;
                    };
                    parser.parse(text);
                    parser.flush();
                } catch (e) {
                    subtitlesRef.current = [];
                    console.warn('[Video] subtitle load skipped (CORS/network/parse)', subUrl, e);
                }
            }

            if (!videoRef.current) {
                return;
            }

            const src =
                d.video.startsWith('http://') || d.video.startsWith('https://')
                    ? d.video
                    : `${configStore.config['static']}/${d.video}`;
            videoRef.current.src = src;
            videoRef.current.currentTime = 0;
            videoRef.current.playbackRate = SPEED[speed];
            if (location.search.indexOf('auto_play=0') === -1) {
                videoRef.current
                    .play()
                    .then(() => {
                        setPlaying(true);
                    })
                    .catch(() => {
                        console.log('自动播放失败');
                        showController(false);
                        setWaiting(false);
                        setCanPlay(true);
                    });
            }

            controllerTimerRef.current = window.setTimeout(() => {
                hideController();
            }, 10000);
        };

        if (skipRemoteApi) {
            await applyEpisode(offlinePlayerEpisode(id));
            return;
        }

        const result = await api<IPlayerEpisode>('movie/episode', {
            data: {
                id,
                auto_unlock: localStorage.getItem('auto_unlock') ?? 1,
            },
            loading,
        });

        if (result.c !== 0) {
            return;
        }

        await applyEpisode(result.d);
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
        if (!controllerIsShow.current) {
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

    function handleTogglePlay(e: React.MouseEvent<HTMLDivElement>) {
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

    async function handleToggleFullscreen(e: React.MouseEvent<HTMLDivElement>) {
        e.stopPropagation();
        const wasFullscreen = Boolean(getFullscreenElement());
        await toggleVideoFullscreen(videoRef, fullscreenTargetRef, { preferContainer: true });
        const nowFullscreen = Boolean(getFullscreenElement());
        // iOS video fullscreen 不一定挂到 document.fullscreenElement，先按用户操作意图兜底
        onFullscreenPrefChange(wasFullscreen ? false : true);
        setPcFullscreen(nowFullscreen);
        showController();
    }

    async function handleExitPcFullscreen() {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        }
    }

    useEffect(() => {
        loadData(id);
    }, [id]);

    useEffect(() => {
        if (loading) {
            return;
        }

        if (videoRef.current === null) {
            return;
        }

        if (progressWrapRef.current === null) {
            return;
        }

        const videoTimeUpdate = () => {
            if (videoRef.current === null) {
                return;
            }
            setProgress(
                Math.ceil((videoRef.current.currentTime / videoRef.current.duration) * 100),
            );
            for (let i = 0; i < subtitlesRef.current.length; i++) {
                if (
                    videoRef.current.currentTime >= subtitlesRef.current[i].startTime &&
                    videoRef.current.currentTime <= subtitlesRef.current[i].endTime
                ) {
                    if (subtitlesRef.current[i].text.trim() !== '') {
                        setSubtitle(i);
                    } else {
                        setSubtitle(-1);
                    }

                    break;
                } else {
                    setSubtitle(-1);
                }
            }
        };

        videoRef.current.addEventListener('timeupdate', videoTimeUpdate);

        const progressTouchMove = (e: TouchEvent) => {
            e.preventDefault();
        };

        progressWrapRef.current.addEventListener('touchmove', progressTouchMove);

        const videoEnded = () => {
            setPlaying(false);
            onSetEpisode(props.index + 1);
        };

        videoRef.current?.addEventListener('ended', videoEnded);

        const videoCanPlay = () => {
            setCanPlay(true);
            setWaiting(false);
            onEpisodeFullscreenReady();
        };

        videoRef.current?.addEventListener('canplay', videoCanPlay);

        const videoWaiting = () => {
            setWaiting(true);
        };

        videoRef.current?.addEventListener('waiting', videoWaiting);

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
            videoRef.current?.removeEventListener('timeupdate', videoTimeUpdate);
            videoRef.current?.removeEventListener('ended', videoEnded);
            videoRef.current?.removeEventListener('canplay', videoCanPlay);
            videoRef.current?.removeEventListener('waiting', videoWaiting);
            progressWrapRef.current?.removeEventListener('touchmove', progressTouchMove);
            window.removeEventListener('mouseup', mouseUp);
            window.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('touchmove', touchMoveWhenDrag);
            window.removeEventListener('touchend', touchEnd);
            window.removeEventListener('touchcancel', touchEnd);
        };
    }, [loading]);

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
        };
        const onWebkitEndFullscreen = () => {
            setPcFullscreen(false);
            if (!isDesktop && shouldKeepFullscreen) {
                return;
            }
            if (shouldIgnoreFullscreenExit()) {
                return;
            }
            onFullscreenPrefChange(false);
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
    }, [isDesktop, shouldKeepFullscreen, shouldIgnoreFullscreenExit, onFullscreenPrefChange]);

    useEffect(() => {
        fullscreenRestoreInFlightRef.current = false;
        fullscreenRestoreEpisodeRef.current = null;
    }, [id]);

    useEffect(() => {
        if (!shouldKeepFullscreen) {
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
        void toggleVideoFullscreen(videoRef, fullscreenTargetRef, { preferContainer: true })
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
    ]);

    if (isDesktop) {
        const currentEpisodeNo = episode?.episode ?? props.index + 1;
        const maxEpisode = data.episodes.reduce((m, v) => Math.max(m, v.episode), 0);
        const tabRanges = Array.from({ length: Math.ceil((maxEpisode + 1) / 50) }, (_, i) => {
            const start = i * 50;
            const end = Math.min(start + 49, maxEpisode);
            return { start, end };
        });
        const activeTab = Math.min(desktopEpisodeTab, Math.max(0, tabRanges.length - 1));
        const selectedRange = tabRanges[activeTab] ?? { start: 0, end: maxEpisode };
        const filteredEpisodes = data.episodes.filter((v) => {
            if (selectedRange.start === 0) return v.episode >= 1 && v.episode <= selectedRange.end;
            return v.episode >= selectedRange.start && v.episode <= selectedRange.end;
        });

        return (
            <div className="video-player-root h-full w-full relative" ref={wrapRef}>
                {loading && (
                    <div className="h-full w-full flex flex-col">
                        <div
                            className="shrink-0 flex justify-between h-16 items-center bg-black absolute top-0 w-full transition-opacity ease-linear"
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div
                                onClick={handleBack}
                                className="text-white w-10 h-16 flex justify-center items-center shrink-0"
                            >
                                {history.length > 1 ? (
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
                        <div className="flex-1 flex justify-center items-center">
                            <Loader color="light" />
                        </div>
                    </div>
                )}
                <div
                    className={cn(
                        'h-full w-full relative opacity-0 transition-opacity duration-500',
                        loading ? '' : 'opacity-100',
                    )}
                >
                    <div className="absolute inset-0 flex bg-black">
                        <div className="relative flex-1 flex justify-center items-center bg-black">
                            {!pcFullscreen && (
                                <div className="video-player-pc-close-btn" onClick={handleBack}>
                                    <img src={pcBackIcon} alt="back" className="w-6 h-6" />
                                </div>
                            )}
                            <div className="relative h-full max-h-full aspect-[9/16] w-auto max-w-full overflow-hidden">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover absolute"
                                playsInline
                                controlsList="nodownload noplaybackrate noremoteplayback"
                                disablePictureInPicture
                                disableRemotePlayback
                                onContextMenu={(e) => e.preventDefault()}
                            />
                            <div
                                className="absolute w-10/12 h-4/12 m-auto left-0 right-0 bottom-10 flex justify-center items-start text-center"
                                ref={subtitleRef}
                            >
                                {subtitle > -1 && subtitlesRef.current.length > 0 && (
                                    <div className="video-player-subtitle-text text-white px-2 py-1 rounded-md text-2xl font-bold">
                                        {subtitlesRef.current[subtitle].text.replace(/<[^>]*>?/gm, '')}
                                    </div>
                                )}
                            </div>
                            <div
                                className="video-player-ui relative w-full h-full transition-opacity duration-300 ease-linear"
                                ref={controllerRef}
                                onMouseEnter={handleDesktopControllerMouseEnter}
                                onMouseLeave={handleDesktopControllerMouseLeave}
                            >
                                {canPlay && episode?.lock === false && (
                                    <div
                                        className="w-20 h-20 rounded-full bg-black flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto"
                                        onClick={handleTogglePlay}
                                    >
                                        {playing ? (
                                            <Pause className="text-white w-10 h-10" />
                                        ) : (
                                            <PlayIcon className="text-white w-10 h-10" />
                                        )}
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
                                            {current === 'NaN:NaN' ? '00:00' : current} /{' '}
                                            {duration === 'NaN:NaN' ? '00:00' : duration}
                                        </div>
                                        <div
                                            className="text-white text-xs flex items-center justify-center px-3"
                                            onClick={handleSpeedControlClick}
                                        >
                                            {SPEED[speed]}x
                                        </div>
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
                                            className="text-white text-xs flex items-center justify-center px-3 cursor-pointer"
                                            onClick={handleToggleFullscreen}
                                        >
                                            <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {waiting && (
                                <div className="w-10 h-10 pointer-events-none rounded-full flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto animate-[spin_1.5s_ease_infinite]">
                                    <LoaderCircle className="w-8 h-8 text-slate-100" />
                                </div>
                            )}
                            </div>
                        </div>
                        <aside
                            className={cn(
                                'w-[480px] h-full border-l border-white/20 bg-black transition-transform duration-500 ease-in-out',
                                pcFullscreen ? 'translate-x-full absolute right-0 top-0' : 'translate-x-0 relative',
                            )}
                        >
                            {pcFullscreen && (
                                <div
                                    className="absolute top-1/2 h-[122px] w-[34px] cursor-pointer bg-cover transition-all duration-300 -left-[34px] -translate-y-1/2"
                                    style={{ backgroundImage: `url(${pcFullscreenExitHandleBg})` }}
                                    onClick={() => {
                                        void handleExitPcFullscreen();
                                    }}
                                />
                            )}
                            <div className="h-full w-[480px] overflow-y-auto px-[30px] pb-[30px] pt-[24px]">
                                <nav aria-label="Breadcrumb" className="text-white/50 flex text-[14px] leading-normal mb-[24px]">
                                    <Link to="/">
                                        <FormattedMessage id="home" />
                                    </Link>
                                    <span className="mx-2">/</span>
                                    <span className="max-w-[180px] line-clamp-1 break-all text-white">
                                        Episode {currentEpisodeNo}
                                    </span>
                                </nav>
                                <h1 className="line-clamp-2 break-words text-[24px] font-bold leading-[1.2]">
                                    Episode {currentEpisodeNo} - {data.info.title} Full Movie
                                </h1>
                                <h3 className="line-clamp-2 mt-[24px] font-normal text-[18px]">
                                    Plot of Episode {currentEpisodeNo}
                                </h3>
                                <div className="mt-[8px] break-words text-[14px] text-white/50 leading-[1.5] line-clamp-3">
                                    {data.info.introduction}
                                </div>
                                <div className="flex flex-wrap overflow-hidden max-h-none mt-[16px]">
                                    {data.tags.map((v) => (
                                        <div
                                            key={v.name}
                                            className="mr-[10px] mb-[10px] text-[12px] line-clamp-1 break-all max-w-[152px] px-[8px] h-[27px] leading-[27px] rounded-[3px] text-white/90 bg-white/10"
                                        >
                                            {getTagDisplayText(v)}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-[14px] h-[90px] border-t border-white/20">
                                    <div className="h-full w-full grid grid-cols-3 items-center">
                                        <div
                                            className="flex flex-col cursor-pointer items-center text-white/90 md:text-white/70"
                                            onClick={handleToggleFavorite}
                                        >
                                            <div className="flex text-[32px]">
                                                <Star className={cn('w-8 h-8 text-white fill-white', favorite && 'fill-[#ffd000] stroke-[#ffd000]')} />
                                            </div>
                                            <span className="flex mt-[4px] text-[14px]">{data.info.favorite}K</span>
                                        </div>
                                        <div
                                            className="flex flex-col cursor-pointer items-center text-white/90 md:text-white/70"
                                            onClick={(e) => handleToggleVip(e)}
                                        >
                                            <div className="flex text-[32px]">
                                                <Crown className="w-8 h-8 text-[#ffd000] fill-[#ffd000]" />
                                            </div>
                                            <span className="flex mt-[4px] text-[14px]">VIP</span>
                                        </div>
                                        <div />
                                    </div>
                                </div>
                                <div className="border-t border-white/20 pt-[24px]">
                                    <div className="flex text-[16px] text-white/50">
                                        {tabRanges.map((r, idx) => (
                                            <div
                                                key={`${r.start}-${r.end}`}
                                                className={cn(
                                                    'min-w-[35px] text-center cursor-pointer',
                                                    idx === 0 ? '' : 'ml-[25px]',
                                                    idx === activeTab && 'text-[#E52E2E] relative',
                                                )}
                                                onClick={() => setDesktopEpisodeTab(idx)}
                                            >
                                                {r.start} - {r.end}
                                                {idx === activeTab && (
                                                    <span className="absolute -bottom-[8px] left-1/2 -ml-[10px] w-[20px] h-[3px] bg-[#E52E2E] rounded-[2px]" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-[23px] grid grid-cols-6 gap-[8px] overflow-hidden">
                                        {filteredEpisodes.map((v) => {
                                            const rawIndex = data.episodes.findIndex((e) => e.id === v.id);
                                            const locked = v.vip !== 0 && v.locked === 1;
                                            return (
                                                <div
                                                    key={v.id}
                                                    onClick={() => handleSetEpisode(rawIndex)}
                                                    className={cn(
                                                        'video-pc-episode-btn flex items-center justify-center w-full h-[46px] bg-white/10 text-[16px] text-white/90 rounded-[4px] cursor-pointer relative',
                                                        v.episode === currentEpisodeNo &&
                                                            'video-pc-episode-btn--active text-[14px] text-white/50 font-medium',
                                                    )}
                                                >
                                                    {v.episode}
                                                    {v.episode === currentEpisodeNo && (
                                                        <div className="absolute right-[2px] bottom-[2px] flex w-[12px] h-[12px]">
                                                            <img
                                                                alt=""
                                                                src={activeEpisodeBadgeGif}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                    {locked && (
                                                        <div className="absolute right-0 top-0 w-4 h-3 bg-[#e52e2e] rounded-[0_6px_0_6px] flex items-center justify-center">
                                                            <img src={episodeLockBadgeIcon} alt="" className="w-2.5 h-2.5" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                    <Drawer open={episodeStatus} onOpenChange={() => handleToggleEpisode()}>
                        <DrawerContent className="bg-slate-800" aria-describedby="Episode">
                            <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                                <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                    {data.info.title}
                                </div>
                                <div onClick={handleToggleEpisode}>
                                    <X />
                                </div>
                            </DrawerTitle>
                            <DrawerDescription className="text-slate-300 px-4 text-sm pt-1 line-clamp-2 overflow-hidden text-ellipsis">
                                <FormattedMessage id="episode" /> {episode?.episode} /{' '}
                                {data.episodes.length}
                            </DrawerDescription>
                            <div className="border-t border-slate-700 mt-4" />
                            <div
                                className="gap-2 p-4 text-white h-[45vh] overflow-auto grid grid-cols-6"
                                ref={episodeRef}
                            >
                                {data.episodes.map((v, k) => (
                                    <div
                                        data-episode={v.episode}
                                        onClick={() => handleSetEpisode(k)}
                                        key={v.id}
                                        className={cn(
                                            'bg-slate-600 rounded-md relative pb-[100%]',
                                            v.episode === episode?.episode && 'bg-red-400',
                                        )}
                                    >
                                        <div className="font-bold absolute w-full h-full flex justify-center items-center">
                                            {k + 1}
                                        </div>
                                        {v.vip !== 0 && v.locked === 1 && (
                                            <div className="absolute text-white top-1 right-1">
                                                <img src={lockIcon} alt="" className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="h-4" />
                        </DrawerContent>
                    </Drawer>
                    <Drawer open={speedOpen} onOpenChange={handleSpeedOpen}>
                        <DrawerContent className="bg-slate-800" aria-describedby="PlaybackSpeed">
                            <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                                <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                    <FormattedMessage id="playback_speed" />
                                </div>
                                <div onClick={() => handleSpeedOpen()}>
                                    <X />
                                </div>
                            </DrawerTitle>
                            <div className="border-t border-slate-700 mt-4" />
                            <div className="flex flex-col gap-2 p-4 text-white">
                                {SPEED.map((v, k) => (
                                    <div
                                        key={k}
                                        className="py-2 flex justify-between"
                                        onClick={() => handleSelectSpeed(k)}
                                    >
                                        <div>{v.toFixed(2)} x</div>
                                        <div
                                            className={cn(
                                                'rounded-full w-6 h-6 flex justify-center items-center',
                                                speed === k ? 'bg-red-400' : 'bg-slate-50/10',
                                            )}
                                        >
                                            {speed === k && <Check className="w-4 h-4" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="h-4" />
                        </DrawerContent>
                    </Drawer>
                    <Drawer open={introduction} onOpenChange={handleIntroduction}>
                        <DrawerContent className="bg-slate-800 video-intro-drawer" aria-describedby="Introduction">
                            <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                                <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                    <FormattedMessage id="introduction" />
                                </div>
                                <div onClick={handleIntroduction}>
                                    <X />
                                </div>
                            </DrawerTitle>
                            <div className="border-t border-slate-700 mt-4" />
                            <div className="flex flex-col gap-4 p-4 text-white">
                                <div className="flex gap-4">
                                    <div className="w-28 shrink-0">
                                        <Image
                                            height={1.3325}
                                            src={`${configStore.config['static']}/${data.info.image}`}
                                            alt={data.info.title}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="font-bold line-clamp-2 overflow-ellipsis text-slate-300">
                                            {data.info.title}
                                        </div>
                                        <div className='text-sm text-slate-400 mb-1'>
                                            <FormattedMessage id="episode"/>: {props.index + 1} / {data.episodes.length}
                                        </div>
                                        <div className="flex gap-1 flex-wrap text-sm ">
                                            {data.tags.map((v) => (
                                                <div
                                                    key={v.name}
                                                    className="bg-slate-600 px-2 py-1 rounded-sm text-slate-300"
                                                >
                                                    {v.unique_id.split('').map((v, k) => {
                                                        if (k === 0) {
                                                            v = v.toUpperCase();
                                                        }
                                                        if (v === '_') {
                                                            v = ' ';
                                                        }
                                                        return v;
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-md text-slate-300">{data.info.introduction}</div>
                            </div>
                            <div className="h-4" />
                        </DrawerContent>
                    </Drawer>
                    <Dialog open={vip} onOpenChange={setVip}>
                        <DialogContent
                            contentPreset="plain"
                            hideCloseButton
                            className="video-vip-dialog w-[min(100%,620px)] max-w-[calc(100vw-32px)] h-[min(88vh,840px)]"
                        >
                            <div className="h-full w-full overflow-hidden rounded-[16px] border border-white/10 bg-[#141414] text-white">
                                <DialogTitle className="sr-only" unsetTypography>
                                    {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                                </DialogTitle>
                                <div className="h-full overflow-y-auto">
                                    {vip ? (
                                        <RadixRc
                                            layout="embed"
                                            productFrom="video"
                                            checkoutFrom="video"
                                            onEmbedClose={handleVipEmbedClose}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        );
    }

    return (
        <div className="video-player-root h-full w-full relative" ref={wrapRef}>
            {loading && (
                <div className="h-full w-full flex flex-col">
                    <div
                        className="shrink-0 flex justify-between h-16 items-center bg-black absolute top-0 w-full transition-opacity ease-linear"
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <div
                            onClick={handleBack}
                            className="text-white w-10 h-16 flex justify-center items-center shrink-0"
                        >
                            {history.length > 1 ? (
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
                    <div className="flex-1 flex justify-center items-center">
                        <Loader color="light" />
                    </div>
                </div>
            )}
            <div
                className={cn(
                    'h-full w-full relative opacity-0 transition-opacity duration-500',
                    loading ? '' : 'opacity-100',
                )}
            >
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover absolute"
                    playsInline
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    onContextMenu={(e) => e.preventDefault()}
                />
                <div
                    className="absolute w-10/12 h-4/12 m-auto left-0 right-0 bottom-10 flex justify-center items-start text-center"
                    ref={subtitleRef}
                >
                    {subtitle > -1 && subtitlesRef.current.length > 0 && (
                        <div className="video-player-subtitle-text text-white px-2 py-1 rounded-md text-2xl font-bold">
                            {subtitlesRef.current[subtitle].text.replace(/<[^>]*>?/gm, '')}
                        </div>
                    )}
                </div>
                <div
                    className="video-player-ui relative w-full h-full transition-opacity duration-300 ease-linear"
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
                                {history.length > 1 ? (
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
                    {canPlay && episode?.lock === false && (
                        <div
                            className="w-20 h-20 rounded-full bg-black flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto"
                            onClick={handleTogglePlay}
                        >
                            {playing ? (
                                <Pause className="text-white w-10 h-10" />
                            ) : (
                                <PlayIcon className="text-white w-10 h-10" />
                            )}
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
                                'absolute bg-black/30 w-full mx-auto pl-4 pr-2 left-0 right-0 h-10 flex bottom-0',
                                isFullscreenUi ? 'mb-0' : 'mb-[76px]',
                            )}
                            ref={progressWrapRef}
                            onClick={(e) => e.stopPropagation()}
                        >
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
                                {current === 'NaN:NaN' ? '00:00' : current} /{' '}
                                {duration === 'NaN:NaN' ? '00:00' : duration}
                            </div>
                            <div
                                className="text-white text-xs flex items-center justify-center px-4"
                                onClick={handleSpeedControlClick}
                            >
                                {SPEED[speed]}x
                            </div>
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
                                className="text-white text-xs flex items-center justify-center px-4 cursor-pointer"
                                onClick={handleToggleFullscreen}
                            >
                                <img src={fullscreenIcon} alt="" className="w-5 h-5" />
                            </div>
                        </div>
                    )}
                </div>
                {waiting && (
                    <div className="w-10 h-10 pointer-events-none rounded-full flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto animate-[spin_1.5s_ease_infinite]">
                        <LoaderCircle className="w-8 h-8 text-slate-100" />
                    </div>
                )}
                <Drawer open={episodeStatus} onOpenChange={() => handleToggleEpisode()}>
                    <DrawerContent className="bg-slate-800" aria-describedby="Episode">
                        <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                            <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                {data.info.title}
                            </div>
                            <div onClick={handleToggleEpisode}>
                                <X />
                            </div>
                        </DrawerTitle>
                        <DrawerDescription className="text-slate-300 px-4 text-sm pt-1 line-clamp-2 overflow-hidden text-ellipsis">
                            <FormattedMessage id="episode" /> {episode?.episode} /{' '}
                            {data.episodes.length}
                        </DrawerDescription>
                        <div className="border-t border-slate-700 mt-4" />
                        <div
                            className="gap-2 p-4 text-white h-[45vh] overflow-auto grid grid-cols-6"
                            ref={episodeRef}
                        >
                            {data.episodes.map((v, k) => (
                                <div
                                    data-episode={v.episode}
                                    onClick={() => handleSetEpisode(k)}
                                    key={v.id}
                                    className={cn(
                                        'bg-slate-600 rounded-md relative pb-[100%]',
                                        v.episode === episode?.episode && 'bg-red-400',
                                    )}
                                >
                                    <div className="font-bold absolute w-full h-full flex justify-center items-center">
                                        {k + 1}
                                    </div>
                                    {v.vip !== 0 && v.locked === 1 && (
                                        <div className="absolute text-white top-1 right-1">
                                            <img src={lockIcon} alt="" className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="h-4" />
                    </DrawerContent>
                </Drawer>
                <Drawer open={speedOpen} onOpenChange={handleSpeedOpen}>
                    <DrawerContent className="bg-slate-800" aria-describedby="PlaybackSpeed">
                        <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                            <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                <FormattedMessage id="playback_speed" />
                            </div>
                            <div onClick={() => handleSpeedOpen()}>
                                <X />
                            </div>
                        </DrawerTitle>
                        <div className="border-t border-slate-700 mt-4" />
                        <div className="flex flex-col gap-2 p-4 text-white">
                            {SPEED.map((v, k) => (
                                <div
                                    key={k}
                                    className="py-2 flex justify-between"
                                    onClick={() => handleSelectSpeed(k)}
                                >
                                    <div>{v.toFixed(2)} x</div>
                                    <div
                                        className={cn(
                                            'rounded-full w-6 h-6 flex justify-center items-center',
                                            speed === k ? 'bg-red-400' : 'bg-slate-50/10',
                                        )}
                                    >
                                        {speed === k && <Check className="w-4 h-4" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="h-4" />
                    </DrawerContent>
                </Drawer>
                <Drawer open={introduction} onOpenChange={handleIntroduction}>
                    <DrawerContent className="bg-slate-800 video-intro-drawer" aria-describedby="Introduction">
                        <DrawerTitle className="flex items-center gap-4 text-white px-4 pt-4">
                            <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                <FormattedMessage id="introduction" />
                            </div>
                            <div onClick={handleIntroduction}>
                                <X />
                            </div>
                        </DrawerTitle>
                        <div className="border-t border-slate-700 mt-4" />
                        <div className="flex flex-col gap-4 p-4 text-white">
                            <div className="flex gap-4">
                                <div className="w-28 shrink-0">
                                    <Image
                                        height={1.3325}
                                        src={`${configStore.config['static']}/${data.info.image}`}
                                        alt={data.info.title}
                                    />
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="font-bold line-clamp-2 overflow-ellipsis text-slate-300">
                                        {data.info.title}
                                    </div>
                                    <div className='text-sm text-slate-400 mb-1'>
                                        <FormattedMessage id="episode"/>: {props.index + 1} / {data.episodes.length}
                                    </div>
                                    <div className="flex gap-1 flex-wrap text-sm ">
                                        {data.tags.map((v) => (
                                            <div
                                                key={v.name}
                                                className="bg-slate-600 px-2 py-1 rounded-sm text-slate-300"
                                            >
                                                {v.unique_id.split('').map((v, k) => {
                                                    if (k === 0) {
                                                        v = v.toUpperCase();
                                                    }
                                                    if (v === '_') {
                                                        v = ' ';
                                                    }
                                                    return v;
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-md text-slate-300">{data.info.introduction}</div>
                        </div>
                        <div className="h-4" />
                    </DrawerContent>
                </Drawer>
                <Drawer open={vip} onOpenChange={setVip} disablePreventScroll>
                    <DrawerContent
                        handler
                        className="rs-shopping-checkout-drawer rs-shopping-checkout-drawer--vipNoScroll rs-shopping-drawer-bg flex min-h-0 flex-col border-t border-white/10 p-0 text-white max-h-[min(98vh,1040px)] overflow-y-visible"
                    >
                        <DrawerTitle className="sr-only">
                            {intl.formatMessage({ id: 'shopping_vip_drawer_title' })}
                        </DrawerTitle>
                        <div className="rs-shopping-checkout-drawer__scroll rs-shopping-checkout-drawer__scroll--reelshort">
                            {vip ? (
                                <RadixRc
                                    layout="embed"
                                    productFrom="video"
                                    checkoutFrom="video"
                                    onEmbedClose={handleVipEmbedClose}
                                />
                            ) : null}
                        </div>
                    </DrawerContent>
                </Drawer>
                {/* <UnlockEpisode
                    open={unlockEpisodeOpen}
                    coins={episode?.unlock_coins ?? 0}
                    onOpenChange={handleToggleUnlockEpisode}
                /> */}
            </div>
        </div>
    );
}
