import { api, type IPagination } from '@/api';
import NoContent from '@/components/NoContent';
import Image from '@/components/Image';
import { Page } from '@/layouts/admin';
import { cn } from '@/lib/utils';
import { useMovieListStore } from '@/stores/admin';
import { LoaderCircle, ThumbsUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { InView } from 'react-intersection-observer';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useConfigStore } from '@/stores/config';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useConfirmStore } from '@/stores/confirm';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
    { code: 'all', label: '全部' },
    { code: 'en', label: '英语' }, // 英语
    { code: 'zh', label: '繁体中文' }, // 繁体中文
    { code: 'ja', label: '日语' }, // 日语
    { code: 'ko', label: '韩语' }, // 韩语
    { code: 'pt', label: '葡萄牙语' }, // 葡萄牙语
    { code: 'vi', label: '越南语' }, // 越南语
    { code: 'th', label: '泰语' }, // 泰语
    { code: 'tr', label: '土耳其语' }, // 土耳其语
    { code: 'id', label: '印度尼西亚语' }, // 印度尼西亚语
    { code: 'de', label: '德语' }, // 德语
    { code: 'ms', label: '马来语' }, // 马来语
    { code: 'ar', label: '阿拉伯语' }, // 阿拉伯语
];

export default function Component() {
    const configStore = useConfigStore();
    const movieListStore = useMovieListStore();
    const confirmStore = useConfirmStore();
    const intl = useIntl();
    const scrollRef = useRef<HTMLDivElement>(null);
    const requesting = useRef(false);
    const searching = useRef(false);
    const timer = useRef(0);
    const longPressTimer = useRef(0);
    const longPressTriggered = useRef(false);
    const touchStartPosition = useRef({ x: 0, y: 0 });
    const [actionOpen, setActionOpen] = useState(-1);

    function handleActionSheet(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        const index = parseInt((e.currentTarget as HTMLElement).dataset['index'] ?? '-1', 10);
        setActionOpen(index);
    }

    function openActionSheetByElement(element: HTMLElement) {
        const index = parseInt(element.dataset['index'] ?? '-1', 10);
        if (!Number.isNaN(index) && index > -1) {
            setActionOpen(index);
        }
    }

    function clearLongPressTimer() {
        window.clearTimeout(longPressTimer.current);
    }

    function handleCardTouchStart(e: React.TouchEvent<HTMLAnchorElement>) {
        const touch = e.touches[0];
        if (!touch) {
            return;
        }
        longPressTriggered.current = false;
        touchStartPosition.current = { x: touch.clientX, y: touch.clientY };
        clearLongPressTimer();
        longPressTimer.current = window.setTimeout(() => {
            longPressTriggered.current = true;
            openActionSheetByElement(e.currentTarget);
        }, 450);
    }

    function handleCardTouchMove(e: React.TouchEvent<HTMLAnchorElement>) {
        const touch = e.touches[0];
        if (!touch) {
            return;
        }
        const deltaX = Math.abs(touch.clientX - touchStartPosition.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPosition.current.y);
        if (deltaX > 8 || deltaY > 8) {
            clearLongPressTimer();
        }
    }

    function handleCardTouchEnd() {
        clearLongPressTimer();
    }

    function handleCardClick(e: React.MouseEvent<HTMLAnchorElement>) {
        if (longPressTriggered.current) {
            e.preventDefault();
            e.stopPropagation();
            longPressTriggered.current = false;
        }
    }

    function handleMoreChange(visible: boolean) {
        if (searching.current) {
            return;
        }
        if (!visible) {
            return;
        }

        loadData(movieListStore.page + 1);
    }

    function handleScrollEnd(e: React.UIEvent<HTMLDivElement>) {
        movieListStore.setScrollTop(e.currentTarget.scrollTop);
    }

    function handleKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        searching.current = true;
        movieListStore.setKeyword(e.currentTarget.value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            loadData();
        }, 500);
    }

    function handleActionOpenChange(index: number) {
        setActionOpen(index);
    }

    function handleAction(type: string) {
        switch (type) {
            case 'delete':
                confirmStore.show(async function () {
                    await api('admin/movie/status', {
                        method: 'post',
                        data: {
                            id: movieListStore.list[actionOpen]['id'],
                            status: 3,
                        },
                    });
                    setActionOpen(-1);
                });
                break;
            case 'recommend':
                movieListStore.list[actionOpen]['sort'] =
                    movieListStore.list[actionOpen]['sort'] === 0 ? 100 : 0;
                api('admin/movie/sort', {
                    method: 'post',
                    data: {
                        id: movieListStore.list[actionOpen]['id'],
                        sort: movieListStore.list[actionOpen]['sort'],
                    },
                }).then(() => {
                    movieListStore.setList([...movieListStore.list]);
                    setActionOpen(-1);
                });
                break;
            case 'zh-Hans':
            case 'en':
                movieListStore.list[actionOpen]['audio_track'] = type;
                api('admin/movie/set-audio-track', {
                    method: 'post',
                    data: {
                        id: movieListStore.list[actionOpen]['id'],
                        audio: type,
                    },
                }).then(() => {
                    movieListStore.setList([...movieListStore.list]);
                    setActionOpen(-1);
                });
                break;
            case 'full_image':
                window.open(`${configStore.config['static']}/${movieListStore.list[actionOpen]['image'] as string}`, '_blank');
                break;
        }
    }

    function handleSetlanguage(language: string) {
        movieListStore.setLanguage(language);
        loadData();
    }

    async function loadData(p = 1) {
        const state = useMovieListStore.getState();
        if (p <= state.page || !state.more || requesting.current) {
            return;
        }
        requesting.current = true;
        const result = await api<IPagination>('admin/movie/list', {
            loading: false,
            data: {
                page: p,
                keyword: state.keyword,
                language: state.language,
            },
        }).finally(() => {
            requesting.current = false;
            searching.current = false;
        });
        state.setLoading(false);
        state.setPage(p);
        state.setList([...state.list, ...result.d.data]);
        state.setTotal(result.d.count ?? 0);
        state.setMore(result.d.per_page === result.d.data.length);
    }

    useEffect(() => {
        if (movieListStore.list.length > 0) {
            if (!scrollRef.current) {
                return;
            }
            scrollRef.current.scrollTop = movieListStore.scrollTop;
        }
    }, []);

    return (
        <Page title="flix_list" titleClassName="bg-black border-slate-800 text-slate-100">
            <div
                className="flex flex-col h-full overflow-auto bg-black"
                ref={scrollRef}
                onScrollEnd={handleScrollEnd}
            >
                <div className="flex items-center justify-between px-4 pt-4 shrink-0 gap-4">
                    <div className="shrink-0 text-slate-400">
                        <FormattedMessage
                            id="flix_total"
                            values={{ total: movieListStore.total || '...' }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger className="border border-slate-700 rounded-md bg-slate-900 px-4 text-slate-300 text-sm py-2 min-h-10">
                                {LANGUAGES.find((v) => v.code === movieListStore.language)?.label}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {LANGUAGES.map((v) => (
                                    <DropdownMenuItem
                                        key={v.code}
                                        onClick={() => handleSetlanguage(v.code)}
                                    >
                                        <div
                                            className={cn(
                                                movieListStore.language === v.code &&
                                                    'text-red-400',
                                            )}
                                        >
                                            {v.label}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <label className="h-10 w-30 flex items-center border border-slate-700 rounded bg-slate-900 focus-within:bg-slate-800">
                            <input
                                value={movieListStore.keyword}
                                onChange={handleKeywordChange}
                                type="text"
                                enterKeyHint="done"
                                maxLength={32}
                                autoComplete="off"
                                name="search"
                                className="px-4 w-full h-full outline-none py-0 text-center text-sm bg-transparent text-slate-100 placeholder:text-slate-500"
                                placeholder={intl.formatMessage({ id: 'flix_search' })}
                            />
                        </label>
                    </div>
                </div>
                {!movieListStore.loading && movieListStore.list.length === 0 ? (
                    <NoContent />
                ) : (
                    <div
                        className={cn(
                            'grid grid-cols-3 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-9 gap-3 p-4',
                            movieListStore.loading || movieListStore.list.length === 0
                                ? 'overflow-hidden'
                                : '',
                        )}
                    >
                        {movieListStore.loading ? (
                            <div />
                        ) : (
                            movieListStore.list.map((v, k) => (
                                <Link
                                    className="relative overflow-hidden rounded-t-md bg-slate-900 border border-slate-800"
                                    to={`/z/page/movie/detail/${v['id']}`}
                                    key={v['id'] as string}
                                    data-index={k}
                                    onContextMenu={handleActionSheet}
                                    onTouchStart={handleCardTouchStart}
                                    onTouchMove={handleCardTouchMove}
                                    onTouchEnd={handleCardTouchEnd}
                                    onTouchCancel={handleCardTouchEnd}
                                    onClick={handleCardClick}
                                >
                                    <Image
                                        height={1.3325}
                                        alt={v['title'] as string}
                                        src={`${configStore.config['static']}/${v['image']}`}
                                    />
                                    <div className="p-1.5">
                                        <div className="text-sm text-slate-200 text-ellipsis overflow-hidden line-clamp-2 leading-[18px]">{`${v['title']}`}</div>
                                    </div>
                                    {v['sort'] === 100 && (
                                        <>
                                            <div className="absolute -top-7 -right-7 bg-red-400/80 rounded-full w-14 h-14 rotate-45" />
                                            <ThumbsUp className="w-4 h-4 text-white absolute top-0.5 right-0.5" />
                                        </>
                                    )}
                                    {v['audio_track'] === 'en' && (
                                        <div className="absolute top-0 bg-green-400/50 py-1 px-2 rounded-br-md text-white text-shadow-2xs text-sm leading-3.5">
                                            EN
                                        </div>
                                    )}
                                </Link>
                            ))
                        )}
                        <InView
                            as="div"
                            onChange={handleMoreChange}
                            className="h-12 flex justify-center items-center col-span-full"
                        >
                            {movieListStore.more ? (
                                <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" />
                            ) : (
                                <div className="text-slate-500">
                                    <FormattedMessage id="no_more" />
                                </div>
                            )}
                        </InView>
                    </div>
                )}
            </div>
            <Drawer open={actionOpen > -1} onOpenChange={() => handleActionOpenChange(-1)}>
                <DrawerContent className="bg-linear-to-b from-slate-900 to-black border border-slate-700 text-slate-100" aria-describedby="manage">
                    <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                        <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            <FormattedMessage id="flix_manage" />
                        </div>
                        <div onClick={() => handleActionOpenChange(-1)}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="flex flex-col p-4 pb-12 gap-4">
                        <div className="flex gap-2">
                            <Button
                                className="bg-orange-400 flex-1"
                                onClick={() => handleAction('zh-Hans')}
                            >
                                <FormattedMessage id="set_to_chinese" />
                            </Button>
                            <Button
                                className="bg-orange-400 flex-1"
                                onClick={() => handleAction('en')}
                            >
                                <FormattedMessage id="set_to_english" />
                            </Button>
                        </div>
                        <Button
                            className="bg-orange-400"
                            onClick={() => handleAction('full_image')}
                        >
                            <FormattedMessage id="view_full_image" />
                        </Button>
                        <Button className="bg-purple-400" onClick={() => handleAction('recommend')}>
                            <FormattedMessage id="recommend" />
                        </Button>
                        <Button onClick={() => handleAction('delete')}>
                            <FormattedMessage id="delete" />
                        </Button>
                        <Button className="bg-[#94a3b8]" onClick={() => handleActionOpenChange(-1)}>
                            <FormattedMessage id="cancel" />
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
        </Page>
    );
}
