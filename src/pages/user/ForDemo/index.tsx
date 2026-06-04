import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VerticalFeed, type VerticalFeedRef, type VideoItem } from 'react-vertical-feed';
import { Volume2, VolumeX } from 'lucide-react';

import Loader from '@/components/Loader';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { bindVerticalPcWheelNav } from '@/pages/user/VideoPage/videoVerticalPcWheelNav';
import { useConfigStore } from '@/stores/config';
import { useRootStore } from '@/stores/root';
import type { IForYouFeedItem } from '@/types/foryouFeed';
import { fetchForyouList } from '@/pages/user/ForYouPage/fetchForyouList';
import {
    abortForyouVideoLoad,
    ensureForyouMediaPreconnect,
    prewarmForyouFeedItem,
    primeForyouNeighborBuffer,
    resolveFeedVideoUrl,
    syncForyouPrewarmWindow,
} from '@/pages/user/ForYouPage/foryouFeedMedia';
import { foryouFeedItemKey, mergeForyouFeedItems } from '@/pages/user/ForYouPage/foryouFeedMerge';
import { FORYOU_DEFAULT_PER_PAGE } from '@/pages/user/ForYouPage/foryouConstants';
import {
    hasVideoSessionUserUnmuted,
    markVideoSessionUserUnmuted,
} from '@/pages/user/VideoPage/videoSessionMute';

/** DOM 内固定最多同时挂载 6 条 video */
const MAX_MOUNT = 6;
/** 当前条前保留 2 条（与 MAX_MOUNT 合计固定 6 条） */
const MOUNT_PREV = 2;
const MOBILE_SCROLL_SETTLE_MS = 150;
/** 当前条 canplay 后，再对窗口外 +2 条做隐藏 metadata 预拉 */
const HIDDEN_PREWARM_BELOW_OFFSET = 2;

function resolveFeedPosterUrl(image: string, staticBase: string): string | undefined {
    const raw = String(image ?? '').trim();
    if (!raw) {
        return undefined;
    }
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw;
    }
    const base = String(staticBase ?? '').replace(/\/+$/, '');
    if (!base) {
        return raw;
    }
    return `${base}/${raw.replace(/^\/+/, '')}`;
}

/**
 * 串行预拉（PC）：当前条 canplay 前仅 active=auto，避免 6 路 206 并发排队。
 * canplay 后：下一条 auto、上一条 metadata。
 */
function resolveMountPreload(
    absoluteIndex: number,
    activeAbsolute: number,
    anchorPlaybackReady: boolean,
    mobileRelaxed: boolean,
): 'none' | 'metadata' | 'auto' {
    if (absoluteIndex === activeAbsolute) {
        return 'auto';
    }
    if (mobileRelaxed) {
        const delta = absoluteIndex - activeAbsolute;
        if (delta === 1) {
            return 'auto';
        }
        if (delta === -1) {
            return 'metadata';
        }
        return 'none';
    }
    if (!anchorPlaybackReady) {
        return 'none';
    }
    const delta = absoluteIndex - activeAbsolute;
    if (delta === 1) {
        return 'auto';
    }
    if (delta === -1) {
        return 'metadata';
    }
    return 'none';
}

function feedItemToVideoItem(
    item: IForYouFeedItem,
    staticBase: string,
    soundOn: boolean,
    absoluteIndex: number,
    activeAbsolute: number,
    anchorPlaybackReady: boolean,
    mobileRelaxed: boolean,
): VideoItem | null {
    const src = resolveFeedVideoUrl(item, staticBase);
    if (!src) {
        return null;
    }
    return {
        id: foryouFeedItemKey(item),
        src,
        poster: resolveFeedPosterUrl(item.image, staticBase),
        autoPlay: true,
        muted: !soundOn,
        playsInline: true,
        controls: false,
        preload: resolveMountPreload(
            absoluteIndex,
            activeAbsolute,
            anchorPlaybackReady,
            mobileRelaxed,
        ),
        metadata: {
            title: item.title,
            ep_id: item.ep_id,
            movie_id: item.id,
        },
    };
}

/** pool 够长时固定 6 条；在 index < 6 前保持 start=0，避免第 4 条就 remount 卡死 */
function computeWindowRange(absoluteIndex: number, poolLength: number): { start: number; end: number } {
    if (poolLength <= 0) {
        return { start: 0, end: -1 };
    }

    const mountCount = Math.min(MAX_MOUNT, poolLength);
    let start: number;
    let end: number;

    if (absoluteIndex < mountCount) {
        start = 0;
        end = mountCount - 1;
    } else {
        start = absoluteIndex - MOUNT_PREV;
        end = start + mountCount - 1;
    }

    end = Math.min(poolLength - 1, end);
    start = Math.max(0, end - mountCount + 1);

    return { start, end };
}

function getFeedElement(shell: HTMLElement | null): HTMLElement | null {
    return shell?.querySelector('[role="feed"]') as HTMLElement | null;
}

/** 手机 100vh 与 scroll 容器高度常不一致，用 offsetTop 比 scrollTop/clientHeight 可靠 */
function resolveRelativeIndexFromScroll(feed: HTMLElement, maxIndex: number): number {
    const slides = feed.querySelectorAll('[data-index]');
    if (!slides.length) {
        return 0;
    }
    const scrollTop = feed.scrollTop;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((node) => {
        const el = node as HTMLElement;
        const idx = parseInt(el.getAttribute('data-index') ?? '0', 10);
        const dist = Math.abs(el.offsetTop - scrollTop);
        if (dist < bestDist) {
            bestDist = dist;
            best = idx;
        }
    });
    return Math.max(0, Math.min(best, maxIndex));
}

/**
 * react-vertical-feed 演示：foryou 接口 + 滑动窗口队列挂载。
 * 访问：/for-demo
 */
export default function ForDemoPage() {
    const isDesktop = useMinWidth768();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const staticBase = useConfigStore((s) => String(s.config['static'] ?? ''));
    const feedShellRef = useRef<HTMLDivElement>(null);
    const feedRef = useRef<VerticalFeedRef>(null);
    const poolRef = useRef<IForYouFeedItem[]>([]);
    const windowStartRef = useRef(0);
    const currentAbsoluteRef = useRef(0);
    const pendingScrollRef = useRef<number | null>(null);
    const correctingScrollRef = useRef(false);
    const navLockRef = useRef(false);
    const pageRef = useRef(1);
    const remoteHasMoreRef = useRef(true);
    const loadingMoreRef = useRef(false);

    const [windowRange, setWindowRange] = useState({ start: 0, end: -1 });
    const [activeAbsolute, setActiveAbsolute] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    /** 演示页默认有声；若本会话已点过开声则永不自动静音 */
    const [soundOn, setSoundOn] = useState<boolean>(() => hasVideoSessionUserUnmuted() || true);
    const [soundUnlocked, setSoundUnlocked] = useState(() => hasVideoSessionUserUnmuted());
    /** 当前条已 canplay 后再预拉邻格，避免首屏多路 mp4 抢带宽 */
    const [anchorPlaybackReady, setAnchorPlaybackReady] = useState(false);
    const soundOnRef = useRef(soundOn);
    const userUnlockedSoundRef = useRef(hasVideoSessionUserUnmuted());
    soundOnRef.current = soundOn;

    const applySoundToAllMountedVideos = useCallback((unmuted: boolean) => {
        getFeedElement(feedShellRef.current)
            ?.querySelectorAll('[data-index] video')
            .forEach((node) => {
                (node as HTMLVideoElement).muted = !unmuted;
            });
    }, []);

    const unlockSoundPermanently = useCallback(() => {
        userUnlockedSoundRef.current = true;
        setSoundUnlocked(true);
        markVideoSessionUserUnmuted();
        setSoundOn(true);
        soundOnRef.current = true;
        applySoundToAllMountedVideos(true);
    }, [applySoundToAllMountedVideos]);

    const scrollFeedToRelative = useCallback((relativeIndex: number) => {
        correctingScrollRef.current = true;
        const feed = getFeedElement(feedShellRef.current);
        if (feed && feed.clientHeight > 0) {
            feed.scrollTop = relativeIndex * feed.clientHeight;
        } else {
            feedRef.current?.scrollToItem(relativeIndex, 'auto');
        }
        requestAnimationFrame(() => {
            correctingScrollRef.current = false;
        });
    }, []);

    const syncVisibleVideoSound = useCallback((relativeIndex: number) => {
        if (!soundOnRef.current) {
            return;
        }
        requestAnimationFrame(() => {
            const video = getFeedElement(feedShellRef.current)?.querySelector(
                `[data-index="${relativeIndex}"] video`,
            ) as HTMLVideoElement | null;
            if (!video) {
                return;
            }
            video.muted = false;
            void video.play().catch(() => {
                /** 浏览器拦截有声自动播：先静音播，但不改 soundOn（尤其已 unlock 时） */
                video.muted = true;
                void video.play().catch(() => {});
            });
        });
    }, []);

    const enableSound = useCallback(() => {
        unlockSoundPermanently();
        const relative = currentAbsoluteRef.current - windowStartRef.current;
        syncVisibleVideoSound(Math.max(0, relative));
    }, [syncVisibleVideoSound, unlockSoundPermanently]);

    const disableSound = useCallback(() => {
        if (userUnlockedSoundRef.current) {
            return;
        }
        setSoundOn(false);
        soundOnRef.current = false;
        applySoundToAllMountedVideos(false);
    }, [applySoundToAllMountedVideos]);

    const applyWindowForAbsolute = useCallback((absoluteIndex: number): number => {
        const pool = poolRef.current;
        const { start, end } = computeWindowRange(absoluteIndex, pool.length);
        windowStartRef.current = start;
        setWindowRange({ start, end });
        return absoluteIndex - start;
    }, []);

    const commitAbsoluteIndex = useCallback(
        (absoluteIndex: number, options?: { forceScroll?: boolean }) => {
            const pool = poolRef.current;
            if (absoluteIndex < 0 || absoluteIndex >= pool.length) {
                return;
            }
            const prevStart = windowStartRef.current;
            currentAbsoluteRef.current = absoluteIndex;
            setAnchorPlaybackReady(false);
            setActiveAbsolute(absoluteIndex);
            const relativeIndex = applyWindowForAbsolute(absoluteIndex);
            const startChanged = windowStartRef.current !== prevStart;
            if (startChanged || options?.forceScroll) {
                pendingScrollRef.current = relativeIndex;
            } else {
                scrollFeedToRelative(relativeIndex);
            }
            syncVisibleVideoSound(relativeIndex);
        },
        [applyWindowForAbsolute, scrollFeedToRelative, syncVisibleVideoSound],
    );

    const ensurePoolAheadRef = useRef<(absoluteIndex: number) => Promise<void>>(() => Promise.resolve());

    const ensurePoolAhead = useCallback(async (absoluteIndex: number) => {
        const pool = poolRef.current;
        const { end } = computeWindowRange(absoluteIndex, pool.length);
        const nearWindowEnd = absoluteIndex >= end - 1;
        if (!nearWindowEnd || end < pool.length - 1 || loadingMoreRef.current || !remoteHasMoreRef.current) {
            return;
        }
        const last = poolRef.current[poolRef.current.length - 1];
        if (!last) {
            return;
        }
        loadingMoreRef.current = true;
        setLoadingMore(true);
        const result = await fetchForyouList({
            mode: 'more',
            page: pageRef.current + 1,
            lastEpId: last.ep_id,
        });
        loadingMoreRef.current = false;
        setLoadingMore(false);
        if (!result.ok) {
            return;
        }
        poolRef.current = mergeForyouFeedItems(poolRef.current, result.payload.data);
        pageRef.current = result.payload.current_page ?? pageRef.current + 1;
        remoteHasMoreRef.current =
            result.payload.has_more ??
            result.payload.data.length >= (result.payload.per_page ?? FORYOU_DEFAULT_PER_PAGE);
        const prevStart = windowStartRef.current;
        const prevEnd = windowRange.end;
        const nextRange = computeWindowRange(currentAbsoluteRef.current, poolRef.current.length);
        if (nextRange.start !== prevStart || nextRange.end !== prevEnd) {
            const relativeIndex = applyWindowForAbsolute(currentAbsoluteRef.current);
            if (nextRange.start !== prevStart) {
                pendingScrollRef.current = relativeIndex;
            }
        }
    }, [applyWindowForAbsolute, windowRange.end]);

    ensurePoolAheadRef.current = ensurePoolAhead;

    const navigateToAbsolute = useCallback(
        async (absoluteIndex: number) => {
            if (navLockRef.current || absoluteIndex < 0) {
                return;
            }
            if (absoluteIndex >= poolRef.current.length) {
                navLockRef.current = true;
                await ensurePoolAheadRef.current(absoluteIndex);
                navLockRef.current = false;
                if (absoluteIndex >= poolRef.current.length) {
                    return;
                }
            }
            navLockRef.current = true;
            commitAbsoluteIndex(absoluteIndex, { forceScroll: true });
            navLockRef.current = false;
            void ensurePoolAheadRef.current(absoluteIndex);
        },
        [commitAbsoluteIndex],
    );

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError(null);
            ensureForyouMediaPreconnect(staticBase);
            const result = await fetchForyouList({ mode: 'initial' });
            if (cancelled) {
                return;
            }
            if (!result.ok) {
                setError(result.message);
                setLoading(false);
                return;
            }
            const rows = result.payload.data;
            poolRef.current = rows;
            pageRef.current = result.payload.current_page ?? 1;
            remoteHasMoreRef.current =
                result.payload.has_more ??
                rows.length >= (result.payload.per_page ?? FORYOU_DEFAULT_PER_PAGE);
            currentAbsoluteRef.current = 0;
            setAnchorPlaybackReady(false);
            setActiveAbsolute(0);
            pendingScrollRef.current = 0;
            applyWindowForAbsolute(0);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [sessionBootstrapReady, staticBase, applyWindowForAbsolute]);

    useLayoutEffect(() => {
        if (pendingScrollRef.current == null) {
            return;
        }
        const relativeIndex = pendingScrollRef.current;
        pendingScrollRef.current = null;
        scrollFeedToRelative(relativeIndex);
    }, [windowRange, scrollFeedToRelative]);

    const windowItems = useMemo(() => {
        if (windowRange.end < windowRange.start) {
            return [];
        }
        return poolRef.current.slice(windowRange.start, windowRange.end + 1);
    }, [windowRange]);

    const videos = useMemo(
        () =>
            windowItems
                .map((item, relativeIndex) =>
                    feedItemToVideoItem(
                        item,
                        staticBase,
                        soundOn,
                        windowRange.start + relativeIndex,
                        activeAbsolute,
                        anchorPlaybackReady,
                        !isDesktop,
                    ),
                )
                .filter((item): item is VideoItem => item != null),
        [windowItems, staticBase, soundOn, windowRange.start, activeAbsolute, anchorPlaybackReady, isDesktop],
    );

    const markAnchorPlaybackReady = useCallback(
        (relativeIndex: number) => {
            const absoluteIndex = windowStartRef.current + relativeIndex;
            if (absoluteIndex !== currentAbsoluteRef.current) {
                return;
            }
            setAnchorPlaybackReady(true);
            requestAnimationFrame(() => {
                const nextItem = poolRef.current[absoluteIndex + 1];
                if (!nextItem) {
                    return;
                }
                const nextUrl = resolveFeedVideoUrl(nextItem, staticBase);
                if (!nextUrl) {
                    return;
                }
                const nextVideo = getFeedElement(feedShellRef.current)?.querySelector(
                    `[data-index="${relativeIndex + 1}"] video`,
                ) as HTMLVideoElement | null;
                if (nextVideo) {
                    primeForyouNeighborBuffer(nextVideo, [nextUrl]);
                }
            });
        },
        [staticBase],
    );

    const handleItemVisible = useCallback(
        (_item: VideoItem, relativeIndex: number) => {
            syncVisibleVideoSound(relativeIndex);
            const absoluteIndex = windowStartRef.current + relativeIndex;
            if (absoluteIndex !== currentAbsoluteRef.current) {
                return;
            }
            const video = getFeedElement(feedShellRef.current)?.querySelector(
                `[data-index="${relativeIndex}"] video`,
            ) as HTMLVideoElement | null;
            if (!video) {
                return;
            }
            if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                markAnchorPlaybackReady(relativeIndex);
                return;
            }
            const onCanPlay = () => {
                markAnchorPlaybackReady(relativeIndex);
            };
            video.addEventListener('canplay', onCanPlay, { once: true });
        },
        [markAnchorPlaybackReady, syncVisibleVideoSound],
    );

    const handleItemHidden = useCallback(
        (_item: VideoItem, relativeIndex: number) => {
            /** 手机走原生 scroll + IO，索引提交滞后；abort 容易误杀即将播放的条 */
            if (!isDesktop) {
                return;
            }
            const absoluteIndex = windowStartRef.current + relativeIndex;
            const active = currentAbsoluteRef.current;
            if (Math.abs(absoluteIndex - active) <= 1) {
                return;
            }
            const video = getFeedElement(feedShellRef.current)?.querySelector(
                `[data-index="${relativeIndex}"] video`,
            ) as HTMLVideoElement | null;
            abortForyouVideoLoad(video);
        },
        [isDesktop],
    );

    /** 切条后补跑 anchorReady（IO 可能在 commit 前已触发并被跳过） */
    useLayoutEffect(() => {
        const relative = activeAbsolute - windowRange.start;
        if (relative < 0 || relative >= videos.length) {
            return;
        }
        const video = getFeedElement(feedShellRef.current)?.querySelector(
            `[data-index="${relative}"] video`,
        ) as HTMLVideoElement | null;
        if (!video) {
            return;
        }
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            markAnchorPlaybackReady(relative);
            return;
        }
        const onCanPlay = () => {
            markAnchorPlaybackReady(relative);
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
        return () => {
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [activeAbsolute, markAnchorPlaybackReady, videos.length, windowRange.start]);

    /** 当前条起播后：隐藏池 metadata 预拉 +2，窗口外不占 feed 内并发 */
    useEffect(() => {
        const pool = poolRef.current;
        const keepIds = new Set<number>();
        for (
            let i = Math.max(0, activeAbsolute - 1);
            i <= activeAbsolute + HIDDEN_PREWARM_BELOW_OFFSET;
            i += 1
        ) {
            const item = pool[i];
            if (item) {
                keepIds.add(item.ep_id);
            }
        }
        syncForyouPrewarmWindow([...keepIds]);

        if (!anchorPlaybackReady) {
            return;
        }
        const cleanups: Array<() => void> = [];
        const farIdx = activeAbsolute + HIDDEN_PREWARM_BELOW_OFFSET;
        if (farIdx >= 0 && farIdx < pool.length) {
            cleanups.push(prewarmForyouFeedItem(pool[farIdx], staticBase, 'metadata'));
        }
        return () => {
            for (const fn of cleanups) {
                fn();
            }
        };
    }, [activeAbsolute, anchorPlaybackReady, staticBase]);

    useEffect(() => {
        if (!soundOn) {
            return;
        }
        applySoundToAllMountedVideos(true);
        const relative = activeAbsolute - windowRange.start;
        if (relative >= 0 && relative < videos.length) {
            syncVisibleVideoSound(relative);
        }
    }, [activeAbsolute, applySoundToAllMountedVideos, soundOn, syncVisibleVideoSound, videos.length, windowRange]);

    /** PC：拦截原生滚轮，一次手势只切 1 条 */
    useEffect(() => {
        if (!isDesktop || videos.length === 0) {
            return;
        }
        const shell = feedShellRef.current;
        if (!shell) {
            return;
        }
        const blockNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        shell.addEventListener('wheel', blockNativeWheel, { passive: false });
        const unbindWheelNav = bindVerticalPcWheelNav(shell, {
            onPrev: () => {
                void navigateToAbsolute(currentAbsoluteRef.current - 1);
            },
            onNext: () => {
                void navigateToAbsolute(currentAbsoluteRef.current + 1);
            },
        });
        return () => {
            shell.removeEventListener('wheel', blockNativeWheel);
            unbindWheelNav();
        };
    }, [isDesktop, navigateToAbsolute, videos.length]);

    /** 手机：scroll 停稳后再提交索引，避免 intersection 连跳 */
    useEffect(() => {
        if (isDesktop || videos.length === 0) {
            return;
        }
        const feed = getFeedElement(feedShellRef.current);
        if (!feed) {
            return;
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onScroll = () => {
            if (correctingScrollRef.current) {
                return;
            }
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                const relative = resolveRelativeIndexFromScroll(feed, videos.length - 1);
                let absolute = windowStartRef.current + relative;
                const current = currentAbsoluteRef.current;
                if (Math.abs(absolute - current) > 1) {
                    absolute = current + Math.sign(absolute - current);
                    scrollFeedToRelative(absolute - windowStartRef.current);
                }
                if (absolute === current) {
                    void ensurePoolAheadRef.current(absolute);
                    return;
                }
                commitAbsoluteIndex(absolute);
                void ensurePoolAheadRef.current(absolute);
            }, MOBILE_SCROLL_SETTLE_MS);
        };
        feed.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            feed.removeEventListener('scroll', onScroll);
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [isDesktop, videos.length, commitAbsoluteIndex]);

    const renderVideoOverlay = useCallback(
        (item: VideoItem, relativeIndex: number) => {
            const absoluteIndex = windowRange.start + relativeIndex;
            const title = String(item.metadata?.title ?? '');
            const isActive = absoluteIndex === activeAbsolute;
            return (
                <div
                    style={{
                        position: 'absolute',
                        left: '16px',
                        right: '16px',
                        bottom: '48px',
                        zIndex: 10,
                        pointerEvents: 'none',
                        opacity: isActive ? 1 : 0.45,
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 600,
                            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                        }}
                    >
                        {absoluteIndex + 1}. {title || item.id}
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>
                        window {windowRange.start + 1}–{windowRange.end + 1} · mounted {videos.length}/{MAX_MOUNT}
                    </p>
                    {loadingMore && relativeIndex === videos.length - 1 ? (
                        <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                            Loading more…
                        </p>
                    ) : null}
                </div>
            );
        },
        [activeAbsolute, loadingMore, videos.length, windowRange.end, windowRange.start],
    );

    if (!sessionBootstrapReady || loading) {
        return (
            <div className="fixed inset-0 z-0 flex h-full w-full items-center justify-center bg-black">
                <Loader color="light" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-0 flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/80">
                {error}
            </div>
        );
    }

    if (!videos.length) {
        return (
            <div className="fixed inset-0 z-0 flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/80">
                foryou 接口无可用视频
            </div>
        );
    }

    return (
        <div
            ref={feedShellRef}
            className="fixed inset-0 z-0 h-full w-full overflow-hidden bg-black"
            onPointerDown={() => {
                if (!userUnlockedSoundRef.current) {
                    unlockSoundPermanently();
                    const relative = currentAbsoluteRef.current - windowStartRef.current;
                    syncVisibleVideoSound(Math.max(0, relative));
                }
            }}
        >
            <VerticalFeed
                ref={feedRef}
                items={videos}
                defaultPreload="none"
                threshold={0.92}
                onCurrentItemChange={(relativeIndex) => {
                    syncVisibleVideoSound(relativeIndex);
                }}
                onItemVisible={handleItemVisible}
                onItemHidden={handleItemHidden}
                onEndReached={() => {
                    if (loadingMoreRef.current) {
                        return;
                    }
                    void ensurePoolAhead(currentAbsoluteRef.current);
                }}
                onVideoError={(item, index, err) => {
                    console.warn('[ForDemo] video error', { index, item, err });
                }}
                className="h-full"
                renderItemOverlay={renderVideoOverlay}
            />
            <button
                type="button"
                onClick={() => {
                    if (soundOn && soundUnlocked) {
                        return;
                    }
                    if (soundOn) {
                        disableSound();
                    } else {
                        enableSound();
                    }
                }}
                style={{
                    position: 'fixed',
                    right: '20px',
                    top: '20px',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                }}
            >
                {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                <span style={{ fontSize: '13px' }}>
                    {soundOn
                        ? soundUnlocked
                            ? '有声'
                            : '有声（点屏解锁）'
                        : '点击开声'}
                </span>
            </button>
        </div>
    );
}
