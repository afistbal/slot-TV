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
import { MyListCabinetConfirmPopover } from '@/components/MyListCabinetConfirmPopover';
import { useConfigStore } from "@/stores/config";
import { skipRemoteApi } from '@/env';

type HistoryProps = {
    variant?: 'row' | 'cabinet';
};

export default function Component({ variant = 'row' }: HistoryProps) {
    const configStore = useConfigStore();
    const requesting = useRef(false);
    const gesture = useGesture({
        onDrag: (event) => {
            if (event.movement[0] !== 0 || event.movement[1] !== 0) {
                return;
            }
            if (event.active && event.timeStamp > 800) {
                const id = parseInt((event.currentTarget as HTMLElement).dataset['id'] ?? '0', 10);
                setSheetAction(id);
            }
        },
    }, {
        drag: {
            enabled: variant !== 'cabinet',
            delay: true,
            threshold: 5,
        },
    });
    const [list, setList] = useState<TData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [more, setMore] = useState(true);
    const [sheetAction, setSheetAction] = useState(0);
    const [cabinetRemoveTarget, setCabinetRemoveTarget] = useState<{
        id: number;
        anchor: HTMLElement;
    } | null>(null);

    function handleMoreChange(visible: boolean) {
        if (!visible) {
            return;
        }

        loadData(page + 1);
    }

    function handleToggleFavorite(id: number) {
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

        setList([...list.map(v => {
            if (v['movie_id'] === id) {
                v['is_favorite'] = v['is_favorite'] === 0 ? 1 : 0;
            }

            return v;
        })]);
    }

    function handleSheetActionClose() {
        setSheetAction(0);
    }

    function handleSheetAction(type: string) {
        switch (type) {
            case 'delete':
                if (!skipRemoteApi) {
                    api('movie/history/delete', {
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
            if (p === 1) {
                setList([]);
            }
            setMore(false);
            requesting.current = false;
            return;
        }
        const result = await api<IPagination>('movie/history', {
            loading: false,
            data: {
                page: p,
            }
        }).finally(() => {
            requesting.current = false;
        });
        const rows = result.d.data;
        setPage(p);
        setList((prev) => (p === 1 ? rows : [...prev, ...rows]));
        setMore(result.d.per_page === rows.length);
    }

    useEffect(() => {
        loadData().then(() => {
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (list.length === 0) {
        return <NoContent className="h-full" />;
    }

    const sheet = (
        <FlixActionSheet open={sheetAction > 0} onOpenChange={handleSheetActionClose} onAction={handleSheetAction} />
    );

    function handleCabinetRemoveConfirm(rowId: number) {
        if (!skipRemoteApi) {
            void api('movie/history/delete', {
                method: 'post',
                data: { id: rowId },
                loading: false,
            });
        }
        setList((prev) => prev.filter((x) => x.id !== rowId));
        setCabinetRemoveTarget(null);
    }

    if (variant === 'cabinet') {
        return (
            <>
                <section className="rs-dc-mylist">
                    {list.map((v) => {
                        const totalEp = Number(v['episodes'] ?? 0);
                        const curEp = Number(
                            v['current_episode'] ?? v['episode'] ?? v['ep'] ?? v['last_episode'] ?? 0,
                        );
                        const fromApi = Number(v['watch_progress'] ?? v['progress']);
                        const progressPct =
                            Number.isFinite(fromApi) && fromApi > 0
                                ? Math.min(100, Math.max(0, fromApi))
                                : curEp > 0 && totalEp > 0
                                  ? Math.min(100, (curEp / totalEp) * 100)
                                  : 0;
                        return (
                            <div
                                key={v['id'] as number}
                                className={cn('rs-bi-bookItem rs-dc-bookItem', 'rs-bi-bookItem--history')}
                                data-id={v['id']}
                            >
                                <div className="rs-bi-expoItem" aria-hidden data-report="expo" />
                                <div className="rs-bi-poster">
                                    <Link to={`/video/${v['movie_id']}`} className="rs-bi-cover">
                                        <Skeleton className="rs-bi-coverSkeleton rounded-[inherit] bg-white/10">
                                            <div className="rs-bi-coverSkeletonInner flex h-full w-full items-center justify-center p-1 text-center text-base font-bold">
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
                                    <div className="rs-bi-playMask">
                                        <div className="rs-bi-item-mask" />
                                        <div className="rs-bi-coverIconPlay" aria-hidden />
                                        <button
                                            type="button"
                                            className="rs-bi-iconRemove"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCabinetRemoveTarget({
                                                    id: v['id'] as number,
                                                    anchor: e.currentTarget,
                                                });
                                            }}
                                            aria-label="Remove from history"
                                        >
                                            <span className="rs-bi-imgIconRemove" />
                                        </button>
                                    </div>
                                    {progressPct > 0 ? (
                                        <div className="rs-bi-readProgressBar">
                                            <div
                                                className="rs-bi-readProgress"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                                <h3 className="rs-bi-title">
                                    <Link to={`/video/${v['movie_id']}`}>{v['title'] as string}</Link>
                                </h3>
                                <div className="rs-bi-chapter flex flex-wrap items-center gap-x-1">
                                    {curEp > 0 && totalEp > 0 ? (
                                        <>
                                            <span className="rs-bi-chapterProgress">EP.{curEp}</span>
                                            <span>/</span>
                                            <span>EP.{totalEp}</span>
                                        </>
                                    ) : (
                                        <span>Episodes {totalEp}</span>
                                    )}
                                    <button
                                        type="button"
                                        className="ms-auto shrink-0 rounded p-0.5 text-inherit [-webkit-tap-highlight-color:transparent]"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleFavorite(v['movie_id'] as number);
                                        }}
                                        aria-label="Favorite"
                                    >
                                        <IconStar
                                            className={cn(
                                                'h-4 w-4',
                                                v['is_favorite'] === 0
                                                    ? 'text-slate-500'
                                                    : 'fill-amber-500 text-amber-500',
                                            )}
                                            aria-hidden
                                        />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <InView as="div" onChange={handleMoreChange} className="rs-dc-loadMore">
                        {more ? (
                            <LoaderCircle className="rs-dc-loadMoreSpinner h-7 w-7 animate-[spin_1.5s_ease_infinite]" />
                        ) : (
                            <div>
                                <FormattedMessage id="no_more" />
                            </div>
                        )}
                    </InView>
                </section>
                <MyListCabinetConfirmPopover
                    open={cabinetRemoveTarget !== null}
                    anchorEl={cabinetRemoveTarget?.anchor ?? null}
                    onClose={() => setCabinetRemoveTarget(null)}
                    onConfirm={() => {
                        if (cabinetRemoveTarget) {
                            handleCabinetRemoveConfirm(cabinetRemoveTarget.id);
                        }
                    }}
                />
            </>
        );
    }

    return (
        <div className="rs-my-list__grid">
            {list.map((v) => (
                <div key={v['id'] as number} className="rs-my-list__row" data-id={v['id']} {...gesture()}>
                    <Link to={`/video/${v['movie_id']}`} className="rs-my-list__cover block">
                        <Skeleton className="rs-my-list__coverSkeleton rounded-[inherit] bg-white/10">
                            <div className="rs-my-list__coverSkeletonInner flex h-full w-full items-center justify-center p-1 text-center text-xl font-bold">
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
                                    className="line-clamp-2 min-w-0 flex-1 overflow-hidden text-ellipsis leading-[18px] text-white"
                                >
                                    {v['title'] as string}
                                </Link>
                                <button
                                    type="button"
                                    className="shrink-0 rounded-md p-0.5 text-inherit [-webkit-tap-highlight-color:transparent]"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleFavorite(v['movie_id'] as number);
                                    }}
                                >
                                    <IconStar
                                        className={cn(
                                            'h-6 w-6',
                                            v['is_favorite'] === 0 ? 'text-slate-400' : 'fill-amber-500 text-amber-500',
                                        )}
                                        aria-hidden
                                    />
                                </button>
                            </div>
                            <div className="rs-my-list__meta">Episodes {v['episodes'] as number}</div>
                        </div>
                    </div>
                </div>
            ))}
            <InView as="div" onChange={handleMoreChange} className="col-span-full flex h-12 items-center justify-center">
                {more ? (
                    <LoaderCircle className="h-8 w-8 animate-[spin_1.5s_ease_infinite] text-slate-500" />
                ) : (
                    <div className="text-slate-400">
                        <FormattedMessage id="no_more" />
                    </div>
                )}
            </InView>
            {sheet}
        </div>
    );
}

