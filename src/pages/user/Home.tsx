
import { Link } from 'react-router';
import { useCallback, useEffect, useRef } from 'react';
import { api, type IPagination } from '@/api';
import { cn } from '@/lib/utils';
import Image from '@/components/Image';
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

const HERO_FADE_MS = 600;
const HERO_AUTOPLAY_MS = 5000;

function heroImageUrl(staticBase: string, imagePath: string) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    return `${staticBase}/${imagePath}`;
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
    }, []);

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
        if (skipRemoteApi) {
            homeStore.setData(offlineHomeData);
            homeStore.setLoading(false);
            return;
        }
        api<IData>('home', {
            loading: false,
        }).then(res => {
            homeStore.setData(res.d);
            homeStore.setLoading(false);
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
            <ReelShortTopNav scrollParentRef={scrollRef} />
            <div className="relative z-10 -mt-[min(22vw,5.5rem)] md:-mt-[66px]">
                <div className="home-hero-shell w-full overflow-hidden" style={{ direction: 'ltr' }}>
                    <div
                        className="home-hero-viewport relative touch-pan-y overflow-hidden"
                        onTouchStart={handleHeroTouchStart}
                        onTouchEnd={handleHeroTouchEnd}
                    >
                        <div
                            className="pointer-events-none absolute left-0 right-0 top-0 z-[5] h-[40%] max-h-[170px] bg-gradient-to-b from-black to-transparent md:max-h-[170px]"
                            aria-hidden
                        />
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
                                        to={`/video/${v.id}`}
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
                        <div className="pointer-events-none absolute inset-0 z-[2] home-hero-radial-glow" aria-hidden />
                        <div
                            className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[19%] home-hero-gradient-l"
                            aria-hidden
                        />
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-[19%] home-hero-gradient-r"
                            aria-hidden
                        />
                        {topLen > 0 ? (
                            <div className="pointer-events-none absolute inset-0 z-[4] flex flex-col">
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
                                                to={`/video/${currentHero.id}`}
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
                </div>
            </div>
            {topLen > 0 ? (
                <div
                    className={cn(
                        'flex w-full justify-center gap-[calc(6/375*100vw)] px-4',
                        'bg-gradient-to-b from-transparent via-black/30 to-app-canvas',
                        'pb-[calc(10/375*100vw)] pt-[calc(14/375*100vw)]',
                        'md:justify-end md:gap-2 md:pr-[250px] md:pb-3 md:pt-3',
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
                                aria-selected={dotActive}
                                aria-current={dotActive ? 'true' : undefined}
                                aria-label={`Slide ${i + 1}`}
                                className={cn(
                                    'relative shrink-0 cursor-pointer rounded-full',
                                    'h-[calc(4/375*100vw)] min-h-[4px] w-[calc(4/375*100vw)] min-w-[4px]',
                                    'bg-gradient-to-b from-white/[0.52] to-white/[0.18]',
                                    'shadow-[0_1px_3px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]',
                                    'md:h-[6px] md:w-[6px]',
                                    'transition-[width,background,box-shadow,border-radius] duration-300 ease-out',
                                    dotActive &&
                                        'w-[calc(24/375*100vw)] rounded-[calc(5/375*100vw)] bg-gradient-to-r from-white from-[20%] via-white to-white/[0.72] shadow-[0_1px_4px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] md:w-[32px] md:rounded-[5px]',
                                )}
                                onClick={() => goHeroIndex(i)}
                            />
                        );
                    })}
                </div>
            ) : null}
            <div className='mb-2 mt-4 flex items-center gap-2 px-4 text-lg font-bold text-white'>
                <div><FormattedMessage id="for_you" /></div>
            </div>
            <div className='mx-4 flex w-[calc(100%-theme(spacing.8))] gap-4 overflow-x-auto'>
                {homeStore.data?.recommend.map(v => <Link to={`/video/${v.id}`} key={v.id} className='w-3/12 flex flex-col gap-1'>
                    <Image height={1.3325} width={`${window.document.body.clientWidth / 4}px`} alt={v.title as string} src={`${configStore.config['static']}/${v.image}`} />
                    <div className='w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white/90'>{v.title}</div>
                </Link>)}
            </div>
            <div className='mb-2 mt-6 flex items-center gap-2 px-4 text-lg font-bold text-white'>
                <div><FormattedMessage id="rankings" /></div>
            </div>
            <div className='mx-4 flex w-[calc(100%-theme(spacing.8))] gap-4 overflow-x-auto'>
                {homeStore.data?.rank.map(v => <Link to={`/video/${v.id}`} key={v.id} className='w-3/12 flex flex-col gap-1'>
                    <Image height={1.3325} width={`${window.document.body.clientWidth / 4}px`} alt={v.title as string} src={`${configStore.config['static']}/${v.image}`} />
                    <div className='w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white/90'>{v.title}</div>
                </Link>)}
            </div>
            <div className='mb-2 mt-6 flex items-center gap-2 px-4 text-lg font-bold text-white'>
                <div><FormattedMessage id="latest_updates" /></div>
            </div>
            {!homeStore.loading && homeStore.list.length === 0 ? <NoContent /> : <div className={cn('flex-1 grid grid-cols-3 gap-4 px-4 pb-4 auto-rows-max')}>
                {homeStore.loading ? <div /> : homeStore.list.map(v => <Link to={`/video/${v['id']}`} key={v['id'] as string}>
                    <Image height={1.3325} width={`${(window.document.body.clientWidth - 64) / 3}px`} alt={v['title'] as string} src={`${configStore.config['static']}/${v['image']}`} />
                    <div className='p-1'>
                        <div className='line-clamp-2 overflow-hidden text-ellipsis text-sm leading-[18px] text-white/90'>{`${v['title']}`}</div>
                    </div>
                </Link>)}
                <InView as="div" onChange={handleMoreChange} className="col-span-full flex h-12 items-center justify-center">
                    {homeStore.more ? <LoaderCircle className="h-8 w-8 animate-[spin_1.5s_ease_infinite] text-white/45" /> : <div className='text-white/45'><FormattedMessage id="no_more" /></div>}
                </InView>
            </div>}
            <ReelShortFooter />
        </div>}
    </div>
}
