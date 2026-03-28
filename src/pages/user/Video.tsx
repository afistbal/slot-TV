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
import { useEffect, useRef, useState } from 'react';
import { WebVTT } from 'videojs-vtt.js';
import { Swiper, SwiperSlide, type SwiperClass, type SwiperRef } from 'swiper/react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import lockIcon from '@/assets/lock.svg';
import { cn } from '@/lib/utils';
import Vip from '@/widgets/Vip';
import { FormattedMessage } from 'react-intl';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '@/api';
import Loader from '@/components/Loader';
import { useUserStore } from '@/stores/user';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
// import UnlockEpisode from '@/widgets/UnlockEpisode';
import Forward from '@/components/Forward';
import Image from '@/components/Image';
// import { useLoadingStore } from "@/stores/loading";

const SPEED = [0.75, 1.0, 1.25, 1.5, 2.0];

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

    function handleSetEpisode(index: number) {
        if (swiperRef.current === null) {
            return;
        }
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

    function handleReload() {
        setLoading(true);
        setData(undefined);
        loadData();
    }

    async function loadData() {
        let result = await api<IPlayerData>('movie/info', {
            data: {
                id: params['id'],
            },
            loading: false,
        });
        if (result.c !== 0) {
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
        <Swiper
            ref={swiperRef}
            slidesPerView={1}
            onSlideChange={handleSlideChange}
            onAfterInit={handleAfterInit}
            direction="vertical"
            touchStartPreventDefault={false}
            className="w-full h-full overflow-hidden bg-black/90 select-none"
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
                            onReload={handleReload}
                        />
                    )}
                    {(current - 1 === k || current + 1 === k) && (
                        <div className="w-full h-full flex justify-center items-center text-2xl text-shadow-2xs text-shadow-border text-white">
                            <div>
                                <FormattedMessage id="episode" /> {v.episode} /{' '}
                                {data.episodes.length}
                            </div>
                        </div>
                    )}
                </SwiperSlide>
            ))}
        </Swiper>
    );
}

interface IPlayerData {
    info: {
        id: number;
        title: string;
        image: string;
        favorite: number;
        is_favorite: number;
        introduction: string;
    };
    tags: {
        name: string;
        unique_id: string;
    }[];
    episodes: {
        id: number;
        episode: number;
        vip: number;
        locked: number;
    }[];
}

interface IPlayerEpisode {
    id: number;
    episode: number;
    video: string;
    subtitle: string;
    lock: boolean;
    unlock_coins: number;
    can_unlock: boolean;
}

function Player({
    id,
    data,
    onSetEpisode,
    onReload,
    ...props
}: {
    id: number;
    index: number;
    data: IPlayerData;
    onSetEpisode: (index: number) => void;
    onReload: () => void;
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
    // const [unlockEpisodeOpen, setUnlockEpisodeOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [speedOpen, setSpeedOpen] = useState(false);
    const [speed, setSpeed] = useState(parseInt(localStorage.getItem('playback_speed') || '1', 10));
    const [introduction, setIntroduction] = useState(false);

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

        setLoading(false);
        setEpisode(result.d);

        if (!result.d.video) {
            setWaiting(false);
            return;
        }

        if (result.d.subtitle) {
            await fetch(`${configStore.config['static']}/${result.d.subtitle}`)
                .then((res) => res.text())
                .then((text) => {
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
                });
        }

        if (!videoRef.current) {
            return;
        }

        videoRef.current.src = `${configStore.config['static']}/${result.d.video}`;
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
    }

    function handleSetEpisode(index: number) {
        onSetEpisode(index);
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

        api('movie/favorite', {
            method: 'post',
            data: {
                id: data.info.id,
                time: videoRef.current?.currentTime,
            },
            loading: false,
        });

        setFavorite(!favorite);
    }

    function handleToggleVip() {
        if (!controllerIsShow.current && !vip) {
            return;
        }

        setVip(!vip);
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
        showController();
        progressDragStartRef.current = true;
        let width = x - element.offsetLeft - (progressWrapRef.current?.offsetLeft ?? 0);
        if (width < 0) {
            width = 0;
        } else if (width > element.clientWidth) {
            width = element.clientWidth;
        }
        progressCurrentRef.current!.style.width = `${width}px`;
        videoRef.current.currentTime = (width / element.clientWidth) * videoRef.current.duration;
    }

    function processTouchMove(element: HTMLDivElement, x: number) {
        if (!controllerIsShow.current) {
            return;
        }
        if (!videoRef.current) {
            return;
        }
        if (!progressDragStartRef.current) {
            return;
        }
        showController();
        let width = x - element.offsetLeft - (progressWrapRef.current?.offsetLeft ?? 0);
        if (width < 0) {
            width = 0;
        } else if (width > element.clientWidth) {
            width = element.clientWidth;
        }
        progressCurrentRef.current!.style.width = `${width}px`;
        videoRef.current.currentTime = (width / element.clientWidth) * videoRef.current.duration;
    }

    function handleProgressTouchStart(e: React.TouchEvent<HTMLDivElement>) {
        processTouchStart(e.currentTarget as HTMLDivElement, e.touches[0].clientX);
    }

    function handleProgressTouchMove(e: React.TouchEvent<HTMLDivElement>) {
        processTouchMove(e.currentTarget as HTMLDivElement, e.touches[0].clientX);
    }

    function handleProgressMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        processTouchStart(
            e.currentTarget as HTMLDivElement,
            e.clientX - (document.documentElement.clientWidth - document.body.clientWidth) / 2,
        );
    }

    function handleProgressMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        processTouchMove(
            e.currentTarget as HTMLDivElement,
            e.clientX - (document.documentElement.clientWidth - document.body.clientWidth) / 2,
        );
    }

    function handleSpeedOpen() {
        setSpeedOpen(!speedOpen);
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

    function handleIntroduction() {
        setIntroduction(!introduction);
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
        };

        videoRef.current?.addEventListener('canplay', videoCanPlay);

        const videoWaiting = () => {
            setWaiting(true);
        };

        videoRef.current?.addEventListener('waiting', videoWaiting);

        const mouseUp = () => {
            progressDragStartRef.current = false;
        };
        window.addEventListener('mouseup', mouseUp);
        window.addEventListener('touchend', mouseUp);

        return () => {
            videoRef.current?.removeEventListener('timeupdate', videoTimeUpdate);
            videoRef.current?.removeEventListener('ended', videoEnded);
            videoRef.current?.removeEventListener('canplay', videoCanPlay);
            videoRef.current?.removeEventListener('wating', videoWaiting);
            progressWrapRef.current?.removeEventListener('touchmove', progressTouchMove);
            window.removeEventListener('mouseup', mouseUp);
            window.removeEventListener('touchend', mouseUp);
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

        () => {
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
            setVip(true);
        }
    }, [episode]);

    return (
        <div className="h-full w-full relative" ref={wrapRef}>
            {loading && (
                <div className="h-full w-full flex flex-col">
                    <div
                        className="shrink-0 flex justify-between h-16 items-center bg-black/50 absolute top-0 w-full transition-opacity ease-linear"
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
                <video ref={videoRef} className="w-full h-full object-contain absolute" playsInline />
                <div
                    className="absolute w-10/12 h-4/12 m-auto left-0 right-0 bottom-10 flex justify-center items-start text-center"
                    ref={subtitleRef}
                >
                    {subtitle > -1 && subtitlesRef.current.length > 0 && (
                        <div className="text-white px-2 py-1 rounded-md text-shadow-[0px_0px_4px_black] text-2xl font-bold">
                            {subtitlesRef.current[subtitle].text.replace(/<[^>]*>?/gm, '')}
                        </div>
                    )}
                </div>
                <div
                    className="relative w-full h-full"
                    ref={controllerRef}
                    onClick={handleControllerTouchStart}
                >
                    <div
                        className="flex justify-between h-16 items-center bg-black/50 absolute top-0 w-full transition-opacity ease-linear"
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
                    {canPlay && episode?.lock === false && (
                        <div
                            className="w-20 h-20 rounded-full bg-black/50 flex justify-center items-center absolute left-0 right-0 top-0 bottom-0 m-auto"
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
                                userStore.signed && userStore.isVIP() ? undefined : handleToggleVip
                            }
                        >
                            <Crown className="w-8 h-8 text-[#ffd000] fill-[#ffd000]" />
                            <div className="h-4 leading-4 text-[#ffd000] text-xs text-center">
                                VIP
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
                            className="absolute bg-black/30 w-full mx-auto pl-4 pr-2 left-0 right-0 h-10 flex bottom-0 mb-[76px]"
                            ref={progressWrapRef}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                className="flex-1 flex items-center justify-center"
                                ref={progressRef}
                                onMouseDown={handleProgressMouseDown}
                                onMouseMove={handleProgressMouseMove}
                                onTouchStart={handleProgressTouchStart}
                                onTouchMove={handleProgressTouchMove}
                            >
                                <div className="w-full h-1 bg-white/50 rounded-full overflow-hidden">
                                    <div className="bg-white/80 h-1 w-0" ref={progressCurrentRef} />
                                </div>
                            </div>
                            <div className="text-white text-xs flex items-center justify-center pl-4 whitespace-nowrap text-nowrap">
                                {current === 'NaN:NaN' ? '00:00' : current} /{' '}
                                {duration === 'NaN:NaN' ? '00:00' : duration}
                            </div>
                            <div
                                className="text-white text-xs flex items-center justify-center px-4"
                                onClick={handleSpeedOpen}
                            >
                                {SPEED[speed]}x
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
                            <div onClick={handleSpeedOpen}>
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
                    <DrawerContent className="bg-slate-800" aria-describedby="Introduction">
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
                <Vip open={vip} from="video" onOpenChange={handleToggleVip} />
                {/* <UnlockEpisode
                    open={unlockEpisodeOpen}
                    coins={episode?.unlock_coins ?? 0}
                    onOpenChange={handleToggleUnlockEpisode}
                /> */}
            </div>
        </div>
    );
}
