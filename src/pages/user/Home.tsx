
import { Link } from 'react-router';
import { useCallback, useEffect, useRef } from 'react';
import { api, type IPagination } from '@/api';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { InView } from 'react-intersection-observer';
import NoContent from '@/components/NoContent';
import { useHomeStore, type IData } from '@/stores/home';
import { skipRemoteApi } from '@/env';
import { offlineHomeData, offlineHomeList } from '@/mocks/homeOffline';
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
        episodeSlug: v.episodeSlug ?? v.episode_slug,
        movieSlug: v.movieSlug ?? v.movie_slug,
        views: v.views,
        currentEp: v.currentEp,
        totalEp: v.totalEp,
        progressPercent: v.progressPercent,
        showPlayMask: v.showPlayMask,
        showExpo: v.showExpo,
    }));
}

function toEpisodeOrVideoHref(item: { id: number; episodeSlug?: string }) {
    return item.episodeSlug ? `/episodes/${item.episodeSlug}` : `/video/${item.id}`;
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
    const heroTouchStartX = useRef(0);
    const heroAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function handleMoreChange(visible: boolean) {
        if (searching.current) {
            return;
        }
        if (!visible) {
            return;
        }

        loadLatest(homeStore.page + 1);
    }

    function handleManualLoadMore() {
        loadLatest(homeStore.page + 1);
    }

    function handleScrollEnd(e: React.UIEvent<HTMLDivElement>) {
        homeStore.setScrollTop(e.currentTarget.scrollTop);
    }

    async function loadLatest(p = 1) {
        if (skipRemoteApi) {
            const state = useHomeStore.getState();
            state.setList(offlineHomeList);
            state.setPage(1);
            state.setMore(false);
            requesting.current = false;
            searching.current = false;
            return;
        }
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
        if (homeStore.list.length > 0) {
            if (!scrollRef.current) {
                return;
            }
            scrollRef.current.scrollTop = homeStore.scrollTop;
        } else {
            loadLatest();
        }
    }, [homeStore.list.length, homeStore.scrollTop]);

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

    useEffect(() => {
        const state = useHomeStore.getState();
        if (skipRemoteApi) {
            state.setData(offlineHomeData);
            state.setLoading(false);
            return;
        }
        api<IData>('home', {
            loading: false,
        }).then(res => {
            state.setData(res.d);
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

    return <div className='flex h-full flex-col bg-app-canvas'>
        {homeStore.loading ? <Loader /> : (homeStore.data?.top.length === 0 || homeStore.data?.rank.length === 0 || homeStore.data?.recommend.length === 0) ? <NoContent /> : <div className='overflow-y-auto flex-1' ref={scrollRef} onScrollEnd={handleScrollEnd}>
            <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
            <div className="relative z-10 -mt-[min(22vw,5.5rem)] md:-mt-[66px]">
                <div className="home-hero-shell w-full overflow-hidden" style={{ direction: 'ltr' }}>
                    <div
                        className="home-hero-viewport relative touch-pan-y overflow-hidden"
                        onTouchStart={handleHeroTouchStart}
                        onTouchEnd={handleHeroTouchEnd}
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
                                            className="absolute inset-0 h-full w-full object-cover object-[67%_center]"
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
                                    <div className="pointer-events-auto absolute left-1/2 top-0 h-full w-full max-w-full -translate-x-1/2 md:max-w-[1636px]">
                                        {currentHero ? (
                                            <div
                                                className={cn(
                                                    'absolute bottom-[calc(16/375*100vw)] left-0 flex w-full flex-col items-center justify-center',
                                                    'md:bottom-[40px] md:left-[72px] md:items-start md:bottom-[40px] md:left-[80px]',
                                                    'lg:left-[110px] xl:left-[130px] 2xl:left-[108px]',
                                                )}
                                            >
                                                <h2
                                                    className={cn(
                                                        'mb-[calc(16/375*100vw)] w-[calc(343/375*100vw)] max-w-full break-words text-center font-bold leading-[120%] text-white/90',
                                                        'text-[calc(24/375*100vw)] md:mb-3 md:w-[280px] md:max-w-[280px] md:text-start md:text-[20px]',
                                                        'lg:mb-5 lg:w-[400px] lg:max-w-[400px] lg:text-[28px]',
                                                        'xl:w-[480px] xl:max-w-[480px] xl:text-[32px]',
                                                        '2xl:mb-6 2xl:w-[560px] 2xl:max-w-[560px] 2xl:text-[40px]',
                                                    )}
                                                >
                                                    {currentHero.title}
                                                </h2>
                                                <Link
                                                    to={toEpisodeOrVideoHref(currentHero)}
                                                    className={cn(
                                                        'flex cursor-pointer items-center justify-center bg-white font-bold text-black',
                                                        'h-[calc(40/375*100vw)] w-[calc(168/375*100vw)] rounded-[calc(4/375*100vw)] py-[calc(11/375*100vw)] text-[calc(16/375*100vw)]',
                                                        'md:h-9 md:w-[168px] md:rounded-[4px] md:py-[9px] md:text-[16px]',
                                                        'lg:h-12 lg:w-[200px] lg:py-[13px] lg:text-[18px]',
                                                        'xl:h-14 xl:py-[17px]',
                                                        '2xl:h-[60px] 2xl:w-[240px] 2xl:py-[18px] 2xl:text-[20px]',
                                                    )}
                                                >
                                                    <HeroPlayIcon className="mr-[calc(4/375*100vw)] h-[calc(16/375*100vw)] w-[calc(16/375*100vw)] shrink-0 md:mr-2 md:h-6 md:w-6" />
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
                                    'home-hero-banner-dots pointer-events-auto absolute bottom-0 left-0 right-0 z-[4] flex w-full justify-center gap-[calc(6/375*100vw)]',
                                    'bg-gradient-to-b from-transparent via-black/30 to-app-canvas',
                                    'md:bottom-[40px] md:right-[250px] md:w-auto md:justify-end md:gap-2',
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
                        titleHref={normalizeReelShortHref(shelf.titleHref ?? '/')}
                        viewAllHref={normalizeReelShortHref(shelf.viewAllHref ?? '/')}
                        staticBase={configStore.config['static'] as string}
                        items={itemsFromHomeRail(shelf.items)}
                    />
                ))}

                {/* 观剧寰宇：要求最后一个书架 */}
                <HomeBookShelf
                    titleMessageId="home_shelf_drama_world"
                    titleHref="/"
                    viewAllHref="/"
                    staticBase={configStore.config['static'] as string}
                    items={itemsFromHomeRail(homeStore.data?.recommend ?? [])}
                    type="type_5"
                    showMoreMoviesButton
                />
                <InView
                    as="div"
                    onChange={handleMoreChange}
                    className="HomePage_listLoader__rs"
                    onClick={handleManualLoadMore}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleManualLoadMore();
                        }
                    }}
                >
                    {homeStore.more ? (
                        <LoaderCircle className="inline-block h-8 w-8 animate-[spin_1.5s_ease_infinite] align-middle text-white/45" />
                    ) : homeStore.list.length > 0 ? (
                        <span className="text-white/45">
                            <FormattedMessage id="no_more" />
                        </span>
                    ) : null}
                </InView>
            </div>
            <ReelShortFooter />
        </div>}
    </div>
}
