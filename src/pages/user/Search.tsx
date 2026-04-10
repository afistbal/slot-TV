import { api, type IPagination, type TData } from '@/api';
import NoContent from '@/components/NoContent';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { useConfigStore } from '@/stores/config';
import Loader from '@/components/Loader';
import { useSearchStore } from '@/stores/search';
import { LoaderCircle, MoreHorizontal, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { InView } from 'react-intersection-observer';

/** 搜索分页合并时接口可能返回重复 id，去重避免 React key 冲突与重复卡片 */
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
        searchStore.setList(dedupeSearchRowsById([...state.list, ...result.d.data]));
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

    function handleClearKeyword() {
        searchStore.setKeyword('');
        searchStore.setPage(1);
        loadData();
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
        const s = useSearchStore.getState();
        if (!s.more) {
            return;
        }

        searchStore.setPage(s.page + 1);
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

    useLayoutEffect(() => {
        const q = new URLSearchParams(window.location.search).get('q');
        if (!q) {
            return;
        }
        const decoded = decodeURIComponent(q.replace(/\+/g, ' '));
        const s = useSearchStore.getState();
        s.setKeyword(decoded);
        s.setPage(1);
    }, []);

    useEffect(() => {
        api<TData[]>('movie/tags', {
            loading: false,
        }).then((res) => {
            searchStore.setTags(res.d);
            loadData();
        });
    }, []);

    const searchPlaceholder = intl.formatMessage({ id: 'search_placeholder' });

    return (
        <div className="rs-search-page">
            <div
                className="rs-search-page__scroll"
                ref={scrollRef}
                onScrollEnd={handleScrollEnd}
            >
                <ReelShortTopNav scrollParentRef={scrollRef} />

                <div className="rs-search-page__barPad">
                    <div role="search-bar" className="rs-search-page__bar">
                        <div className="rs-search-page__barInner">
                            <SearchIcon16 className="rs-search-page__barIcon" />
                            <input
                                value={searchStore.keyword}
                                autoFocus
                                onChange={handleKeywordChange}
                                type="search"
                                enterKeyHint="search"
                                maxLength={32}
                                autoComplete="off"
                                name="search"
                                className="rs-search-input rs-search-page__input"
                                placeholder={searchPlaceholder}
                            />
                            <div className="rs-search-page__clearWrap">
                                {searchStore.keyword.trim().length > 0 ? (
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
                    {searchStore.tags.length > 0 && (
                        <div className="rs-search-page__tagRow">
                            {searchStore.tags.slice(0, 10).map((v) => (
                                <div
                                    onClick={() => handleTagClick(v['name'] as string)}
                                    key={v['name'] as string}
                                    className={cn(
                                        'rs-search-page__tag',
                                        (v['name'] as string) === searchStore.tag && 'rs-search-page__tag--active',
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
                                        className="rs-search-page__tag rs-search-page__tag--active"
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
                                className="rs-search-page__tagMore"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleTagOpen();
                                    }
                                }}
                            >
                                <MoreHorizontal size={20} />
                            </div>
                        </div>
                    )}
                    <div className="rs-search-page__main">
                        {searchStore.loading ? (
                            <Loader />
                        ) : !searchStore.loading && searchStore.list.length === 0 ? (
                            <NoContent />
                        ) : (
                            <div className="rs-search-page__grid">
                                {searchStore.loading ? (
                                    <div />
                                ) : (
                                    searchStore.list.map((v) => (
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
                                    ))
                                )}
                            </div>
                        )}
                        {!searchStore.loading && (
                            <InView
                                as="div"
                                onChange={handleMoreChange}
                                className="rs-search-page__inview"
                            >
                                {searchStore.more ? (
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
            <Drawer open={tagOpen} onOpenChange={handleTagOpen}>
                <DrawerContent aria-describedby="Tags" className="rs-search-page__drawerContent">
                    <DrawerTitle className="rs-search-page__drawerTitle">
                        <div className="rs-search-page__drawerTitleText">
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
                            className="rs-search-page__drawerInput"
                            placeholder={intl.formatMessage({ id: 'keyword' })}
                        />
                        <div className="rs-search-page__drawerClose" onClick={handleTagOpen}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="rs-search-page__drawerDivider" />
                    <div className="rs-search-page__drawerBody">
                        <div className="rs-search-page__drawerTags">
                            {searchStore.tags
                                .filter(
                                    (v) => (v['unique_id'] as string).indexOf(tagKeyword) !== -1,
                                )
                                .map((v) => (
                                    <div
                                        onClick={() => handleTagClick(v['name'] as string)}
                                        key={v['name'] as string}
                                        className={cn(
                                            'rs-search-page__drawerTag',
                                            (v['name'] as string) === searchStore.tag &&
                                                'rs-search-page__drawerTag--active',
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
                    <div className="rs-search-page__drawerSpacer" />
                </DrawerContent>
            </Drawer>
        </div>
    );
}
