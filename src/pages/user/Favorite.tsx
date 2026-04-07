import { Link } from "react-router";
import { Star as IconStar } from 'lucide-react';
import { FormattedMessage } from "react-intl";
import { useEffect, useRef, useState } from "react";
import { api, type IPagination, type TData } from "@/api";
import NoContent from "@/components/NoContent";
import { InView } from "react-intersection-observer";
import { LoaderCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cn } from "@/lib/utils";
import Loader from "@/components/Loader";
import { useGesture } from '@use-gesture/react';
import FlixActionSheet from "@/widgets/FlixActionSheet";
import { useConfigStore } from "@/stores/config";
import { skipRemoteApi } from '@/env';
import { offlineFavoriteList } from '@/mocks/myListOffline';

export default function Component() {
    const configStore = useConfigStore();
    const requesting = useRef(false);
    const gesture = useGesture({
        onDrag: (event) => {
            if (event.movement[0] !== 0 || event.movement[1] !== 0) {
                return;
            }
            if (event.active) {
                const id = parseInt((event.currentTarget as HTMLElement).dataset['id'] ?? '0', 10);
                setSheetAction(id);
            }
        },
    }, {
        drag: {
            enabled: true,
            delay: true,
            threshold: 5,
            
        },
    });
    const [list, setList] = useState<TData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [more, setMore] = useState(true);
    const [sheetAction, setSheetAction] = useState(0);

    function handleMoreChange(visible: boolean) {
        if (!visible) {
            return;
        }

        loadData(page + 1);
    }

    function handleCancelFavorite(id: number) {
        if (!skipRemoteApi) {
            api('movie/favorite', {
                method: 'post',
                data: {
                    id,
                    time: 0,
                },
                loading: false,
            });
        }

        setList(list.filter(v => v['movie_id'] !== id));
    }

    function handleSheetActionClose() {
        setSheetAction(0);
    }

    function handleSheetAction(type: string) {
        switch (type) {
            case 'delete':
                if (!skipRemoteApi) {
                    api('movie/favorite/delete', {
                        method: 'post',
                        data: {
                            id: sheetAction,
                        },
                    });
                }
                setList([...list.filter(v => v.id !== sheetAction)]);
                break;
        }
        setSheetAction(0);
    }

    async function loadData(p = 1) {
        if (p <= page || !more || requesting.current) {
            return;
        }
        requesting.current = true;
        if (skipRemoteApi) {
            setPage(p);
            setList((prev) => [...prev, ...offlineFavoriteList]);
            setMore(false);
            requesting.current = false;
            return;
        }
        const result = await api<IPagination>('movie/my-list', {
            loading: false,
            data: {
                page: p,
            }
        }).finally(() => {
            requesting.current = false;
        });
        setPage(p);
        setList([...list, ...result.d.data]);
        setMore(result.d.per_page === result.d.data.length);
    }

    useEffect(() => {
        loadData().then(() => {
            setLoading(false);
        });
    }, []);

    return loading ? <div className="w-full h-full flex justify-center items-center">
        <Loader />
    </div> : (list.length > 0 ? <div className="p-4 grid gap-4">
        {list.map(v => <div key={v['id'] as number} className="flex gap-2 h-40 touch-none select-none" data-id={v['id']} {...gesture()}>
            <Link to={`/video/${v['movie_id']}`} className="relative h-full w-[calc(theme(spacing.40)/1.3325)]">
                <Skeleton className='bg-slate-300 absolute w-full top-0 left-0 h-full rounded-md'>
                    <div className='absolute w-full h-full flex justify-center items-center font-bold text-xl text-slate-400'>
                        <FormattedMessage id="site_name" />
                    </div>
                </Skeleton>
                <LazyLoadImage alt={''} src={`${configStore.config['static']}/${v['image'] as number}`} onLoad={e => e.currentTarget.style.opacity = '1'} className='top-0 left-0 absolute w-full rounded-md transition-opacity duration-1000 opacity-0' />
            </Link>
            <div className='flex flex-col justify-between flex-1'>
                <div className="p-1">
                    <Link to={`/video/${v['movie_id']}`} className='text-ellipsis overflow-hidden line-clamp-2 leading-[18px]'>{v['title'] as string}</Link>
                    <div className="text-slate-400 mt-2 text-sm">Episodes {v['episodes'] as number}</div>
                </div>
                <div className="flex justify-between">
                    <div className="flex-1" />
                    <div onClick={() => handleCancelFavorite(v['movie_id'] as number)}>
                        <IconStar className={cn("w-6 h-6 text-amber-500 fill-amber-500")} />
                    </div>
                </div>
            </div>
        </div>)}
        <InView as="div" onChange={handleMoreChange} className="h-12 flex justify-center items-center col-span-full">
            {more ? <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" /> : <div className='text-slate-400'><FormattedMessage id="no_more" /></div>}
        </InView>
        <FlixActionSheet open={sheetAction > 0} onOpenChange={handleSheetActionClose} onAction={handleSheetAction} />
    </div> : <NoContent className="h-full" />);
}