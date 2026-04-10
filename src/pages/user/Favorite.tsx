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
            setMore(false);
            requesting.current = false;
            return;
        }
        const result = await api<IPagination>('movie/my-list', {
            loading: false,
            data: {
                page: p,
            },
        }).finally(() => {
            requesting.current = false;
        });
        const rows = result.d.data;
        setPage(p);
        setList([...list, ...rows]);
        setMore(result.d.per_page === rows.length);
    }

    useEffect(() => {
        loadData().then(() => {
            setLoading(false);
        });
    }, []);

    return loading ? <div className="w-full h-full flex justify-center items-center">
        <Loader />
    </div> : (list.length > 0 ? <div className="rs-my-list__grid">
        {list.map(v => <div key={v['id'] as number} className="rs-my-list__row" data-id={v['id']} {...gesture()}>
            <Link to={`/video/${v['movie_id']}`} className="rs-my-list__cover block">
                <Skeleton className="rs-my-list__coverSkeleton rounded-[inherit] bg-white/10">
                    <div className="rs-my-list__coverSkeletonInner flex h-full w-full items-center justify-center p-1 text-center font-bold text-xl">
                        <FormattedMessage id="site_name" />
                    </div>
                </Skeleton>
                <LazyLoadImage
                    alt=""
                    src={`${configStore.config['static']}/${v['image'] as number}`}
                    onLoad={(e) => {
                        e.currentTarget.style.opacity = '1';
                    }}
                    className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
                />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-w-0 flex-1 p-1">
                    <div className="flex items-start gap-2">
                        <Link
                            to={`/video/${v['movie_id']}`}
                            className="min-w-0 flex-1 line-clamp-2 overflow-hidden text-ellipsis leading-[18px] text-white"
                        >
                            {v['title'] as string}
                        </Link>
                        <button
                            type="button"
                            className="shrink-0 rounded-md p-0.5 text-inherit [-webkit-tap-highlight-color:transparent]"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCancelFavorite(v['movie_id'] as number);
                            }}
                        >
                            <IconStar className={cn('h-6 w-6 text-amber-500 fill-amber-500')} aria-hidden />
                        </button>
                    </div>
                    <div className="rs-my-list__meta">Episodes {v['episodes'] as number}</div>
                </div>
            </div>
        </div>)}
        <InView as="div" onChange={handleMoreChange} className="h-12 flex justify-center items-center col-span-full">
            {more ? <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" /> : <div className='text-slate-400'><FormattedMessage id="no_more" /></div>}
        </InView>
        <FlixActionSheet open={sheetAction > 0} onOpenChange={handleSheetActionClose} onAction={handleSheetAction} />
    </div> : <NoContent className="h-full" />);
}