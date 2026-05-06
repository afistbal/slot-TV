import { api, type IPagination, type TData } from '@/api';
import NoContent from '@/components/NoContent';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { useConfigStore } from '@/stores/config';
import Loader from '@/components/Loader';
import { LoaderCircle, ChevronUp, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { InView } from 'react-intersection-observer';

function dedupeSearchRowsById(rows: TData[]): TData[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
        const k = String(row['id']);
        if (seen.has(k)) {
            return false;
        }
        seen.add(k);
        return true;
    });
}

function formatTagLabel(uniqueId: string): string {
    return uniqueId
        .split('')
        .map((ch, k) => {
            if (k === 0) {
                return ch.toUpperCase();
            }
            if (ch === '_') {
                return ' ';
            }
            return ch;
        })
        .join('');
}

function SearchIcon16({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M6.5 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 6.5a5.5 5.5 0 1 1 9.727 3.52l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 0 1 1 6.5"
                clipRule="evenodd"
            />
        </svg>
    );
}

/** H5 類別頁：交互對齊 tv-web Search（movie + tag + keyword、分頁）；樣式為深色原型（下拉 + 抽屜三列標籤）。 */
export default function UserCategories() {
    const intl = useIntl();
    const configStore = useConfigStore();
    const timer = useRef(0);
    const requesting = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const pageRef = useRef(1);
    const keywordRef = useRef('');
    const tagRef = useRef('');

    const [tags, setTags] = useState<TData[]>([]);
    const [tag, setTag] = useState('');
    const [keyword, setKeyword] = useState('');
    const [list, setList] = useState<TData[]>([]);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(true);

    const [tagDrawerOpen, setTagDrawerOpen] = useState(false);
    const [tagKeyword, setTagKeyword] = useState('');

    useEffect(() => {
        keywordRef.current = keyword;
    }, [keyword]);

    useEffect(() => {
        tagRef.current = tag;
    }, [tag]);

    const loadData = useCallback(async () => {
        if (requesting.current) {
            return;
        }
        requesting.current = true;
        const requestedPage = pageRef.current;
        const result = await api<IPagination>('movie', {
            loading: false,
            data: {
                page: requestedPage,
                keyword: keywordRef.current.trim(),
                tag: tagRef.current,
            },
        }).finally(() => {
            requesting.current = false;
        });

        setList((prev) =>
            requestedPage === 1
                ? dedupeSearchRowsById(result.d.data)
                : dedupeSearchRowsById([...prev, ...result.d.data]),
        );
        setLoading(false);
        setMore(result.d.per_page === result.d.data.length);
    }, []);

    useEffect(() => {
        api<TData[]>('movie/tags', { loading: false }).then((res) => {
            setTags(res.d ?? []);
            pageRef.current = 1;
            tagRef.current = '';
            setTag('');
            keywordRef.current = '';
            setKeyword('');
            setLoading(true);
            void loadData();
        });
    }, [loadData]);

    function handleKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.currentTarget.value;
        setKeyword(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            pageRef.current = 1;
            setList([]);
            setLoading(true);
            void loadData();
        }, 500);
    }

    function handleClearKeyword() {
        setKeyword('');
        keywordRef.current = '';
        pageRef.current = 1;
        setList([]);
        setLoading(true);
        void loadData();
    }

    function handleTagClick(name: string) {
        const next = tag === name ? '' : name;
        tagRef.current = next;
        setTag(next);
        pageRef.current = 1;
        setList([]);
        setLoading(true);
        setTagDrawerOpen(false);
        void loadData();
    }

    function handleTagDrawerOpen(open: boolean) {
        setTagDrawerOpen(open);
        if (!open) {
            setTagKeyword('');
        }
    }

    function handleMoreChange(visible: boolean) {
        if (requesting.current || !visible || !more) {
            return;
        }
        const next = pageRef.current + 1;
        pageRef.current = next;
        void loadData();
    }

    function triggerLabel(): string {
        if (tag === '') {
            return intl.formatMessage({ id: 'categories_all' });
        }
        const row = tags.find((v) => (v['name'] as string) === tag);
        if (row) {
            return formatTagLabel(String(row['unique_id'] ?? ''));
        }
        return tag;
    }

    const searchPlaceholder = intl.formatMessage({ id: 'search_placeholder' });

    return (
        <div className="rs-search-page categories-page">
            <div ref={scrollRef} className="rs-search-page__scroll">
                <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />

                <button
                    type="button"
                    className="flex w-full items-center justify-between border-b border-white/10 bg-[#1a1a1a] px-4 py-3 text-left text-white"
                    onClick={() => handleTagDrawerOpen(true)}
                    aria-expanded={tagDrawerOpen}
                >
                    <span className="text-base font-medium">{triggerLabel()}</span>
                    <ChevronUp
                        className={cn(
                            'h-5 w-5 shrink-0 opacity-70 transition-transform',
                            !tagDrawerOpen && 'rotate-180',
                        )}
                        aria-hidden
                    />
                </button>

                <div className="rs-search-page__barPad">
                    <div role="search-bar" className="rs-search-page__bar">
                        <div className="rs-search-page__barInner">
                            <SearchIcon16 className="rs-search-page__barIcon" />
                            <input
                                value={keyword}
                                onChange={handleKeywordChange}
                                type="search"
                                enterKeyHint="search"
                                maxLength={32}
                                autoComplete="off"
                                name="categories_movie_keyword"
                                className="rs-search-input rs-search-page__input"
                                placeholder={searchPlaceholder}
                            />
                            <div className="rs-search-page__clearWrap">
                                {keyword.trim().length > 0 ? (
                                    <span
                                        role="img"
                                        aria-label="close-circle"
                                        tabIndex={-1}
                                        className="rs-search-page__clear rs-search-clear anticon anticon-close-circle"
                                        onClick={handleClearKeyword}
                                    >
                                        <svg
                                            fillRule="evenodd"
                                            viewBox="64 64 896 896"
                                            focusable="false"
                                            data-icon="close-circle"
                                            width="1em"
                                            height="1em"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z" />
                                        </svg>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rs-search-page__body">
                    <div className="rs-search-page__main">
                        {loading ? (
                            <Loader />
                        ) : !loading && list.length === 0 ? (
                            <NoContent />
                        ) : (
                            <div className="rs-search-page__grid">
                                {list.map((v) => (
                                    <Link
                                        to={`/video/${v['id']}`}
                                        key={String(v['id'])}
                                        className="rs-search-page__card"
                                    >
                                        <Image
                                            height={1.3325}
                                            width="100%"
                                            alt={v['title'] as string}
                                            src={`${configStore.config['static']}/${v['image']}`}
                                            className="rs-search-page__poster"
                                        />
                                        <div className="rs-search-page__title">{`${v['title']}`}</div>
                                    </Link>
                                ))}
                            </div>
                        )}
                        {!loading && (
                            <InView
                                as="div"
                                onChange={handleMoreChange}
                                className="rs-search-page__inview"
                            >
                                {more ? (
                                    <LoaderCircle className="rs-search-page__spinner" />
                                ) : (
                                    <div className="rs-search-page__noMore">
                                        <FormattedMessage id="no_more" />
                                    </div>
                                )}
                            </InView>
                        )}
                    </div>
                </div>
            </div>

            <Drawer open={tagDrawerOpen} onOpenChange={handleTagDrawerOpen}>
                <DrawerContent
                    aria-labelledby="categories-drawer-title"
                    aria-describedby="categories-tags-drawer-desc"
                    className="border-white/10 bg-[#1a1a1a] text-white max-h-[80vh] rounded-t-xl"
                >
                    <DrawerTitle
                        id="categories-drawer-title"
                        className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 text-base font-bold text-white"
                    >
                        <span className="min-w-0 truncate">
                            <FormattedMessage id="nav_categories" />
                        </span>
                        <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
                            onClick={() => handleTagDrawerOpen(false)}
                            aria-label={intl.formatMessage({ id: 'close' })}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </DrawerTitle>
                    <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2.5">
                            <SearchIcon16 className="h-4 w-4 shrink-0 text-white/50" />
                            <input
                                value={tagKeyword}
                                onChange={(e) => setTagKeyword(e.target.value)}
                                type="text"
                                enterKeyHint="done"
                                maxLength={32}
                                autoComplete="off"
                                name="tagSearch"
                                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                                placeholder={intl.formatMessage({ id: 'categories_search_category' })}
                            />
                        </div>
                    </div>
                    <p id="categories-tags-drawer-desc" className="sr-only">
                        <FormattedMessage id="nav_categories" />
                    </p>
                    <div className="border-t border-white/10" />
                    <div className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain">
                        <div className="grid grid-cols-3 gap-2 p-4">
                            <button
                                type="button"
                                className={cn(
                                    'rounded-lg px-2 py-2.5 text-center text-sm transition-colors',
                                    tag === ''
                                        ? 'bg-red-950/80 text-red-300 ring-1 ring-red-500/35'
                                        : 'bg-white/10 text-white/90 hover:bg-white/15',
                                )}
                                onClick={() => handleTagClick('')}
                            >
                                <FormattedMessage id="categories_all" />
                            </button>
                            {tags
                                .filter(
                                    (v) =>
                                        (String(v['unique_id'] ?? '').indexOf(tagKeyword) !== -1),
                                )
                                .map((v) => {
                                    const name = String(v['name'] ?? '');
                                    const label = formatTagLabel(String(v['unique_id'] ?? ''));
                                    const active = name === tag;
                                    return (
                                        <button
                                            type="button"
                                            key={name}
                                            className={cn(
                                                'rounded-lg px-2 py-2.5 text-center text-sm transition-colors',
                                                active
                                                    ? 'bg-red-950/80 text-red-300 ring-1 ring-red-500/35'
                                                    : 'bg-white/10 text-white/90 hover:bg-white/15',
                                            )}
                                            onClick={() => handleTagClick(name)}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                    <div className="h-4 shrink-0" />
                </DrawerContent>
            </Drawer>
        </div>
    );
}
