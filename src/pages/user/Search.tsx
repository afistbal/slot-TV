import { api, type IPagination, type TData } from '@/api';
import NoContent from '@/components/NoContent';
import { Page } from '@/layouts/user';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { useConfigStore } from '@/stores/config';
import Loader from '@/components/Loader';
import { useSearchStore } from '@/stores/search';
import { LoaderCircle, MoreHorizontal, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { InView } from 'react-intersection-observer';

export default function Component() {
    const intl = useIntl();
    const configStore = useConfigStore();
    const timer = useRef(0);
    const requesting = useRef(false);
    const searchStore = useSearchStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [tagOpen, setTagOpen] = useState(false);
    const [tagKeyword, setTagKeyword] = useState('');

    async function loadData() {
        if (requesting.current) {
            return;
        }
        requesting.current = true;
        const state = useSearchStore.getState();
        const result = await api<IPagination>('movie', {
            loading: false,
            data: {
                page: state.page,
                keyword: state.keyword.trim(),
                tag: state.tag,
            },
        }).finally(() => {
            requesting.current = false;
        });
        searchStore.setList([...state.list, ...result.d.data]);
        searchStore.setLoading(false);
        searchStore.setMore(result.d.per_page === result.d.data.length);
    }

    function handleKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.currentTarget.value;
        searchStore.setKeyword(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            searchStore.setPage(1);
            loadData();
        }, 500);
    }

    function handleScrollEnd(e: React.UIEvent<HTMLDivElement>) {
        searchStore.setScrollTop(e.currentTarget.scrollTop);
    }

    function handleTagOpen() {
        setTagOpen(!tagOpen);
    }

    function handleTagKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTagKeyword(e.currentTarget.value);
    }

    function handleTagClick(name: string) {
        if (searchStore.tag === name) {
            searchStore.setTag('');
        } else {
            searchStore.setTag(name);
        }

        setTagOpen(false);
        searchStore.setPage(1);
        loadData();
    }

    function handleMoreChange(visible: boolean) {
        if (requesting.current) {
            return;
        }
        if (!visible) {
            return;
        }

        searchStore.setPage(searchStore.page + 1);
        loadData();
    }

    useEffect(() => {
        if (searchStore.list.length > 0) {
            if (!scrollRef.current) {
                return;
            }
            scrollRef.current.scrollTop = searchStore.scrollTop;
        }
    }, []);

    useEffect(() => {
        api<TData[]>('movie/tags', {
            loading: false,
        }).then((res) => {
            searchStore.setTags(res.d);
            loadData();
        });
    }, []);

    return (
        <Page
            title="search"
            action={
                <label className="h-8 w-40 mx-4 flex items-center border border-slate-300 rounded bg-slate-50 focus-within:bg-slate-100">
                    <input
                        value={searchStore.keyword}
                        autoFocus
                        onChange={handleKeywordChange}
                        type="text"
                        enterKeyHint="done"
                        maxLength={32}
                        autoComplete="off"
                        name="search"
                        className="px-2 w-full h-full outline-none py-0 text-center text-sm"
                        placeholder={`🔍 ${intl.formatMessage({ id: 'keyword' })}`}
                    />
                </label>
            }
        >
            <div className="flex flex-col h-full">
                {searchStore.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap p-4 border-b justify-center">
                        {searchStore.tags.slice(0, 10).map((v) => (
                            <div
                                onClick={() => handleTagClick(v['name'] as string)}
                                key={v['name'] as string}
                                className={cn(
                                    'bg-slate-200 cursor-pointer hover:bg-slate-300 hover:border-slate-400 border border-transparent text-gray-500 px-2 py-1 text-sm rounded',
                                    (v['name'] as string) === searchStore.tag &&
                                        '!border-indigo-300 !bg-indigo-200 !text-indigo-400',
                                )}
                            >
                                {(v['unique_id'] as string)
                                    .split('')
                                    .map((v, k) => {
                                        if (k === 0) {
                                            return v.toUpperCase();
                                        }
                                        if (v === '_') {
                                            return ' ';
                                        }
                                        return v;
                                    })
                                    .join('')}
                            </div>
                        ))}
                        {searchStore.tag &&
                            searchStore.tags
                                .slice(0, 10)
                                .filter((v) => v['name'] === searchStore.tag).length === 0 && (
                                <div
                                    onClick={() => handleTagClick(searchStore.tag)}
                                    key={searchStore.tag}
                                    className={cn(
                                        '!border-indigo-300 !bg-indigo-200 !text-indigo-400 cursor-pointer border px-2 py-1 text-sm rounded',
                                    )}
                                >
                                    {(
                                        searchStore.tags.find(
                                            (v) => (v['name'] as string) === searchStore.tag,
                                        )!['unique_id'] as string
                                    )
                                        .split('')
                                        .map((v, k) => {
                                            if (k === 0) {
                                                return v.toUpperCase();
                                            }
                                            if (v === '_') {
                                                return ' ';
                                            }
                                            return v;
                                        })
                                        .join('')}
                                </div>
                            )}
                        <div
                            onClick={handleTagOpen}
                            className="flex justify-center items-center bg-red-100 cursor-pointer hover:bg-red-200 hover:border-red-400 border border-transparent text-red-500 px-2 py-1 text-sm rounded"
                        >
                            <MoreHorizontal size={20} />
                        </div>
                    </div>
                )}
                <div
                    className="flex flex-col flex-1 overflow-y-auto"
                    ref={scrollRef}
                    onScrollEnd={handleScrollEnd}
                >
                    {searchStore.loading ? (
                        <Loader />
                    ) : !searchStore.loading && searchStore.list.length === 0 ? (
                        <NoContent />
                    ) : (
                        <div className={cn('grid grid-cols-3 gap-4 p-4 auto-rows-max')}>
                            {searchStore.loading ? (
                                <div />
                            ) : (
                                searchStore.list.map((v) => (
                                    <Link to={`/video/${v['id']}`} key={v['id'] as string}>
                                        <Image
                                            height={1.3325}
                                            width={`${
                                                (window.document.body.clientWidth - 64) / 3
                                            }px`}
                                            alt={v['title'] as string}
                                            src={`${configStore.config['static']}/${v['image']}`}
                                        />
                                        <div className="p-1">
                                            <div className="text-sm text-ellipsis overflow-hidden line-clamp-2 leading-[18px]">{`${v['title']}`}</div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    )}
                    {!searchStore.loading && (
                        <InView
                            as="div"
                            onChange={handleMoreChange}
                            className="h-12 flex justify-center items-center col-span-full shrink-0"
                        >
                            {searchStore.more ? (
                                <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" />
                            ) : (
                                <div className="text-slate-400">
                                    <FormattedMessage id="no_more" />
                                </div>
                            )}
                        </InView>
                    )}
                </div>
            </div>
            <Drawer open={tagOpen} onOpenChange={handleTagOpen}>
                <DrawerContent aria-describedby="Tags" className="">
                    <DrawerTitle className="flex items-center gap-4 px-4 pt-4">
                        <div className="shrink-0 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            <FormattedMessage id="tag" />
                        </div>
                        <input
                            value={tagKeyword}
                            onChange={handleTagKeywordChange}
                            type="text"
                            enterKeyHint="done"
                            maxLength={32}
                            autoComplete="off"
                            name="tagSearch"
                            className="flex-1 px-2 w-full outline-none py-0 text-center text-sm font-normal"
                            placeholder={`🔍 ${intl.formatMessage({ id: 'keyword' })}`}
                        />
                        <div className="shrink-0" onClick={handleTagOpen}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="border-t border-slate-200 mt-4" />
                    <div className="h-96 overflow-y-auto">
                        <div className="flex gap-2 flex-wrap p-4">
                            {searchStore.tags
                                .filter(
                                    (v) => (v['unique_id'] as string).indexOf(tagKeyword) !== -1,
                                )
                                .map((v) => (
                                    <div
                                        onClick={() => handleTagClick(v['name'] as string)}
                                        key={v['name'] as string}
                                        className={cn(
                                            'bg-slate-100 cursor-pointer hover:bg-slate-300 hover:border-slate-400 border border-transparent text-gray-500 px-2 py-1 rounded',
                                            (v['name'] as string) === searchStore.tag &&
                                                '!border-indigo-300 !bg-indigo-200 !text-indigo-400',
                                        )}
                                    >
                                        {(v['unique_id'] as string)
                                            .split('')
                                            .map((v, k) => {
                                                if (k === 0) {
                                                    return v.toUpperCase();
                                                }
                                                if (v === '_') {
                                                    return ' ';
                                                }
                                                return v;
                                            })
                                            .join('')}
                                    </div>
                                ))}
                        </div>
                    </div>
                    <div className="h-4" />
                </DrawerContent>
            </Drawer>
        </Page>
    );
}
