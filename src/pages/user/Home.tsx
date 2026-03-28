
import { Link } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { api, type IPagination } from '@/api';
import { cn } from '@/lib/utils';
import Image from '@/components/Image';
import { LoaderCircle } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { InView } from 'react-intersection-observer';
import NoContent from '@/components/NoContent';
import { useHomeStore, type IData } from '@/stores/home';
import { useConfigStore } from '@/stores/config';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Loader from '@/components/Loader';


export default function Component() {
    const intl = useIntl();
    const configStore = useConfigStore();
    const homeStore = useHomeStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const searching = useRef(false);
    const requesting = useRef(false);

    const [carousel, setCarousel] = useState<CarouselApi>();

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

    useEffect(() => {
        if (!carousel) {
            return;
        }
        carousel.on("select", () => {
            homeStore.setCurrent(carousel!.selectedScrollSnap());
        });
        carousel.scrollTo(homeStore.current, true);
    }, [carousel]);

    useEffect(() => {
        api<IData>('home', {
            loading: false,
        }).then(res => {
            homeStore.setData(res.d);
            homeStore.setLoading(false);
        });
    }, []);

    return <div className='flex flex-col h-full'>
        <div className="h-16 shrink-0 px-4 bg-white flex gap-2 justify-between items-center border-b border-slate-200">
            <div className='flex gap-2 items-center'>
                <img src="/logo.png" alt="logo" className='w-6 h-6 rounded-full' />
                <span className='font-bold text-slate-600 '>
                    <FormattedMessage id="site_name" />
                </span>
            </div>
            <label className="h-8 w-40 flex items-center border border-slate-300 rounded bg-slate-50 focus-within:bg-slate-100">
                <Link to="/page/search" className="px-2 w-full h-full outline-none py-0 text-center text-sm flex items-center justify-center text-muted-foreground">{intl.formatMessage({ id: 'flix_search' })}</Link>
            </label>
        </div>
        {homeStore.loading ? <Loader /> : (homeStore.data?.top.length === 0 || homeStore.data?.rank.length === 0 || homeStore.data?.recommend.length === 0) ? <NoContent /> : <div className='overflow-y-auto' ref={scrollRef} onScrollEnd={handleScrollEnd}>
            <div className='relative py-4' style={{direction: 'ltr'}}>
                <div className={`absolute w-full h-full bg-center blur-lg top-0`} style={{
                    backgroundImage: `url(${configStore.config['static']}/${homeStore.data?.top[homeStore.current].image})`
                }} />
                <Carousel opts={{
                    loop: true,
                }} setApi={setCarousel} style={{direction: 'ltr'}}>
                    <CarouselContent className='h-80' style={{direction: 'ltr'}}>
                        {homeStore.data?.top.map((v, k) => <CarouselItem key={v.id} className='flex justify-center items-center basis-60'>
                            <Link to={`/video/${v.id}`}><img src={`${configStore.config['static']}/${v.image}`} className={cn('transition-all rounded-md', k === homeStore.current ? 'h-72' : 'h-60')} /></Link>
                        </CarouselItem>)}
                    </CarouselContent>
                </Carousel>
            </div>
            <div className='mb-2 mt-4 px-4 text-lg flex gap-2 items-center font-bold'>
                {/* <Flame className='w-5 h-5 text-orange-400' /> */}
                <div><FormattedMessage id="for_you" /></div>
            </div>
            <div className='mx-4 flex gap-4 w-[calc(100%-theme(spacing.8))] overflow-x-auto'>
                {homeStore.data?.recommend.map(v => <Link to={`/video/${v.id}`} key={v.id} className='w-3/12 flex flex-col gap-1'>
                    <Image height={1.3325} width={`${window.document.body.clientWidth / 4}px`} alt={v.title as string} src={`${configStore.config['static']}/${v.image}`} />
                    <div className='text-sm whitespace-nowrap text-ellipsis w-full overflow-hidden'>{v.title}</div>
                </Link>)}
            </div>
            <div className='mb-2 mt-6 px-4 text-lg flex gap-2 items-center font-bold'>
                {/* <Trophy className='w-5 h-5 text-red-400' /> */}
                <div><FormattedMessage id="rankings" /></div>
            </div>
            <div className='mx-4 flex gap-4 w-[calc(100%-theme(spacing.8))] overflow-x-auto'>
                {homeStore.data?.rank.map(v => <Link to={`/video/${v.id}`} key={v.id} className='w-3/12 flex flex-col gap-1'>
                    <Image height={1.3325} width={`${window.document.body.clientWidth / 4}px`} alt={v.title as string} src={`${configStore.config['static']}/${v.image}`} />
                    <div className='text-sm whitespace-nowrap text-ellipsis w-full overflow-hidden'>{v.title}</div>
                </Link>)}
            </div>
            <div className='mb-2 mt-6 px-4 text-lg flex gap-2 items-center font-bold'>
                {/* <Clock className='w-5 h-5 text-pink-400' /> */}
                <div><FormattedMessage id="latest_updates" /></div>
            </div>
            {!homeStore.loading && homeStore.list.length === 0 ? <NoContent /> : <div className={cn('flex-1 grid grid-cols-3 gap-4 px-4 pb-4 auto-rows-max')}>
                {homeStore.loading ? <div /> : homeStore.list.map(v => <Link to={`/video/${v['id']}`} key={v['id'] as string}>
                    <Image height={1.3325} width={`${(window.document.body.clientWidth - 64) / 3}px`} alt={v['title'] as string} src={`${configStore.config['static']}/${v['image']}`} />
                    <div className='p-1'>
                        <div className='text-sm text-ellipsis overflow-hidden line-clamp-2 leading-[18px]'>{`${v['title']}`}</div>
                    </div>
                </Link>)}
                <InView as="div" onChange={handleMoreChange} className="h-12 flex justify-center items-center col-span-full">
                    {homeStore.more ? <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" /> : <div className='text-slate-400'><FormattedMessage id="no_more" /></div>}
                </InView>
            </div>}
        </div>}
    </div>
}
