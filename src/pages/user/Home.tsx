
import { Link } from 'react-router';
import { useCallback, useEffect, useRef } from 'react';
import { api, type IPagination } from '@/api';
import { cn } from '@/lib/utils';
import { FormattedMessage } from 'react-intl';
import NoContent from '@/components/NoContent';
import { useHomeStore, type IData } from '@/stores/home';
import { skipRemoteApi } from '@/env';
import { useConfigStore } from '@/stores/config';
import Loader from '@/components/Loader';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { HomeBookShelf } from '@/components/home/HomeBookShelf';
import type { HomeBookItemData } from '@/components/home/HomeBookItem';

const HERO_FADE_MS = 600;
const HERO_AUTOPLAY_MS = 5000;

function heroImageUrl(staticBase: string, imagePath: string) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    return `${staticBase}/${imagePath}`;
}

function itemsFromHomeRail(
    items: {
        id: number;
        title: string;
        image: string;
        episodeSlug?: string;
        episode_slug?: string;
        episodeHref?: string;
        episode_href?: string;
        episodeUrl?: string;
        episode_url?: string;
        movieSlug?: string;
        movie_slug?: string;
        views?: string;
        currentEp?: number;
        totalEp?: number;
        progressPercent?: number;
        showPlayMask?: boolean;
        showExpo?: boolean;
    }[],
): HomeBookItemData[] {
    return items.map((v) => ({
        id: v.id,
        title: v.title,
        image: v.image,
        episodeSlug: normalizeEpisodeSlug(
            v.episodeSlug ??
                v.episode_slug ??
                v.episodeHref ??
                v.episode_href ??
                v.episodeUrl ??
                v.episode_url,
        ),
        movieSlug: v.movieSlug ?? v.movie_slug,
        views: v.views,
        currentEp: v.currentEp,
        totalEp: v.totalEp,
        progressPercent: v.progressPercent,
        showPlayMask: v.showPlayMask,
        showExpo: v.showExpo,
    }));
}

function itemsFromMovieList(list: { [key: string]: unknown }[]): HomeBookItemData[] {
    return list
        .map((v) => {
            const id = Number(v['id']);
            if (!Number.isFinite(id)) return null;
            const title = String(v['title'] ?? v['book_title'] ?? v['name'] ?? '');
            const image = String(v['image'] ?? v['cover'] ?? v['poster'] ?? '');
            const views = v['views'] ?? v['play_count'] ?? v['view_count'];
            return {
                id,
                title,
                image,
                views: views ? String(views) : undefined,
            } satisfies HomeBookItemData;
        })
        .filter(Boolean) as HomeBookItemData[];
}

function toEpisodeOrVideoHref(item: { id: number; episodeSlug?: string }) {
    const slug = normalizeEpisodeSlug(item.episodeSlug);
    return slug ? `/episodes/${slug}` : `/video/${item.id}`;
}

function normalizeReelShortHref(href: string) {
    if (!href) return '/';
    // 支持传入完整 URL：`https://www.reelshort.com/zh-TW/shelf/...`
    if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
            const u = new URL(href);
            return u.pathname + u.search + u.hash;
        } catch {
            return href;
        }
    }
    return href;
}

function normalizeEpisodeSlug(raw?: string) {
    if (!raw) return undefined;
    let v = String(raw).trim();
    if (!v) return undefined;

    // 允许传入完整 URL，取 pathname
    if (v.startsWith('http://') || v.startsWith('https://')) {
        try {
            const u = new URL(v);
            v = u.pathname;
        } catch {
            // ignore
        }
    }

    // 允许传入 `/episodes/<slug>` 或 `episodes/<slug>`，提取 slug
    v = v.replace(/^[#/]/, '');
    const m = v.match(/(?:^|\/)episodes\/([^/?#]+)$/i);
    if (m) return decodeURIComponent(m[1]);
    if (v.startsWith('episodes/')) return decodeURIComponent(v.slice('episodes/'.length));

    // 最常见：直接就是 `episode-2-...`
    return decodeURIComponent(v);
}

/** ReelShort 首页 Banner 播放按钮内联三角图标（与镜像 HTML 一致） */
function HeroPlayIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className={className}
            aria-hidden
        >
            <path
                fill="currentColor"
                fillOpacity={0.9}
                d="M4.488 7.04c.817-4.063 2.618-4.91 6.539-3.218a31.933 31.933 0 0 1 7.617 4.624c3.141 2.58 3.141 4.423 0 7.003a31.936 31.936 0 0 1-7.617 4.624c-3.92 1.692-5.722.845-6.54-3.218a24.93 24.93 0 0 1 0-9.815"
            />
        </svg>
    );
}


export default function Component() {
    const configStore = useConfigStore();
    const homeStore = useHomeStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const searching = useRef(false);
    const requesting = useRef(false);
    const didRestoreScrollRef = useRef(false);
    const heroTouchStartX = useRef(0);
    const heroPointer = useRef<{ id: number; startX: number } | null>(null);
    const heroAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function handleManualLoadMore() {
        loadLatest(homeStore.page + 1);
    }

    function handleScroll(e: React.UIEvent<HTMLDivElement>) {
        homeStore.setScrollTop(e.currentTarget.scrollTop);
    }

    async function loadLatest(p = 1) {
        // 首页不再使用离线 mock 数据：skipRemoteApi 时不加载列表，保持空态
        if (skipRemoteApi) return;
        const state = useHomeStore.getState();
        if (p <= state.page || !state.more || requesting.current) {
            return;
        }
        requesting.current = true;
        const result = await api<IPagination>('movie', {
            loading: false,
            data: {
                page: p,
            },
        }).finally(() => {
            requesting.current = false;
            searching.current = false;
        });
        state.setPage(p);
        state.setList([...state.list, ...result.d.data]);
        state.setMore(result.d.per_page === result.d.data.length);
    }

    useEffect(() => {
        // 仅在“返回首页且已有缓存列表”时恢复滚动；分页追加时不要反复重置 scrollTop（会跳回某个标题位置）
        if (homeStore.list.length > 0) {
            if (didRestoreScrollRef.current) return;
            if (!scrollRef.current) return;
            scrollRef.current.scrollTop = useHomeStore.getState().scrollTop;
            didRestoreScrollRef.current = true;
            return;
        }
        loadLatest();
    }, [homeStore.list.length]);

    const topList = homeStore.data?.top ?? [];
    const topLen = topList.length;
    const currentHero =
        topLen > 0 ? topList[Math.min(Math.max(homeStore.current, 0), topLen - 1)] : undefined;

    const scheduleHeroAutoplay = useCallback(() => {
        if (heroAutoplayRef.current) {
            clearInterval(heroAutoplayRef.current);
            heroAutoplayRef.current = null;
        }
        if (topLen <= 1) {
            return;
        }
        heroAutoplayRef.current = setInterval(() => {
            const { current, setCurrent } = useHomeStore.getState();
            setCurrent((current + 1) % topLen);
        }, HERO_AUTOPLAY_MS);
    }, [topLen]);

    useEffect(() => {
        if (topLen > 0) {
            const { current, setCurrent } = useHomeStore.getState();
            if (current >= topLen) {
                setCurrent(0);
            }
        }
    }, [topLen]);

    useEffect(() => {
        scheduleHeroAutoplay();
        return () => {
            if (heroAutoplayRef.current) {
                clearInterval(heroAutoplayRef.current);
            }
        };
    }, [scheduleHeroAutoplay]);

    function goHeroIndex(next: number) {
        if (topLen <= 0) {
            return;
        }
        const i = ((next % topLen) + topLen) % topLen;
        homeStore.setCurrent(i);
        scheduleHeroAutoplay();
    }

    function handleHeroTouchStart(e: React.TouchEvent) {
        heroTouchStartX.current = e.touches[0].clientX;
    }

    function handleHeroTouchEnd(e: React.TouchEvent) {
        if (topLen <= 1) {
            return;
        }
        const dx = e.changedTouches[0].clientX - heroTouchStartX.current;
        if (Math.abs(dx) < 48) {
            return;
        }
        const { current } = useHomeStore.getState();
        if (dx < 0) {
            goHeroIndex(current + 1);
        } else {
            goHeroIndex(current - 1);
        }
    }

    function handleHeroPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if (topLen <= 1) return;
        // only handle mouse/pen; touch is handled by onTouchStart/End
        if (e.pointerType === 'touch') return;
        // 不要在封面/播放等 Link 或圆点上 capture，否则 PC 上子级收不到 click，无法跳转
        const t = e.target as HTMLElement | null;
        if (t?.closest('a[href], button')) return;
        heroPointer.current = { id: e.pointerId, startX: e.clientX };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function handleHeroPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
        const p = heroPointer.current;
        if (!p || p.id !== e.pointerId) return;
        heroPointer.current = null;
        if (topLen <= 1) return;
        const dx = e.clientX - p.startX;
        if (Math.abs(dx) < 48) return;
        const { current } = useHomeStore.getState();
        if (dx < 0) goHeroIndex(current + 1);
        else goHeroIndex(current - 1);
    }

    useEffect(() => {
        const state = useHomeStore.getState();
        if (skipRemoteApi) {
            state.setData(undefined);
            state.setLoading(false);
            return;
        }
        api<IData>('home', { loading: false })
            .then((res) => {
                if (res.c === 0) {
                    state.setData(res.d);
                }
                state.setLoading(false);
            })
            .catch(() => {
                state.setLoading(false);
            });
    }, []);

    const firstHeroSrc = homeStore.data?.top[0]
        ? heroImageUrl(configStore.config['static'] as string, homeStore.data.top[0].image as string)
        : undefined;

    useEffect(() => {
        if (!firstHeroSrc) {
            return;
        }
        const id = 'home-hero-lcp-preload';
        if (document.getElementById(id)) {
            return;
        }
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'preload';
        link.as = 'image';
        link.href = firstHeroSrc;
        link.setAttribute('fetchpriority', 'high');
        document.head.appendChild(link);
        return () => {
            link.remove();
        };
    }, [firstHeroSrc]);

    return <div className='flex h-full min-h-0 flex-col bg-app-canvas'>
        {homeStore.loading ? <Loader /> : (homeStore.data?.top.length === 0 || homeStore.data?.recommend.length === 0) ? <NoContent /> : <div className='min-w-0 flex-1 overflow-y-auto' ref={scrollRef} onScroll={handleScroll}>
            <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
            <div className="h-40"></div>
            <div className="relative z-10 -mt-[min(calc(22*var(--app-vw)/100),5.5rem)]">
                <div className="home-hero-shell w-full overflow-hidden" style={{ direction: 'ltr' }}>
                    <div
                        className="home-hero-viewport relative touch-pan-y overflow-hidden"
                        onTouchStart={handleHeroTouchStart}
                        onTouchEnd={handleHeroTouchEnd}
                        onPointerDown={handleHeroPointerDown}
                        onPointerUp={handleHeroPointerEnd}
                        onPointerCancel={handleHeroPointerEnd}
                    >
                        <div className="absolute inset-0 z-0 bg-black" aria-hidden />
                        {topList.map((v, i) => {
                            const active = i === homeStore.current;
                            return (
                                <div
                                    key={v.id}
                                    className={cn(
                                        'absolute inset-0 z-[1] bg-black transition-all ease',
                                        active ? 'opacity-100' : 'opacity-0',
                                    )}
                                    style={{
                                        transitionDuration: `${HERO_FADE_MS}ms`,
                                        pointerEvents: active ? 'auto' : 'none',
                                    }}
                                    aria-hidden={!active}
                                >
                                    <Link
                                        to={toEpisodeOrVideoHref(v)}
                                        className="relative block h-full min-h-0 w-full overflow-hidden"
                                    >
                                        <img
                                            src={heroImageUrl(configStore.config['static'] as string, v.image)}
                                            alt=""
                                            decoding="async"
                                            loading={i === 0 ? 'eager' : 'lazy'}
                                            {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                                            className="home-hero-cover-img absolute inset-0 h-full w-full"
                                        />
                                    </Link>
                                </div>
                            );
                        })}
                        <div className="pointer-events-none absolute inset-0 z-[2] isolate">
                            <div
                                className="absolute bottom-0 left-0 right-0 z-[-1] h-[40%] max-h-[170px] bg-gradient-to-t from-black to-transparent md:max-h-[170px]"
                                aria-hidden
                            />
                            <div className="absolute inset-0 z-0 home-hero-radial-glow" aria-hidden />
                            <div
                                className="absolute inset-y-0 left-0 z-[1] w-[19%] home-hero-gradient-l"
                                aria-hidden
                            />
                            <div
                                className="absolute inset-y-0 right-0 z-[1] w-[19%] home-hero-gradient-r"
                                aria-hidden
                            />
                            <div
                                className="absolute left-0 right-0 top-0 z-[2] h-[40%] max-h-[170px] bg-gradient-to-b from-black to-transparent md:max-h-[170px]"
                                aria-hidden
                            />
                            {topLen > 0 ? (
                                <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col">
                                    <div className="pointer-events-auto absolute left-1/2 top-0 h-full w-full max-w-full -translate-x-1/2">
                                        {currentHero ? (
                                            <div
                                                className={cn(
                                                    'absolute bottom-[calc(16/375*var(--app-vw))] left-0 flex w-full flex-col items-center justify-center',
                                                )}
                                            >
                                                <h2
                                                    className={cn(
                                                        'mb-[calc(16/375*var(--app-vw))] w-[calc(343/375*var(--app-vw))] max-w-full break-words text-center font-bold leading-[120%] text-white/90',
                                                        'text-[calc(24/375*var(--app-vw))]',
                                                    )}
                                                >
                                                    {currentHero.title}
                                                </h2>
                                                <Link
                                                    to={toEpisodeOrVideoHref(currentHero)}
                                                    className={cn(
                                                        'flex cursor-pointer items-center justify-center bg-white font-bold text-black',
                                                        'h-[calc(40/375*var(--app-vw))] w-[calc(168/375*var(--app-vw))] rounded-[calc(4/375*var(--app-vw))] py-[calc(11/375*var(--app-vw))] text-[calc(16/375*var(--app-vw))]',
                                                    )}
                                                >
                                                    <HeroPlayIcon className="mr-[calc(4/375*var(--app-vw))] h-[calc(16/375*var(--app-vw))] w-[calc(16/375*var(--app-vw))] shrink-0" />
                                                    <FormattedMessage id="play" />
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        {topLen > 0 ? (
                            <div
                                className={cn(
                                    'home-hero-banner-dots pointer-events-auto absolute bottom-0 left-0 right-0 z-[4] flex w-full justify-center gap-[calc(6/375*var(--app-vw))]',
                                    'bg-gradient-to-b from-transparent via-black/30 to-app-canvas',
                                )}
                                role="tablist"
                                aria-label="Banner"
                            >
                                {topList.map((v, i) => {
                                    const dotActive = i === homeStore.current;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            role="tab"
                                            className="home-hero-banner-dots__tab"
                                            aria-selected={dotActive}
                                            aria-current={dotActive ? 'true' : undefined}
                                            aria-label={`Slide ${i + 1}`}
                                            onClick={() => goHeroIndex(i)}
                                        >
                                            <span className="home-hero-banner-dots__thumb" aria-hidden />
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="HomePage_main__BzEnK">
                {homeStore.data?.shelves?.map((shelf) => (
                    <HomeBookShelf
                        key={shelf.titleMessageId}
                        titleMessageId={shelf.titleMessageId}
                        titleHref={normalizeReelShortHref(
                            shelf.titleHref ??
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (shelf as any).title_href ??
                                '/',
                        )}
                        viewAllHref={normalizeReelShortHref(
                            shelf.viewAllHref ??
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (shelf as any).view_all_href ??
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (shelf as any).view_all ??
                                '/',
                        )}
                        staticBase={configStore.config['static'] as string}
                        items={itemsFromHomeRail(shelf.items)}
                    />
                ))}

                {homeStore.data?.rank?.length ? (
                    <HomeBookShelf
                        titleMessageId="rankings"
                        titleHref="/"
                        viewAllHref="/"
                        staticBase={configStore.config['static'] as string}
                        items={itemsFromHomeRail(homeStore.data.rank)}
                    />
                ) : null}

                {/* 为您推荐：来自 home.recommend（不做分页追加） */}
                <HomeBookShelf
                    titleMessageId="for_you"
                    titleHref="/"
                    viewAllHref="/"
                    staticBase={configStore.config['static'] as string}
                    items={itemsFromHomeRail(homeStore.data?.recommend ?? [])}
                />

                {/* 最近更新：来自 movie 列表分页（More Movies 追加到同一栏） */}
                {homeStore.list.length ? (
                    <HomeBookShelf
                        titleMessageId="latest_updates"
                        titleHref="/"
                        viewAllHref="/"
                        staticBase={configStore.config['static'] as string}
                        items={itemsFromMovieList(homeStore.list as { [key: string]: unknown }[])}
                        type="type_5"
                        showMoreMoviesButton={homeStore.more}
                        onMoreMoviesClick={handleManualLoadMore}
                    />
                ) : null}
            </div>
            <ReelShortFooter />
        </div>}
    </div>
}
