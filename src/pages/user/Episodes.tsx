import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { WebVTT } from 'videojs-vtt.js';
import Hls from 'hls.js';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { offlineEpisodePage } from '@/mocks/episodesOffline';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function pad2(n: number) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatTime(sec: number) {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const s = Math.floor(sec);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
}

function parseEpisodeSlug(slugRaw: string) {
    const slug = decodeURIComponent(slugRaw);
    // ReelShort: episode-2-田園情緣-694507...-r7jxhoxjsb
    const m = slug.match(/^episode-(\d+)-(.+)-([a-f0-9]{24})-([a-z0-9]+)$/i);
    if (!m) {
        return { serial: undefined, title: slug, bookId: undefined, chapterId: undefined };
    }
    return {
        serial: Number(m[1]),
        title: m[2].replace(/-/g, ' '),
        bookId: m[3],
        chapterId: m[4],
    };
}

export default function Component() {
    const params = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const subtitleRef = useRef<HTMLDivElement>(null);
    const subtitlesRef = useRef<VTTCue[]>([]);
    const hlsRef = useRef<Hls | null>(null);
    const xgPlayerId = useMemo(() => '099b3cb0-36c2-464d-8d2a-2eadde0c8e31', []);

    const slug = params['slug'] ?? '';
    const { serial, title, bookId, chapterId } = useMemo(() => parseEpisodeSlug(slug), [slug]);

    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [episode, setEpisode] = useState<IPlayerEpisode | null>(null);
    const [subtitleIndex, setSubtitleIndex] = useState(-1);
    const [plot, setPlot] = useState<string>('');
    const [likeCount, setLikeCount] = useState<number>(0);
    const [collectCount, setCollectCount] = useState<number>(0);
    const [totalEpisodes, setTotalEpisodes] = useState<number>(0);
    const [allOpen, setAllOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [unlockPrice, setUnlockPrice] = useState(0);
    const [coinBalance, setCoinBalance] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimerRef = useRef<number | null>(null);

    const [curSec, setCurSec] = useState(0);
    const [durSec, setDurSec] = useState(0);
    const [xgAction, setXgAction] = useState<'none' | 'seeking' | 'playbackrate'>('none');
    const [previewSec, setPreviewSec] = useState(0);
    const [defOpen, setDefOpen] = useState(false);
    const [defLabel, setDefLabel] = useState<'Auto' | '1080P' | '720P'>('Auto');
    const [qualityOpen, setQualityOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [bufSec, setBufSec] = useState(0);

    // 强制使用你指定的 HLS 测试源（接口/离线没给 video 时也能播）
    const FORCE_HLS_URL =
        'https://v-mps.crazymaplestudios.com/vod-112094/20ad17f462f471f0bfa85114c0db0102/d4cb2380932d4708b88aafcba0f604be-5a5f8f7839d63e04a7051032c9dde3c0-hd.m3u8';
    // 你要求“不要用离线哪个，就用这条”，这里直接无条件强制使用
    const effectiveVideoUrl = FORCE_HLS_URL;

    const seekBarRef = useRef<HTMLDivElement>(null);
    const holdTimerRef = useRef<number | null>(null);
    const holding2xRef = useRef(false);
    const [startInteract, setStartInteract] = useState(false);
    const startInteractTimerRef = useRef<number | null>(null);

    const safeTotalEpisodes = Math.max(0, totalEpisodes || 0);
    const totalFallback = safeTotalEpisodes > 0 ? safeTotalEpisodes : 98;
    const allEpisodes = useMemo(() => Array.from({ length: totalFallback }, (_, i) => i + 1), [totalFallback]);
    const [rangeIdx, setRangeIdx] = useState(0); // 0: 1-50, 1: 51-98

    const currentEpNum = serial ?? episode?.episode ?? 1;
    const isLockedByRule = (epNum: number) => epNum >= 4;

    const rangeA = useMemo(() => ({ start: 1, end: Math.min(50, totalFallback) }), [totalFallback]);
    const rangeB = useMemo(() => ({ start: 51, end: totalFallback }), [totalFallback]);
    const rangeList = useMemo(() => (rangeIdx === 0 ? rangeA : rangeB), [rangeA, rangeB, rangeIdx]);
    const episodesInRange = useMemo(() => {
        const out: number[] = [];
        for (let i = rangeList.start; i <= rangeList.end; i++) out.push(i);
        return out;
    }, [rangeList.end, rangeList.start]);

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            try {
                if (skipRemoteApi) {
                    const d = offlineEpisodePage(slug);
                    if (!alive) return;
                    // 假数据规则：前三集免费，第 4 集开始上锁
                    const epNum = d.serial ?? 1;
                    setEpisode({
                        ...d.episode,
                        episode: epNum,
                        lock: isLockedByRule(epNum),
                        unlock_coins: d.unlockPrice ?? d.episode.unlock_coins ?? 12,
                        can_unlock: !isLockedByRule(epNum) ? true : d.episode.can_unlock,
                    });
                    setPlot(d.plot);
                    setLikeCount(d.likeCount);
                    setCollectCount(d.collectCount);
                    setTotalEpisodes(d.totalEpisodes);
                    setUnlockPrice(d.unlockPrice ?? d.episode.unlock_coins ?? 0);
                    setCoinBalance(d.coinBalance ?? 0);
                    return;
                }

                // 优先按 ReelShort slug 解析到的 bookId/chapterId 请求（用于 1:1 还原 episodes 页面）
                if (bookId && chapterId) {
                    const res = await api<any>('video/book/getChapterContent', {
                        loading: false,
                        data: { book_id: bookId, chapter_id: chapterId },
                    });
                    if (!alive) return;
                    if (res.c !== 0) return;

                    // 兼容 ReelShort 返回字段（special_desc / chapter_desc / video_url 等）
                    const d = res.d?.data ?? res.d ?? {};
                    const videoUrl = String(d.video_url ?? d.video ?? '');
                    const subtitleUrl = String(d.subtitle_url ?? d.subtitle ?? '');
                    const epNum = Number(d.serial_number ?? serial ?? 1);
                    const plotText = String(d.chapter_desc ?? d.special_desc ?? d.plot ?? '');

                    const mapped: IPlayerEpisode = {
                        id: epNum,
                        episode: epNum,
                        video: videoUrl,
                        subtitle: subtitleUrl,
                        lock: Boolean(d.is_lock ?? d.lock ?? isLockedByRule(epNum)),
                        unlock_coins: Number(d.unlock_cost ?? d.unlock_coins ?? 0),
                        can_unlock: Boolean(d.can_unlock ?? false),
                    };

                    setEpisode(mapped);
                    setPlot(plotText);
                    setLikeCount(Number(d.like_count ?? d.likeCount ?? 0));
                    setCollectCount(Number(d.collect_count ?? d.collectCount ?? 0));
                    setTotalEpisodes(Number(d.chapter_count ?? d.total ?? 0));
                    setUnlockPrice(Number(d.unlock_cost ?? d.unlock_coins ?? mapped.unlock_coins ?? 0));
                    setCoinBalance(Number(d.coin_balance ?? d.balance ?? 0));
                    return;
                }

                // 兜底：如果 slug 不符合格式，就回到首页，避免空白
                navigate('/', { replace: true });
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, [bookId, chapterId, navigate, serial, slug]);

    useEffect(() => {
        if (!videoRef.current) return;

        // subtitle
        subtitlesRef.current = [];
        setSubtitleIndex(-1);
        if (episode?.subtitle) {
            fetch(episode.subtitle)
                .then((res) => res.text())
                .then((text) => {
                    const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                    const cues: VTTCue[] = [];
                    parser.oncue = (cue) => cues.push(cue);
                    parser.onflush = () => {
                        subtitlesRef.current = cues;
                    };
                    parser.parse(text);
                    parser.flush();
                })
                .catch(() => {});
        }

        // video
        const el = videoRef.current;
        if (episode?.lock) {
            // 锁集：不自动播放，等待解锁弹窗
            el.pause();
            setPlaying(false);
            setPayOpen(true);
            return;
        }
        // cleanup previous hls
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const src = effectiveVideoUrl;
        const isHls = typeof src === 'string' && src.toLowerCase().includes('.m3u8');
        if (isHls) {
            if (el.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari/iOS 原生 HLS
                el.src = src;
            } else if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                });
                hlsRef.current = hls;
                hls.loadSource(src);
                hls.attachMedia(el);
            } else {
                // fallback: best effort
                el.src = src;
            }
        } else {
            el.src = src;
        }

        el.currentTime = 0;
        el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }, [effectiveVideoUrl, episode?.lock, episode?.subtitle]);

    useEffect(() => {
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const onTime = () => {
            const cues = subtitlesRef.current;
            if (!cues.length) return;
            const t = el.currentTime;
            const idx = cues.findIndex((c) => t >= c.startTime && t <= c.endTime);
            setSubtitleIndex(idx);
            setCurSec(t || 0);
        };
        const onLoadedMeta = () => {
            setDurSec(el.duration || 0);
        };
        const onRate = () => {
            setPlaybackRate(el.playbackRate || 1);
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onProgress = () => {
            try {
                const t = el.currentTime || 0;
                const b = el.buffered;
                let end = 0;
                for (let i = 0; i < b.length; i++) {
                    const s = b.start(i);
                    const e = b.end(i);
                    if (t >= s && t <= e) {
                        end = e;
                        break;
                    }
                    // 回退：取最大缓冲尾
                    if (e > end) end = e;
                }
                setBufSec(end || 0);
            } catch {
                setBufSec(0);
            }
        };

        el.addEventListener('timeupdate', onTime);
        el.addEventListener('loadedmetadata', onLoadedMeta);
        el.addEventListener('ratechange', onRate);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);
        el.addEventListener('progress', onProgress);

        const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onFs);
        return () => {
            el.removeEventListener('timeupdate', onTime);
            el.removeEventListener('loadedmetadata', onLoadedMeta);
            el.removeEventListener('ratechange', onRate);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('pause', onPause);
            el.removeEventListener('progress', onProgress);
            document.removeEventListener('fullscreenchange', onFs);
        };
    }, []);

    function togglePlay() {
        if (!videoRef.current) return;
        if (episode?.lock) {
            setPayOpen(true);
            return;
        }
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    }

    function userPlay() {
        bumpControls();
        if (episode?.lock) {
            setPayOpen(true);
            return;
        }
        const el = videoRef.current;
        if (!el) return;
        el.play().then(() => setPlaying(true)).catch(() => {});
    }

    function buildEpisodeSlug(nextEp: number) {
        // episode-2-田園情緣-694507...-r7jxhoxjsb  -> episode-3-...
        if (!slug) return '';
        const m = slug.match(/^episode-(\d+)-/i);
        if (!m) return '';
        return slug.replace(/^episode-(\d+)-/i, `episode-${nextEp}-`);
    }

    function goNextEpisode() {
        const next = Math.min(totalFallback, Math.max(1, currentEpNum + 1));
        if (next === currentEpNum) return;
        const nextSlug = buildEpisodeSlug(next);
        if (nextSlug) {
            navigate(`/episodes/${nextSlug}`);
            return;
        }
        // slug 不可构造时：离线/兜底至少触发锁集弹窗规则
        if (isLockedByRule(next)) setPayOpen(true);
    }

    function cycleRate() {
        const el = videoRef.current;
        if (!el) return;
        const next = el.playbackRate < 1.5 ? 1.5 : el.playbackRate < 2 ? 2 : 1;
        el.playbackRate = next;
        setXgAction('none');
    }

    function pickDefinition(v: 'Auto' | '1080P' | '720P') {
        setDefLabel(v);
        setDefOpen(false);
        bumpControls();
        // 说明：ReelShort 的“清晰度”一般来自 HLS levels / 业务配置；
        // 这里先做到 1:1 的 DOM/交互（菜单/选中态/收起），后续再按你提供的真实 levels 做切换映射。
    }

    async function toggleFullscreen() {
        const wrap = scrollRef.current;
        if (!wrap) return;
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
        const el = wrap as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
        const fsEl = document.fullscreenElement;
        if (fsEl) {
            await document.exitFullscreen().catch(() => {});
            return;
        }
        if (el.requestFullscreen) {
            await el.requestFullscreen().catch(() => {});
            return;
        }
        if (el.webkitRequestFullscreen) {
            await Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
            return;
        }
        if (doc.webkitExitFullscreen) {
            await Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
        }
    }

    function calcSeekSec(clientX: number) {
        const bar = seekBarRef.current;
        if (!bar) return 0;
        const rect = bar.getBoundingClientRect();
        const x = Math.min(rect.right, Math.max(rect.left, clientX));
        const p = rect.width > 0 ? (x - rect.left) / rect.width : 0;
        return p * (durSec || 0);
    }

    function beginSeeking(clientX: number) {
        const sec = calcSeekSec(clientX);
        setPreviewSec(sec);
        setXgAction('seeking');
    }

    function updateSeeking(clientX: number) {
        if (xgAction !== 'seeking') return;
        setPreviewSec(calcSeekSec(clientX));
    }

    function commitSeeking() {
        if (xgAction !== 'seeking') return;
        const el = videoRef.current;
        if (el && durSec > 0) {
            el.currentTime = Math.min(durSec, Math.max(0, previewSec));
        }
        setXgAction('none');
    }

    function clearHoldTimer() {
        if (holdTimerRef.current != null) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }

    function clearControlsTimer() {
        if (controlsTimerRef.current != null) {
            window.clearTimeout(controlsTimerRef.current);
            controlsTimerRef.current = null;
        }
    }

    function clearStartInteractTimer() {
        if (startInteractTimerRef.current != null) {
            window.clearTimeout(startInteractTimerRef.current);
            startInteractTimerRef.current = null;
        }
    }

    function bumpControls() {
        setControlsVisible(true);
        clearControlsTimer();
        controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    }

    function stop2xIfNeeded() {
        const el = videoRef.current;
        if (!el) return;
        if (holding2xRef.current) {
            holding2xRef.current = false;
            el.playbackRate = 1;
            if (xgAction === 'playbackrate') setXgAction('none');
        }
    }

    return (
        <div className="rs-episodes">
            <div className="rs-episodes__scroll" ref={scrollRef}>
                <div className="rs-episodes__topnav">
                    <ReelShortTopNav scrollParentRef={scrollRef} />
                </div>

                <main className="rs-episodes__main">
                    <div className="rs-episodes__playerShell">
                        <div className={cn('rs-episodes__player h-50vh', loading && 'is-loading')}>
                            {/* 对标 ReelShort：breadcrumb 计入 h-50vh 上半区高度 */}
                            <div className="rs-episodes__breadcrumb">
                                <span className="rs-episodes__crumb">首頁</span>
                                <span className="rs-episodes__crumbSep">/</span>
                                <span className="rs-episodes__crumb">{title}</span>
                                <span className="rs-episodes__crumbSep">/</span>
                                <span className="rs-episodes__crumb rs-episodes__crumb--active">{serial ? `第${serial}集` : ''}</span>
                            </div>

                            <div className="rs-episodes__videoStage">
                            <div
                                className={cn(
                                    'xgplayer xgplayer-mobile rs-episodes__xgWrap',
                                    controlsVisible ? '' : 'xgplayer-inactive',
                                )}
                                onPointerMove={() => bumpControls()}
                                onClick={() => bumpControls()}
                                onPointerDown={() => {
                                    bumpControls();
                                    clearHoldTimer();
                                    holdTimerRef.current = window.setTimeout(() => {
                                        const el = videoRef.current;
                                        if (!el) return;
                                        holding2xRef.current = true;
                                        el.playbackRate = 2;
                                        setXgAction('playbackrate');
                                    }, 350);
                                }}
                                onPointerUp={() => {
                                    clearHoldTimer();
                                    stop2xIfNeeded();
                                }}
                                onPointerCancel={() => {
                                    clearHoldTimer();
                                    stop2xIfNeeded();
                                }}
                                onPointerLeave={() => {
                                    clearHoldTimer();
                                    stop2xIfNeeded();
                                }}
                            >
                                <video
                                    ref={videoRef}
                                    className=""
                                    autoPlay
                                    playsInline
                                    // 对标属性（xgplayer / H5 内核）
                                    x5-playsinline="true"
                                    webkit-playsinline="true"
                                    x5-video-orientation="landscape|portrait"
                                    mediatype="video"
                                    data-index={-1}
                                    data-xgplayerid={xgPlayerId}
                                    data-src-original={effectiveVideoUrl}
                                    src={effectiveVideoUrl}
                                />

                                {/* 1:1 结构：xgplayer-controls controls-autohide（DOM 按 ReelShort/xgplayer 镜像重写） */}
                                <xg-controls className="xgplayer-controls controls-autohide" unselectable="on" data-index="0">
                                    <xg-inner-controls className="xg-inner-controls xg-pos">
                                        <xg-left-grid className="xg-left-grid">
                                            <xg-icon
                                                className="xgplayer-play"
                                                data-index="0"
                                                data-state={playing ? 'pause' : 'play'}
                                                onClick={() => {
                                                    setDefOpen(false);
                                                    togglePlay();
                                                    bumpControls();
                                                }}
                                            >
                                                <div className="xgplayer-icon">
                                                    <img
                                                        src="https://v-mps.crazymaplestudios.com/images/dc205410-d6cd-11ee-94ca-b3f9375866ba.png"
                                                        width={17}
                                                        height={17}
                                                        className="xg-icon-play"
                                                        alt=""
                                                    />
                                                    <img
                                                        src="https://v-mps.crazymaplestudios.com/images/db028800-d6cd-11ee-94ca-b3f9375866ba.png"
                                                        width={17}
                                                        height={17}
                                                        className="xg-icon-pause"
                                                        alt=""
                                                    />
                                                </div>
                                                <div className="xg-tips" lang-key="PAUSE_TIPS">
                                                    暂停
                                                </div>
                                            </xg-icon>

                                            <div
                                                className="rs-xg-next !ml-8px !md:ml-16px h-full flex items-center cursor-pointer"
                                                data-index="0"
                                                style={{ opacity: 1, cursor: 'pointer' }}
                                                onClick={() => {
                                                    setDefOpen(false);
                                                    goNextEpisode();
                                                    bumpControls();
                                                }}
                                            >
                                                <img
                                                    src="https://v-mps.crazymaplestudios.com/images/12164930-c692-11ef-a2d6-41216ff1602c.png"
                                                    className="w-25px h-25px md:w-30px md:h-30px"
                                                    alt=""
                                                />
                                            </div>

                                            <xg-icon className="xgplayer-time" data-index="2.5" style={{ display: 'block' }}>
                                                <span className="time-current">
                                                    <span className="time-min-width">{pad2(curSec / 60)}</span>:
                                                    <span className="time-min-width">{pad2(curSec % 60)}</span>
                                                </span>
                                                <span className="time-separator">/</span>
                                                <span className="time-duration">{formatTime(durSec)}</span>
                                                <span className="time-live-tag" style={{ display: 'none' }}>
                                                    直播
                                                </span>
                                            </xg-icon>
                                        </xg-left-grid>

                                        <xg-center-grid className="xg-center-grid">
                                            <xg-progress className="xgplayer-progress" data-index="0">
                                                <xg-outer
                                                    className="xgplayer-progress-outer"
                                                    ref={seekBarRef as any}
                                                    onPointerDown={(e: any) => {
                                                        e.preventDefault();
                                                        (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
                                                        beginSeeking(e.clientX);
                                                        bumpControls();
                                                    }}
                                                    onPointerMove={(e: any) => updateSeeking(e.clientX)}
                                                    onPointerUp={() => commitSeeking()}
                                                    onPointerCancel={() => setXgAction('none')}
                                                >
                                                    <xg-inners className="progress-list">
                                                        <xg-inner className="xgplayer-progress-inner" style={{ background: 'rgba(255,255,255,0.2)', flex: 1 as any }}>
                                                            <xg-cache
                                                                className="xgplayer-progress-cache"
                                                                style={{ width: durSec > 0 ? `${(bufSec / durSec) * 100}%` : '0%' }}
                                                            />
                                                            <xg-played
                                                                className="xgplayer-progress-played"
                                                                style={{
                                                                    background: 'rgba(255, 255, 255, 0.5)',
                                                                    width:
                                                                        durSec > 0
                                                                            ? `${(((xgAction === 'seeking' ? previewSec : curSec) as number) / durSec) * 100}%`
                                                                            : '0%',
                                                                }}
                                                            />
                                                        </xg-inner>
                                                    </xg-inners>
                                                    <xg-progress-btn
                                                        className="xgplayer-progress-btn"
                                                        style={{
                                                            left:
                                                                durSec > 0
                                                                    ? `${(((xgAction === 'seeking' ? previewSec : curSec) as number) / durSec) * 100}%`
                                                                    : '0%',
                                                        }}
                                                    />
                                                </xg-outer>
                                            </xg-progress>
                                        </xg-center-grid>

                                        <xg-right-grid className="xg-right-grid">
                                            <div
                                                style={{ height: '100%', display: 'flex', alignItems: 'center', marginRight: 12 }}
                                                data-index={-1}
                                                onClick={() => {
                                                    setDefOpen(false);
                                                    toggleFullscreen();
                                                    bumpControls();
                                                }}
                                            >
                                                <img
                                                    className="icon"
                                                    width={20}
                                                    height={20}
                                                    src="https://www.reelshort.com/_next/static/media/is_full_screen_icon.88dfd7dd.png"
                                                    alt=""
                                                />
                                            </div>

                                            <xg-icon className="xgplayer-volume" data-state="normal" data-index="1">
                                                <div className="xgplayer-icon">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="xg-volume-small">
                                                        <path
                                                            fillRule="evenodd"
                                                            clipRule="evenodd"
                                                            d="M9.867 2.5h.55c.44 0 .799.34.83.771l.003.062v13.334c0 .44-.34.799-.771.83l-.062.003h-.55a.833.833 0 01-.444-.128l-.064-.045-4.867-3.744a.831.831 0 01-.322-.59l-.003-.07V7.077c0-.235.099-.458.271-.615l.054-.045L9.36 2.673a.832.832 0 01.43-.17l.078-.003h.55-.55zM2.5 6.667c.23 0 .417.186.417.416v5.834c0 .23-.187.416-.417.416h-.833a.417.417 0 01-.417-.416V7.083c0-.23.187-.416.417-.416H2.5zm11.768.46A4.153 4.153 0 0115.417 10c0 1.12-.442 2.137-1.162 2.886a.388.388 0 01-.555-.007l-.577-.578c-.176-.176-.156-.467.009-.655A2.49 2.49 0 0013.75 10a2.49 2.49 0 00-.61-1.636c-.163-.188-.182-.477-.006-.653l.578-.578a.388.388 0 01.556-.006z"
                                                            fill="#fff"
                                                        />
                                                    </svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="xg-volume">
                                                        <path
                                                            fillRule="evenodd"
                                                            clipRule="evenodd"
                                                            d="M9.867 2.5h.55c.44 0 .799.34.83.771l.003.062v13.334c0 .44-.34.799-.771.83l-.062.003h-.55a.833.833 0 01-.444-.128l-.064-.045-4.867-3.744a.831.831 0 01-.322-.59l-.003-.07V7.077c0-.235.099-.458.271-.615l.054-.045L9.36 2.673a.832.832 0 01.43-.17l.078-.003h.55-.55zm6.767 2.278A7.474 7.474 0 0118.75 10a7.477 7.477 0 01-2.128 5.234.4.4 0 01-.57-.004l-.587-.586a.442.442 0 01.005-.617A5.812 5.812 0 0017.083 10c0-1.557-.61-2.97-1.603-4.017a.442.442 0 01-.003-.615l.586-.586a.4.4 0 01.57-.004zM2.5 6.667c.23 0 .417.186.417.416v5.834c0 .23-.187.416-.417.416h-.833a.417.417 0 01-.417-.416V7.083c0-.23.187-.416.417-.416H2.5zm11.768.46A4.153 4.153 0 0115.417 10c0 1.12-.442 2.137-1.162 2.886a.388.388 0 01-.555-.007l-.577-.578c-.176-.176-.156-.467.009-.655A2.49 2.49 0 0013.75 10a2.49 2.49 0 00-.61-1.636c-.163-.188-.182-.477-.006-.653l.578-.578a.388.388 0 01.556-.006z"
                                                            fill="#fff"
                                                        />
                                                    </svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="xg-volume-mute">
                                                        <path
                                                            fillRule="evenodd"
                                                            clipRule="evenodd"
                                                            d="M10.045 2.5h.55c.44 0 .8.34.831.771l.003.062v13.334c0 .44-.34.799-.771.83l-.063.003h-.55a.833.833 0 01-.443-.128l-.065-.045-4.866-3.744a.831.831 0 01-.323-.59l-.003-.07V7.077c0-.235.1-.458.272-.615l.054-.045 4.866-3.744a.832.832 0 01.43-.17l.078-.003h.55-.55zM2.68 6.667c.23 0 .416.186.416.416v5.834c0 .23-.186.416-.416.416h-.834a.417.417 0 01-.416-.416V7.083c0-.23.186-.416.416-.416h.834zm10.467.294a.417.417 0 01.59 0l1.767 1.768L17.27 6.96a.417.417 0 01.589 0l.59.59a.417.417 0 010 .589L16.68 9.908l1.768 1.767c.15.15.162.387.035.55l-.035.04-.589.589a.417.417 0 01-.59 0l-1.767-1.768-1.768 1.768a.417.417 0 01-.59 0l-.588-.59a.417.417 0 010-.589l1.767-1.768-1.767-1.767a.417.417 0 01-.035-.55l.035-.04.589-.589z"
                                                            fill="#fff"
                                                        />
                                                    </svg>
                                                </div>
                                                <xg-slider className="xgplayer-slider">
                                                    <div className="xgplayer-bar">
                                                        <xg-drag className="xgplayer-drag" style={{ height: '60%' }} />
                                                    </div>
                                                </xg-slider>
                                            </xg-icon>

                                            <div
                                                id="customPlugin"
                                                className="xgplayer-icon"
                                                style={{ color: '#fff', margin: '0 12px' }}
                                                data-index="3"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setQualityOpen(true);
                                                    bumpControls();
                                                }}
                                            >
                                                <div id="customPlugin" className="xgplayer-icon" style={{ color: '#fff', display: 'flex', lineHeight: '40px' }}>
                                                    1080P
                                                </div>
                                            </div>
                                        </xg-right-grid>
                                    </xg-inner-controls>
                                </xg-controls>

                                {/* xg-trigger: ReelShort/xgplayer 同款 DOM（seeking / 2X 提示） */}
                                <xg-trigger
                                    class="trigger"
                                    data-index="0"
                                    data-xg-action={xgAction === 'none' ? undefined : xgAction}
                                >
                                    <div className="gradient" />
                                    <div className="time-preview">
                                        <div className="xg-seek-show">
                                            <i className="xg-seek-icon">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="20"
                                                    height="9"
                                                    viewBox="0 0 8 9"
                                                    fill="none"
                                                    className="xg-seek-pre"
                                                >
                                                    <path
                                                        opacity="0.54"
                                                        d="M7.5 3.63397C8.16667 4.01887 8.16667 4.98113 7.5 5.36603L1.5 8.83013C0.833334 9.21503 0 8.7339 0 7.9641L0 1.0359C0 0.266098 0.833333 -0.215027 1.5 0.169873L7.5 3.63397Z"
                                                        fill="white"
                                                    />
                                                    <path
                                                        transform="translate(5 0)"
                                                        d="M7.5 3.63397C8.16667 4.01887 8.16667 4.98113 7.5 5.36603L1.5 8.83013C0.833334 9.21503 0 8.7339 0 7.9641L0 1.0359C0 0.266098 0.833333 -0.215027 1.5 0.169873L7.5 3.63397Z"
                                                        fill="white"
                                                    />
                                                </svg>
                                            </i>
                                            <span className="xg-cur" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                                {formatTime(previewSec)}
                                            </span>
                                            <span className="xg-separator">/</span>
                                            <span className="xg-dur">{formatTime(durSec)}</span>
                                        </div>
                                        <div className="xg-bar xg-timebar" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                                            <div
                                                className="xg-curbar"
                                                style={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                                                    width: durSec > 0 ? `${(previewSec / durSec) * 100}%` : '0%',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="xg-playbackrate xg-top-note">
                                        <span>
                                            <i>2X</i>快进中
                                        </span>
                                    </div>
                                </xg-trigger>

                                {/* 源站：xgplayer-start 必须在 .xgplayer 内部，定位/动画才会 1:1 生效 */}
                                {!loading && !playing ? (
                                    <xg-start
                                        class={cn('xgplayer-start show', startInteract && 'interact')}
                                        data-index="0"
                                        data-state="play"
                                        style={{ display: 'block', pointerEvents: 'auto' }}
                                        onClick={() => {
                                            clearStartInteractTimer();
                                            setStartInteract(true);
                                            startInteractTimerRef.current = window.setTimeout(() => setStartInteract(false), 520);
                                            userPlay();
                                        }}
                                        role="button"
                                        aria-label="toggle play"
                                    >
                                        <xg-start-inner>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="none" className="xg-icon-play" aria-hidden="true">
                                                <rect width="60" height="60" rx="30" fill="#000" fillOpacity=".4" />
                                                <path
                                                    d="M40.243 28.3a2 2 0 010 3.401L24.06 41.712c-1.332.825-3.052-.134-3.052-1.7V19.988c0-1.566 1.72-2.525 3.052-1.7l16.184 10.01z"
                                                    fill="#fff"
                                                />
                                            </svg>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="pause xg-icon-pause" width="28" height="40" viewBox="3 -4 28 40" aria-hidden="true">
                                                <path
                                                    fill="#fff"
                                                    transform="scale(0.0320625 0.0320625)"
                                                    d="M598,214h170v596h-170v-596zM256 810v-596h170v596h-170z"
                                                />
                                            </svg>
                                        </xg-start-inner>
                                    </xg-start>
                                ) : null}

                            </div>
                            <div className="rs-episodes__subtitle" ref={subtitleRef}>
                                {subtitleIndex > -1 && subtitlesRef.current.length > 0 ? (
                                    <div className="rs-episodes__subtitleText">
                                        {subtitlesRef.current[subtitleIndex].text.replace(/<[^>]*>?/gm, '')}
                                    </div>
                                ) : null}
                            </div>
                            </div>

                            {/* xgplayer-start 已移入 .xgplayer 容器内（保证定位/动画命中源站 CSS） */}

                            {qualityOpen ? (
                                <>
                                    <div className="BasicsDrawerModalMB_drawer_modal_shadow__uoreT" style={{ display: 'block' }} onClick={() => setQualityOpen(false)} />
                                    <div
                                        className="BasicsDrawerModalMB_drawer_modal__1xjka BasicsDrawerModalMB_open__JkqYQ BasicsDrawerModalMB_is_dark__5DmSr"
                                        style={{ display: 'block' }}
                                    >
                                        <div>
                                            <div className="VideoDefinitionPanel_container__am5_4">
                                                <div className="VideoDefinitionPanel_panel_header__KR0xv">
                                                    <div>Quality</div>
                                                    <div>
                                                        <span
                                                            role="img"
                                                            aria-label="close"
                                                            tabIndex={-1}
                                                            className="anticon anticon-close"
                                                            onClick={() => setQualityOpen(false)}
                                                        >
                                                            <svg fillRule="evenodd" viewBox="64 64 896 896" focusable="false" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                                                                <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" />
                                                            </svg>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="VideoDefinitionPanel_panel_content__wnzog">
                                                    {(['540P', '720P', '1080P'] as const).map((v) => (
                                                        <div
                                                            key={v}
                                                            className={cn(
                                                                'VideoDefinitionPanel_definition_item__L7S9r',
                                                                v === '1080P' && 'VideoDefinitionPanel_current_definition_itme__Zxu30',
                                                            )}
                                                            onClick={() => {
                                                                setDefLabel(v === '1080P' ? '1080P' : v === '720P' ? '720P' : 'Auto');
                                                                setQualityOpen(false);
                                                                bumpControls();
                                                            }}
                                                        >
                                                            {v}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {episode?.lock ? (
                                <div className="rs-episodes__lockMask">
                                    <div
                                        className="h-full w-full flex-center flex-col leading-normal mb-6/vw text-14/vw px-32/vw md:px-70px"
                                        style={{ transform: 'scale(1)' }}
                                    >
                                        <img
                                            className="h-64px w-64px"
                                            src="https://v-mps.crazymaplestudios.com/images/7f47ede0-ef83-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                        <p className="text-center text-18/vw font-700 text-white/90 mt-16/vw mb-32/vw md:text-20px md:mt-24px md:mb-40px md:w-320px">
                                            這是付費劇集。請解鎖後觀看。
                                        </p>
                                        <button
                                            type="button"
                                            className="cursor-pointer rtl font-700 w-full relative flex-center bg-[#E52E2E] text-white/90 leading-normal rounded-4px text-14/vw h-48px min-h-48px md:text-16px md:w-320px"
                                            onClick={() => setPayOpen(true)}
                                        >
                                            <i
                                                className="mr-4px block w-16/vw h-16/vw md:w-20px md:h-20px bg-[url(https://v-mps.crazymaplestudios.com/images/f7c9e180-f053-11f0-84ad-6b5693b490dc.png)] bg-cover"
                                                aria-hidden
                                            />
                                            {unlockPrice || episode.unlock_coins || 0} 立即解鎖
                                        </button>
                                        <button
                                            type="button"
                                            className="hidden cursor-pointer md:flex mt-8px border-white/90 border-solid border rtl font-700 w-full relative flex-center text-white/90 leading-normal rounded-4px md:h-48px md:text-16px md:w-320px"
                                            style={{ background: 'none' }}
                                        >
                                            <i
                                                className="block w-24px h-24px bg-[url(https://v-mps.crazymaplestudios.com/images/36440c80-ef8a-11f0-84ad-6b5693b490dc.png)] bg-cover"
                                                aria-hidden
                                            />
                                            在 ReelShort 應用中觀看
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="rs-episodes__below">
                            <div className="shrink-1 touch-none overflow-auto">
                                <div className="mx-16/vw pb-25/vw">
                                    <h1 className="font-SofiaSemiBold line-clamp-2 break-words mt-32/vw text-18/vw">
                                        第{currentEpNum}集 - {title} 完整影片
                                    </h1>

                                    <div className="mt-24/vw" role="tabs">
                                        <div role="tab-list" className="flex items-center justify-between overflow-hidden rounded-md p-0 h-20/vw mb-6/vw">
                                            <div className="flex shrink-1">
                                                <div
                                                    data-state={rangeIdx === 0 ? 'active' : 'inactive'}
                                                    className="group relative relative flex-center bg-black px-0 py-1.5 leading-normal tracking-wide min-w-24/vw mr-15/vw text-14/vw data-[state=active]:text-white data-[state=inactive]:text-white/50"
                                                    onClick={() => setRangeIdx(0)}
                                                >
                                                    1-50
                                                </div>
                                                <div
                                                    data-state={rangeIdx === 1 ? 'active' : 'inactive'}
                                                    className="group relative relative flex-center bg-black px-0 py-1.5 leading-normal tracking-wide min-w-24/vw mr-15/vw text-14/vw data-[state=active]:text-white data-[state=inactive]:text-white/50"
                                                    onClick={() => setRangeIdx(1)}
                                                >
                                                    51-{totalFallback}
                                                </div>
                                            </div>

                                            <Dialog open={allOpen} onOpenChange={setAllOpen}>
                                                <DialogTrigger asChild>
                                                    <div className="flex items-center text-white/50 leading-normal mr--6/vw text-12/vw cursor-pointer">
                                                        全集
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="text-23/vw">
                                                            <path
                                                                fill="currentColor"
                                                                d="m14.83 11.29l-4.24-4.24a1 1 0 0 0-1.42 0a1 1 0 0 0 0 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41a1 1 0 0 0 .71.29a1 1 0 0 0 .71-.29l4.24-4.24a1 1 0 0 0 0-1.42"
                                                            />
                                                        </svg>
                                                    </div>
                                                </DialogTrigger>
                                                <DialogContent className="rs-episodes__allDialog" hideCloseButton>
                                                    <div className="rs-episodes__allHead">
                                                        <button type="button" className="rs-episodes__allClose" onClick={() => setAllOpen(false)}>
                                                            ×
                                                        </button>
                                                        <div className="rs-episodes__allTitle">全集</div>
                                                    </div>
                                                    <div className="rs-episodes__allGrid">
                                                        {allEpisodes.map((n) => (
                                                            <button
                                                                key={n}
                                                                type="button"
                                                                className={cn('rs-episodes__allEpBtn', n === (serial ?? -1) && 'is-active')}
                                                                onClick={() => setAllOpen(false)}
                                                            >
                                                                {n}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        <div
                                            data-state={rangeIdx === 0 ? 'active' : 'inactive'}
                                            role="tabpanel"
                                            className={cn(
                                                'w-full gap-4/vw overflow-x-auto overscroll-x-contain overscroll-y-none touch-pan-x',
                                                rangeIdx === 0 ? 'flex' : 'hidden',
                                            )}
                                        >
                                            {episodesInRange.map((n) => {
                                                const locked = isLockedByRule(n);
                                                const isCur = n === currentEpNum;
                                                return (
                                                    <div
                                                        key={n}
                                                        className={cn(
                                                            'relative flex-center shrink-0 w-62/vw h-46/vw rounded-4/vw text-16/vw bg-white/10 border border-solid border-black text-white/90',
                                                            isCur &&
                                                                'bg-[radial-gradient(116.67%_135.17%_at_95.16%_96%,rgba(255,61,93,0.32)_0%,rgba(45,45,45,0.00)_80%)]',
                                                        )}
                                                        onClick={() => {
                                                            if (locked) {
                                                                setPayOpen(true);
                                                            }
                                                        }}
                                                    >
                                                        <span>{n}</span>

                                                        {isCur ? (
                                                            <div className="flex absolute right-2/vw bottom-2/vw w-12/vw h-12/vw">
                                                                <img
                                                                    alt=""
                                                                    src="https://v-mps.crazymaplestudios.com/images/f24458e0-c6ae-11f0-84ad-6b5693b490dc.gif"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                />
                                                            </div>
                                                        ) : null}

                                                        {locked ? (
                                                            <div className="absolute right-0 top-0 flex-center rounded-lb-6px rounded-rt-6px bg-[#E52E2E] h-14/vw text-12/vw w-18/vw">
                                                                <span role="img" className="anticon">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
                                                                        <path
                                                                            fill="#fff"
                                                                            fillOpacity="0.9"
                                                                            d="M6 1.5A2.5 2.5 0 0 1 8.5 4v1c.466 0 .699 0 .883.076a1 1 0 0 1 .54.541c.077.184.077.417.077.883V7c0 .93 0 1.395-.103 1.776a3 3 0 0 1-2.12 2.122C7.394 11 6.93 11 6 11c-.93 0-1.395 0-1.776-.102a3 3 0 0 1-2.121-2.122C2 8.395 2 7.93 2 7v-.5c0-.466 0-.699.076-.883a1 1 0 0 1 .541-.54C2.801 5 3.034 5 3.5 5V4A2.5 2.5 0 0 1 6 1.5m.026 5.401c-.46-.208-.672-.104-.768.396a3.2 3.2 0 0 0 0 1.206c.096.5.307.604.768.396.33-.148.631-.341.897-.569.37-.317.37-.543 0-.86a3.731 3.731 0 0 0-.897-.569M6 2.5A1.5 1.5 0 0 0 4.5 4v1h3V4A1.5 1.5 0 0 0 6 2.5"
                                                                        />
                                                                    </svg>
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div
                                            data-state={rangeIdx === 1 ? 'active' : 'inactive'}
                                            role="tabpanel"
                                            className={cn(
                                                'w-full gap-4/vw overflow-x-auto overscroll-x-contain overscroll-y-none touch-pan-x',
                                                rangeIdx === 1 ? 'flex' : 'hidden',
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rs-episodes__actions">
                                <button type="button" className="rs-episodes__actionBtn">
                                    <div className="rs-episodes__actionIcon">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="26" height="26">
                                            <path
                                                fill="currentColor"
                                                fillOpacity="0.9"
                                                d="M18.716 4.884c-2.413-1.462-4.52-.873-5.785.065-.519.385-.778.578-.931.578-.153 0-.412-.193-.931-.578-1.265-.938-3.372-1.527-5.785-.065-3.168 1.919-3.884 8.25 3.422 13.59C10.097 19.491 10.793 20 12 20c1.207 0 1.903-.509 3.294-1.526 7.307-5.34 6.59-11.671 3.422-13.59"
                                            />
                                        </svg>
                                    </div>
                                    <div className="rs-episodes__actionText">{likeCount}</div>
                                </button>
                                <button type="button" className="rs-episodes__actionBtn">
                                    <div className="rs-episodes__actionIcon">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="26" height="26">
                                            <path
                                                fill="currentColor"
                                                fillOpacity="0.9"
                                                d="M8.98 6.029c1.183-1.866 1.774-2.8 2.585-2.98.287-.065.583-.065.87 0 .81.18 1.402 1.114 2.585 2.98.327.516.491.774.715.969.082.072.17.136.263.194.252.155.544.233 1.13.389 2.117.563 3.176.845 3.597 1.57.149.256.24.542.269.838.08.837-.613 1.695-2 3.412-.383.475-.575.713-.688.988a2.053 2.053 0 0 0-.1.314c-.069.29-.051.597-.017 1.21.126 2.214.189 3.32-.362 3.95a2.017 2.017 0 0 1-.703.518c-.761.336-1.781-.067-3.82-.872-.565-.223-.848-.334-1.141-.358a2.006 2.053 0 0 0-.326 0c-.293.02-.576.135-1.14.358-2.04.805-3.06 1.208-3.821.872a2.017 2.017 0 0 1-.703-.518c-.551-.63-.488-1.736-.362-3.95.034-.613.052-.92-.017-1.21a2.053 2.053 0 0 0-.1-.314c-.113-.275-.305-.513-.688-.988-1.387-1.717-2.08-2.575-2-3.412.03-.296.12-.582.269-.838.42-.725 1.48-1.007 3.597-1.57.586-.156.878-.234 1.13-.389.093-.058.181-.122.263-.194.224-.195.388-.453.715-.969"
                                            />
                                        </svg>
                                    </div>
                                    <div className="rs-episodes__actionText">{collectCount}</div>
                                </button>
                                <button type="button" className="rs-episodes__actionBtn">
                                    <div className="rs-episodes__actionIcon">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="26" height="26">
                                            <path
                                                fill="currentColor"
                                                fillOpacity="0.9"
                                                d="M4.488 7.04c.817-4.063 2.618-4.91 6.539-3.218a31.933 31.933 0 0 1 7.617 4.624c3.141 2.58 3.141 4.423 0 7.003a31.936 31.936 0 0 1-7.617 4.624c-3.92 1.692-5.722.845-6.54-3.218a24.93 24.93 0 0 1 0-9.815"
                                            />
                                        </svg>
                                    </div>
                                    <div className="rs-episodes__actionText">分享</div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <aside className="rs-episodes__panel">
                        <div className="rs-episodes__panelInner">
                            <h1 className="rs-episodes__h1">
                                {serial ? `第${serial}集 - ${title}` : title} 完整影片
                            </h1>

                            <h3 className="rs-episodes__h3">
                                {serial ? `第${serial}集的情節` : '情節'}
                            </h3>
                            <div className="rs-episodes__plot rich-text break-words text-white/50">
                                {plot}
                            </div>
                        </div>
                    </aside>
                </main>

                <ReelShortFooter />
            </div>

            {/* VIP/充值/支付 弹窗（按你给的 DOM 结构复刻 + SCSS 可改） */}
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogContent className="rs-paywall__dialog" hideCloseButton>
                    <div className="rs-paywall">
                        <div className="rs-paywall__inner">
                            <div className="rs-paywall__stickyHead">
                                <div className="rs-paywall__headLeft">
                                    <span className="rs-paywall__kv">
                                        價格:
                                        <img
                                            className="rs-paywall__coin"
                                            src="https://v-mps.crazymaplestudios.com/images/f7c9e180-f053-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                        {unlockPrice || episode?.unlock_coins || 0}
                                    </span>
                                    <div className="rs-paywall__sep" />
                                    <span className="rs-paywall__kv">
                                        餘額:
                                        <img
                                            className="rs-paywall__coin"
                                            src="https://v-mps.crazymaplestudios.com/images/f7c9e180-f053-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                        {coinBalance}
                                    </span>
                                </div>
                                <button type="button" className="rs-paywall__close" onClick={() => setPayOpen(false)} aria-label="close">
                                    <img
                                        src="https://v-mps.crazymaplestudios.com/images/a9a3d800-ef98-11f0-84ad-6b5693b490dc.png"
                                        className="rs-paywall__closeImg"
                                        alt=""
                                    />
                                </button>
                            </div>

                            <div className="rs-paywall__divider" />

                            <div className="rs-paywall__section">
                                <div className="rs-paywall__vipTitle">VIP 免費解鎖所有劇集</div>
                                <div className="rs-paywall__vipSub">自動續訂。可隨時取消。</div>
                                <div className="rs-paywall__vipGrid">
                                    <button type="button" className="rs-paywall__vipCard">
                                        <div className="rs-paywall__vipBg" />
                                        <div className="rs-paywall__vipBody">
                                            <div className="rs-paywall__vipName">每週 VIP</div>
                                            <div className="rs-paywall__vipPrice">$5.99</div>
                                            <div className="rs-paywall__vipNote">自動續訂。隨時取消</div>
                                        </div>
                                        <div className="rs-paywall__vipFoot">
                                            <div className="rs-paywall__vipFeat">
                                                <img
                                                    className="rs-paywall__featIcon"
                                                    src="https://v-mps.crazymaplestudios.com/images/b2e3e770-f047-11f0-84ad-6b5693b490dc.png"
                                                    alt=""
                                                />
                                                無限觀看
                                            </div>
                                            <div className="rs-paywall__vipFeat">
                                                <img
                                                    className="rs-paywall__featIcon"
                                                    src="https://v-mps.crazymaplestudios.com/images/b2e2fd10-f047-11f0-84ad-6b5693b490dc.png"
                                                    alt=""
                                                />
                                                1080p 高畫質
                                            </div>
                                        </div>
                                    </button>

                                    <button type="button" className="rs-paywall__vipCard">
                                        <div className="rs-paywall__vipBg" />
                                        <div className="rs-paywall__vipBody">
                                            <div className="rs-paywall__vipName">年度 VIP</div>
                                            <div className="rs-paywall__vipPrice">$99.99</div>
                                            <div className="rs-paywall__vipNote">自動續訂。隨時取消</div>
                                        </div>
                                        <div className="rs-paywall__vipFoot">
                                            <div className="rs-paywall__vipFeat">
                                                <img
                                                    className="rs-paywall__featIcon"
                                                    src="https://v-mps.crazymaplestudios.com/images/b2e3e770-f047-11f0-84ad-6b5693b490dc.png"
                                                    alt=""
                                                />
                                                無限觀看
                                            </div>
                                            <div className="rs-paywall__vipFeat">
                                                <img
                                                    className="rs-paywall__featIcon"
                                                    src="https://v-mps.crazymaplestudios.com/images/b2e2fd10-f047-11f0-84ad-6b5693b490dc.png"
                                                    alt=""
                                                />
                                                1080p 高畫質
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="rs-paywall__section">
                                <div className="rs-paywall__secTitle">儲值金幣</div>
                                <div className="rs-paywall__coinGrid">
                                    {[
                                        { coins: '1,150', now: '1,000', free: '150', price: '$9.99', bonus: '+15%' },
                                        { coins: '550', now: '500', free: '50', price: '$4.99', bonus: '+10%' },
                                        { coins: '100', now: '100', free: null, price: '$0.99', bonus: null },
                                        { coins: '3,000', now: '2,000', free: '1,000', price: '$19.99', bonus: '+50%' },
                                    ].map((p) => (
                                        <button key={p.coins} type="button" className="rs-paywall__coinCard">
                                            <div className="rs-paywall__coinRow">
                                                <img
                                                    className="rs-paywall__coinBig"
                                                    src="https://v-mps.crazymaplestudios.com/images/f7c9e180-f053-11f0-84ad-6b5693b490dc.png"
                                                    alt=""
                                                />
                                                <span>{p.coins}</span>
                                            </div>
                                            <div className="rs-paywall__coinDesc">
                                                <div>立即：{p.now}</div>
                                                {p.free ? <div>免費：{p.free}</div> : null}
                                            </div>
                                            <div className="rs-paywall__coinPrice">{p.price}</div>
                                            {p.bonus ? <div className="rs-paywall__coinBonus">{p.bonus}</div> : null}
                                        </button>
                                    ))}
                                </div>
                                <button type="button" className="rs-paywall__more">
                                    更多方案
                                    <span className="rs-paywall__chev">›</span>
                                </button>
                            </div>

                            <div className="rs-paywall__section">
                                <div className="rs-paywall__secTitle">付款方式</div>
                                <div className="rs-paywall__payGrid">
                                    <button type="button" className="rs-paywall__payBtn is-active">
                                        <img
                                            className="rs-paywall__payIcon"
                                            src="https://v-mps.crazymaplestudios.com/images/98236390-f063-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                        <label className="rs-paywall__payLabel">快速付款</label>
                                    </button>
                                    <button type="button" className="rs-paywall__payBtn">
                                        <img
                                            className="rs-paywall__payIconWide"
                                            src="https://v-mps.crazymaplestudios.com/images/55516d00-ec94-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                    </button>
                                    <button type="button" className="rs-paywall__payBtn">
                                        <img
                                            className="rs-paywall__payIconWide"
                                            src="https://v-mps.crazymaplestudios.com/images/5552a580-ec94-11f0-84ad-6b5693b490dc.png"
                                            alt=""
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

