import { api, type IPagination, type TData } from '@/api';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import NoContent from '@/components/NoContent';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import Image from '@/components/Image';
import { useConfigStore } from '@/stores/config';
import Loader from '@/components/Loader';
import { useSearchStore } from '@/stores/search';
import { useRootStore } from '@/stores/root';
import { Button } from '@/components/ui/button';
import { ScrollTopArrowUp } from '@/components/icons/ScrollTopArrowUp';
import { scrollElementToTop } from '@/lib/scrollToTop';
import { ChevronLeft, ChevronRight, LoaderCircle, MoreHorizontal, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { InView } from 'react-intersection-observer';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';

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

/** 会话内 tags 只拉一次；并发挂载共用同一 Promise，减轻 Strict Mode / 快速重挂载下的双请求 */
let movieTagsInflight: Promise<void> | null = null;

async function ensureMovieTags(): Promise<void> {
    const s = useSearchStore.getState();
    if (s.tags.length > 0) return;
    if (!movieTagsInflight) {
        movieTagsInflight = api<TData[]>('movie/tags', { loading: false })
            .then((res) => {
                useSearchStore.getState().setTags(res.d);
            })
            .finally(() => {
                movieTagsInflight = null;
            });
    }
    await movieTagsInflight;
}

/** 最新一次 `movie` 请求生效；较早返回的结果丢弃（导航/Strict Mode 叠请求） */
let searchMovieLoadId = 0;

/** 首屏 URL ?q= 与 store 关键字是否一致（无 q 则表示不应强行要求关键字） */
function keywordMatchesSearchUrl(): boolean {
    const urlQ = new URLSearchParams(window.location.search).get('q');
    const decoded = urlQ ? decodeURIComponent(urlQ.replace(/\+/g, ' ')).trim() : '';
    const kw = useSearchStore.getState().keyword.trim();
    return urlQ ? kw === decoded : kw === '';
}

/** 與離屏測量 `measurePcTagsTwoRowSplit` 內 DOM 一致 */
const PC_TAG_TOGGLE_INNER_HTML =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 18" class="rs-search-page__pcTagsToggleSvg" aria-hidden="true">' +
    '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 6L9 13L2 6"/>' +
    '</svg>';

/**
 * 測量：僅標籤是否超過兩行；若超過，求「前 n 個標籤 + 展開鈕」整體高度不超過兩行上限的最大 n，
 * 使展開鈕緊跟最後一個可見 tag（對標 ReelShort，而非整列貼右）。
 */
function measurePcTagsTwoRowSplit(
    widthPx: number,
    tags: TData[],
    collapsedMaxPx: number,
    labelFor: (uniqueId: string) => string,
    mountParent: HTMLElement,
): { needsExpand: boolean; visibleCount: number } {
    if (tags.length === 0) {
        return { needsExpand: false, visibleCount: 0 };
    }

    const ghost = document.createElement('div');
    ghost.className = 'rs-search-page__pcTags';
    ghost.style.cssText = `position:fixed;left:-99999px;top:0;width:${widthPx}px;visibility:hidden;pointer-events:none;`;

    mountParent.appendChild(ghost);

    for (const t of tags) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rs-search-page__pcTag';
        b.textContent = labelFor(String(t['unique_id'] ?? ''));
        ghost.appendChild(b);
    }
    const tagsOnlyH = ghost.offsetHeight;
    const needsExpand = tagsOnlyH > collapsedMaxPx + 1;

    if (!needsExpand) {
        mountParent.removeChild(ghost);
        return { needsExpand: false, visibleCount: tags.length };
    }

    ghost.innerHTML = '';

    const makeToggle = (): HTMLButtonElement => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rs-search-page__pcTagsToggle';
        btn.innerHTML = PC_TAG_TOGGLE_INNER_HTML;
        return btn;
    };

    let lo = 0;
    let hi = tags.length;
    let best = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        ghost.innerHTML = '';
        for (let i = 0; i < mid; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'rs-search-page__pcTag';
            b.textContent = labelFor(String(tags[i]['unique_id'] ?? ''));
            ghost.appendChild(b);
        }
        ghost.appendChild(makeToggle());
        const h = ghost.offsetHeight;
        if (h <= collapsedMaxPx + 2) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    mountParent.removeChild(ghost);

    const visibleCount = Math.max(1, best);
    return { needsExpand: true, visibleCount };
}

/** PC 標籤區展開/收起：對標 ReelShort（白底小方塊 + chevron，無文案） */
function PcTagsExpandChevronIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 18"
            className="rs-search-page__pcTagsToggleSvg"
            aria-hidden
        >
            <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 6L9 13L2 6"
            />
        </svg>
    );
}

/** PC：對標 ReelShort tags 頁數字分頁（如 movie-actors） */
function buildSearchPageItems(
    current: number,
    totalPages: number,
): Array<number | 'ellipsis'> {
    if (totalPages <= 1) {
        return [];
    }
    if (totalPages <= 10) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const out: Array<number | 'ellipsis'> = [1];
    const left = Math.max(2, current - 2);
    const right = Math.min(totalPages - 1, current + 2);
    if (left > 2) {
        out.push('ellipsis');
    }
    for (let p = left; p <= right; p++) {
        out.push(p);
    }
    if (right < totalPages - 1) {
        out.push('ellipsis');
    }
    out.push(totalPages);
    return out;
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

function resolveImageSrc(staticBase: string, image: string) {
    if (!image) {
        return '';
    }
    if (image.startsWith('http://') || image.startsWith('https://')) {
        return image;
    }
    return `${staticBase}/${image}`;
}

type SearchRowItem = {
    id: number;
    title: string;
    image: string;
    views?: string;
    favorite?: string;
    desc?: string;
    /** 對標 NetShort /all-plots：標題下灰字標籤行（接口有則展示） */
    tagline?: string;
    episodes: number;
};

/** 列表頁副標題：優先短字段，勿用長簡介頂替（避免與 desc 重複） */
function pickSearchCardTagline(v: TData): string | undefined {
    for (const k of ['sub_title', 'subtitle', 'plot_tags', 'category_text', 'genre_text', 'tag_text'] as const) {
        const x = v[k];
        if (typeof x === 'string' && x.trim()) {
            return x.trim();
        }
    }
    const tags = v['tags'];
    if (Array.isArray(tags) && tags.length > 0) {
        const labels = tags
            .slice(0, 4)
            .map((t) => {
                if (t && typeof t === 'object' && 'name' in (t as object)) {
                    return String((t as { name?: string }).name ?? '').trim();
                }
                return String(t ?? '').trim();
            })
            .filter(Boolean);
        if (labels.length) {
            return labels.join(' ⦁ ');
        }
    }
    return undefined;
}

function toSearchRowItem(v: TData): SearchRowItem | null {
    const id = Number(v['id']);
    if (!Number.isFinite(id)) {
        return null;
    }
    const title = String(v['title'] ?? v['book_title'] ?? v['name'] ?? '');
    const image = String(v['image'] ?? v['cover'] ?? v['poster'] ?? '');
    const views = v['views'] ?? v['play_count'] ?? v['view_count'];
    const favorite = v['favorite'] ?? v['favorite_count'] ?? v['like_count'];
    const desc = String(v['introduction'] ?? v['desc'] ?? v['summary'] ?? v['book_desc'] ?? v['description'] ?? '');
    const epRaw = v['episodes'] ?? v['total_episode'] ?? v['total_episodes'] ?? v['episode_count'];
    const episodes = Number(epRaw);
    return {
        id,
        title,
        image,
        views: views ? String(views) : undefined,
        favorite: favorite ? String(favorite) : undefined,
        desc: desc || undefined,
        tagline: pickSearchCardTagline(v),
        episodes: Number.isFinite(episodes) ? episodes : 0,
    };
}

/** 与首页一致：内层滚动超过此值后显示「回顶」按钮 */
const SCROLL_TOP_FAB_THRESHOLD_PX = 400;
const SCROLL_TOP_FAB_FADE_OUT_MS = 220;

/** PC：與 Profile cabinet `rs-bi-bookItem` 同源（封面骨架 + hover 播放蒙层 + 标题；有集數時顯示 Episodes） */
function SearchPcBookItem({ item }: { item: SearchRowItem }) {
    const intl = useIntl();
    const configStore = useConfigStore();
    const imgSrc = resolveImageSrc(String(configStore.config['static'] ?? ''), item.image);

    return (
        <div className="rs-bi-bookItem rs-dc-bookItem" data-id={item.id}>
            <div className="rs-bi-expoItem" aria-hidden data-report="expo" />
            <div className="rs-bi-poster">
                <Link to={`/video/${item.id}`} state={VIDEO_FROM_HOME_STATE} className="rs-bi-cover">
                    <Skeleton className="rs-bi-coverSkeleton rounded-[inherit] bg-white/10">
                        <div className="rs-bi-coverSkeletonInner flex h-full w-full items-center justify-center p-1 text-center text-sm font-bold">
                            <FormattedMessage id="site_name" />
                        </div>
                    </Skeleton>
                    <LazyLoadImage
                        alt=""
                        src={imgSrc}
                        onLoad={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
                    />
                </Link>
                <div className="rs-bi-playMask">
                    <div className="rs-bi-item-mask" />
                    <div className="rs-bi-coverIconPlay" aria-hidden />
                </div>
            </div>
            <h3 className="rs-bi-title">
                <Link to={`/video/${item.id}`} state={VIDEO_FROM_HOME_STATE}>{item.title}</Link>
            </h3>
            {item.episodes > 0 ? (
                <div className="rs-bi-chapter flex flex-wrap items-center gap-x-1">
                    <span>
                        {intl.formatMessage(
                            { id: 'search_pc_episodes_line', defaultMessage: 'Episodes {count}' },
                            { count: item.episodes },
                        )}
                    </span>
                </div>
            ) : null}
        </div>
    );
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
    const showInstallPrompt = useRootStore((s) => s.showInstallPrompt);
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const timer = useRef(0);
    const requesting = useRef(false);
    const searchStore = useSearchStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const pcTagsRef = useRef<HTMLDivElement>(null);
    const [tagOpen, setTagOpen] = useState(false);
    const [tagKeyword, setTagKeyword] = useState('');
    const [pcTagsExpanded, setPcTagsExpanded] = useState(false);
    const [pcTagsNeedsExpand, setPcTagsNeedsExpand] = useState(false);
    /** 折疊態下僅渲染前 n 個標籤 + 展開鈕，使鈕緊跟最後可見 tag */
    const [pcCollapsedVisibleCount, setPcCollapsedVisibleCount] = useState<number | null>(null);
    const isPc = useMinWidth768();
    /** 与 App `showPwaBottomBar` 一致：窄屏 PWA 底栏时回顶钮抬高 */
    const liftScrollFabForPwaH5 = !isPc && showInstallPrompt;

    const [scrollTopFabMounted, setScrollTopFabMounted] = useState(false);
    const [scrollTopFabOpaque, setScrollTopFabOpaque] = useState(true);
    const scrollTopFabPrevScrollRef = useRef(0);
    const scrollTopFabHideTimerRef = useRef(0);
    const scrollTopForFab = useSearchStore((s) => s.scrollTop);

    useEffect(() => {
        return () => {
            if (scrollTopFabHideTimerRef.current) {
                window.clearTimeout(scrollTopFabHideTimerRef.current);
                scrollTopFabHideTimerRef.current = 0;
            }
        };
    }, []);
    useEffect(() => {
        const st = scrollTopForFab;
        const prev = scrollTopFabPrevScrollRef.current;
        scrollTopFabPrevScrollRef.current = st;
        const wasOver = prev >= SCROLL_TOP_FAB_THRESHOLD_PX;
        const nowOver = st >= SCROLL_TOP_FAB_THRESHOLD_PX;

        if (nowOver) {
            if (scrollTopFabHideTimerRef.current) {
                window.clearTimeout(scrollTopFabHideTimerRef.current);
                scrollTopFabHideTimerRef.current = 0;
            }
            setScrollTopFabMounted(true);
            setScrollTopFabOpaque(true);
            return;
        }
        if (wasOver && !nowOver) {
            setScrollTopFabOpaque(false);
            if (scrollTopFabHideTimerRef.current) {
                window.clearTimeout(scrollTopFabHideTimerRef.current);
            }
            scrollTopFabHideTimerRef.current = window.setTimeout(() => {
                scrollTopFabHideTimerRef.current = 0;
                setScrollTopFabMounted(false);
            }, SCROLL_TOP_FAB_FADE_OUT_MS);
        }
    }, [scrollTopForFab]);

    async function loadData() {
        const loadId = ++searchMovieLoadId;
        requesting.current = true;
        const state = useSearchStore.getState();
        /** PC 換頁或首屏：整頁 loading；H5 僅首屏 loading，追加頁保留列表 */
        if (isPc || state.page === 1) {
            searchStore.setLoading(true);
        }
        try {
            const result = await api<IPagination>('movie', {
                loading: false,
                data: {
                    page: state.page,
                    keyword: state.keyword.trim(),
                    tag: state.tag,
                },
            });
            if (loadId !== searchMovieLoadId) return;

            const d = result.d;
            const rowsRaw = (d.data ?? []) as TData[];
            const rows = dedupeSearchRowsById(rowsRaw);
            const perPage = d.per_page > 0 ? d.per_page : 24;
            const cur = typeof d.current_page === 'number' ? d.current_page : state.page;
            const total = typeof d.count === 'number' ? d.count : 0;
            searchStore.setPaginationMeta(total, perPage);

            if (isPc) {
                searchStore.setList(rows);
            } else if (state.page === 1) {
                searchStore.setList(rows);
            } else {
                searchStore.setList(dedupeSearchRowsById([...state.list, ...rows]));
            }

            searchStore.setLoading(false);

            let hasMore = false;
            if (total > 0) {
                hasMore = cur * perPage < total;
            } else {
                hasMore = rows.length === perPage;
            }
            searchStore.setMore(hasMore);

            if (isPc && scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        } catch {
            if (loadId === searchMovieLoadId) {
                searchStore.setLoading(false);
            }
        } finally {
            if (loadId === searchMovieLoadId) {
                requesting.current = false;
            }
        }
    }

    function handlePcPageChange(nextPage: number) {
        if (requesting.current) {
            return;
        }
        const per = Math.max(1, searchStore.perPage || 24);
        const total = searchStore.totalCount;
        if (nextPage < 1) {
            return;
        }
        if (total > 0) {
            const maxPage = Math.max(1, Math.ceil(total / per));
            if (nextPage > maxPage) {
                return;
            }
        } else if (nextPage > searchStore.page && !searchStore.more) {
            return;
        }
        if (nextPage === 1) {
            searchStore.setPage(1);
        } else {
            useSearchStore.setState({ page: nextPage });
        }
        void loadData();
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

    function handleTagKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTagKeyword(e.target.value);
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

    function breadcrumbCurrentLabel(): string {
        if (searchStore.tag) {
            const row = searchStore.tags.find((t) => (t['name'] as string) === searchStore.tag);
            if (row) {
                return formatTagLabel(String(row['unique_id'] ?? ''));
            }
            return searchStore.tag;
        }
        if (searchStore.keyword.trim()) {
            const q = searchStore.keyword.trim();
            return q.length > 24 ? `${q.slice(0, 24)}…` : q;
        }
        return intl.formatMessage({ id: 'nav_categories' });
    }

    function pageHeading(): string {
        if (searchStore.tag) {
            const row = searchStore.tags.find((t) => (t['name'] as string) === searchStore.tag);
            const tagLabel = row ? formatTagLabel(String(row['unique_id'] ?? '')) : searchStore.tag;
            return intl.formatMessage({ id: 'search_movies_with_tag' }, { tag: tagLabel });
        }
        if (searchStore.keyword.trim()) {
            return intl.formatMessage(
                { id: 'search_results_for' },
                { q: searchStore.keyword.trim() },
            );
        }
        return intl.formatMessage({ id: 'search_movies_all' });
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
        if (s.keyword.trim() === decoded.trim()) {
            return;
        }
        s.setKeyword(decoded);
        s.setPage(1);
    }, []);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        let cancelled = false;
        void (async () => {
            await ensureMovieTags();
            if (cancelled) return;

            const state = useSearchStore.getState();
            const canReuseList =
                state.list.length > 0 && keywordMatchesSearchUrl();

            if (canReuseList) {
                searchStore.setLoading(false);
                requestAnimationFrame(() => {
                    if (cancelled) return;
                    const el = scrollRef.current;
                    if (el) {
                        el.scrollTop = useSearchStore.getState().scrollTop;
                    }
                });
                return;
            }
            void loadData();
        })();
        return () => {
            cancelled = true;
        };
    }, [sessionBootstrapReady]);

    /** PC：兩行高度上限 + 離屏二分測量，决定折疊時展示多少個 tag（展開鈕跟在末尾 tag 後） */
    useLayoutEffect(() => {
        if (!isPc || searchStore.tags.length === 0) {
            setPcTagsNeedsExpand(false);
            setPcCollapsedVisibleCount(null);
            setPcTagsExpanded(false);
            return;
        }
        const host = pcTagsRef.current;
        if (!host) {
            return;
        }

        const run = () => {
            if (pcTagsExpanded) {
                return;
            }
            const w = host.offsetWidth;
            if (w <= 0) {
                return;
            }
            const shell = (host.closest('.rs-search-page') ?? document.body) as HTMLElement;
            const raw = getComputedStyle(host)
                .getPropertyValue('--rs-search-pc-tags-collapsed-max')
                .trim();
            const collapsedMax = Number.isFinite(parseFloat(raw)) && parseFloat(raw) > 0 ? parseFloat(raw) : 96;
            const { needsExpand, visibleCount } = measurePcTagsTwoRowSplit(
                w,
                searchStore.tags,
                collapsedMax,
                (u) => formatTagLabel(u),
                shell,
            );
            setPcTagsNeedsExpand(needsExpand);
            setPcCollapsedVisibleCount(visibleCount);
            if (!needsExpand) {
                setPcTagsExpanded(false);
            }
        };

        run();
        const ro = new ResizeObserver(run);
        ro.observe(host);
        return () => ro.disconnect();
    }, [isPc, searchStore.tags, pcTagsExpanded]);

    const searchPlaceholder = intl.formatMessage({ id: 'search_placeholder' });

    const pcTagsForRender =
        isPc &&
        pcTagsNeedsExpand &&
        !pcTagsExpanded &&
        pcCollapsedVisibleCount !== null
            ? searchStore.tags.slice(0, pcCollapsedVisibleCount)
            : searchStore.tags;

    const perPage = Math.max(1, searchStore.perPage || 24);
    const totalKnown = searchStore.totalCount > 0;
    const totalPages = totalKnown
        ? Math.max(1, Math.ceil(searchStore.totalCount / perPage))
        : 1;
    const pageItems = totalKnown && totalPages > 1 ? buildSearchPageItems(searchStore.page, totalPages) : [];
    const canPrevPc = searchStore.page > 1;
    const canNextPc = totalKnown
        ? searchStore.page < totalPages
        : searchStore.more;
    const showPcPagination =
        isPc &&
        searchStore.list.length > 0 &&
        (totalKnown ? totalPages > 1 : searchStore.more || searchStore.page > 1);

    return (
        <div className="rs-search-page">
            <div
                className="rs-search-page__scroll"
                ref={scrollRef}
                onScroll={handleScrollEnd}
            >
                <ReelShortTopNav scrollParentRef={scrollRef} />

                <div className="rs-search-page__barPad md:hidden">
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
                    {searchStore.tags.length > 0 && !isPc ? (
                        <div className="rs-search-page__tagRow">
                            {searchStore.tags.slice(0, 10).map((v) => (
                                <div
                                    onClick={() => handleTagClick(v['name'] as string)}
                                    key={v['name'] as string}
                                    className={cn(
                                        'rs-search-page__tag',
                                        (v['name'] as string) === searchStore.tag &&
                                            'rs-search-page__tag--active',
                                    )}
                                >
                                    {(v['unique_id'] as string)
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
                                        .join('')}
                                </div>
                            ))}
                            {searchStore.tag &&
                                searchStore.tags
                                    .slice(0, 10)
                                    .filter((w) => w['name'] === searchStore.tag).length === 0 && (
                                    <div
                                        onClick={() => handleTagClick(searchStore.tag)}
                                        key={searchStore.tag}
                                        className="rs-search-page__tag rs-search-page__tag--active"
                                    >
                                        {(
                                            searchStore.tags.find(
                                                (w) => (w['name'] as string) === searchStore.tag,
                                            )!['unique_id'] as string
                                        )
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
                                            .join('')}
                                    </div>
                                )}
                            <div
                                onClick={() => setTagOpen(true)}
                                className="rs-search-page__tagMore"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setTagOpen(true);
                                    }
                                }}
                            >
                                <MoreHorizontal size={20} />
                            </div>
                        </div>
                    ) : null}

                    <div className="rs-search-page__main">
                        {isPc ? (
                            <div className="rs-shelf__container">
                                <div className="rs-shelf__content rs-search-page__pcContent">
                                    <div className="rs-shelf__breadcrumbWrap">
                                        <nav aria-label="Breadcrumb" className="rs-shelf__breadcrumb">
                                            <Link to="/">
                                                <FormattedMessage id="home" />
                                            </Link>
                                            <span className="rs-shelf__breadcrumbSep">/</span>
                                            <span className="rs-shelf__breadcrumbCurrent">
                                                {breadcrumbCurrentLabel()}
                                            </span>
                                        </nav>
                                    </div>

                                    {searchStore.tags.length > 0 ? (
                                        <div className="rs-search-page__pcTagPanel">
                                            <div
                                                ref={pcTagsRef}
                                                className="rs-search-page__pcTags"
                                            >
                                                {pcTagsForRender.map((v) => {
                                                    const name = v['name'] as string;
                                                    const label = formatTagLabel(
                                                        String(v['unique_id'] ?? ''),
                                                    );
                                                    const active = name === searchStore.tag;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            className={cn(
                                                                'rs-search-page__pcTag',
                                                                active && 'rs-search-page__pcTag--active',
                                                            )}
                                                            onClick={() => handleTagClick(name)}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                                {pcTagsNeedsExpand && !pcTagsExpanded ? (
                                                    <button
                                                        type="button"
                                                        className="rs-search-page__pcTagsToggle"
                                                        onClick={() => setPcTagsExpanded(true)}
                                                        aria-expanded={false}
                                                        aria-label="展开标签列表"
                                                        title="展开"
                                                    >
                                                        <PcTagsExpandChevronIcon />
                                                    </button>
                                                ) : null}
                                                {pcTagsNeedsExpand && pcTagsExpanded ? (
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'rs-search-page__pcTagsToggle',
                                                            'rs-search-page__pcTagsToggle--expanded',
                                                        )}
                                                        onClick={() => setPcTagsExpanded(false)}
                                                        aria-expanded
                                                        aria-label="收起标签列表"
                                                        title="收起"
                                                    >
                                                        <PcTagsExpandChevronIcon />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="rs-shelf__heading">
                                        <div className="rs-shelf__headingRow">
                                            <h1 className="rs-shelf__title">{pageHeading()}</h1>
                                        </div>
                                        <div className="rs-shelf__subRow" />
                                    </div>

                                    <div className="rs-search-page__results rs-search-page__results--pc">
                                        {searchStore.loading ? (
                                            <Loader />
                                        ) : searchStore.list.length === 0 ? (
                                            <NoContent />
                                        ) : (
                                            <>
                                                <section className="rs-dc-mylist">
                                                    {searchStore.list.map((v) => {
                                                        const item = toSearchRowItem(v);
                                                        if (!item) {
                                                            return null;
                                                        }
                                                        return (
                                                            <SearchPcBookItem key={item.id} item={item} />
                                                        );
                                                    })}
                                                </section>
                                                {showPcPagination ? (
                                                    <nav
                                                        className="rs-search-page__pagination"
                                                        aria-label={intl.formatMessage({
                                                            id: 'pagination',
                                                            defaultMessage: 'Pagination',
                                                        })}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="rs-search-page__paginationBtn rs-search-page__paginationBtn--nav"
                                                            disabled={!canPrevPc || searchStore.loading}
                                                            onClick={() =>
                                                                handlePcPageChange(searchStore.page - 1)
                                                            }
                                                            aria-label={intl.formatMessage({
                                                                id: 'previous_page',
                                                                defaultMessage: 'Previous page',
                                                            })}
                                                        >
                                                            <ChevronLeft
                                                                size={20}
                                                                aria-hidden
                                                                className="rs-search-page__paginationChevron"
                                                            />
                                                        </button>
                                                        <div className="rs-search-page__paginationPages">
                                                            {pageItems.length > 0
                                                                ? pageItems.map((item, idx) =>
                                                                      item === 'ellipsis' ? (
                                                                          <span
                                                                              key={`e-${idx}`}
                                                                              className="rs-search-page__paginationEllipsis"
                                                                              aria-hidden
                                                                          >
                                                                              …
                                                                          </span>
                                                                      ) : (
                                                                          <button
                                                                              key={item}
                                                                              type="button"
                                                                              className={cn(
                                                                                  'rs-search-page__paginationNum',
                                                                                  item === searchStore.page &&
                                                                                      'rs-search-page__paginationNum--active',
                                                                              )}
                                                                              disabled={searchStore.loading}
                                                                              onClick={() =>
                                                                                  handlePcPageChange(item)
                                                                              }
                                                                          >
                                                                              {item}
                                                                          </button>
                                                                      ),
                                                                  )
                                                                : null}
                                                            {!totalKnown && searchStore.page > 0 ? (
                                                                <span className="rs-search-page__paginationMeta">
                                                                    {searchStore.page}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="rs-search-page__paginationBtn rs-search-page__paginationBtn--nav"
                                                            disabled={!canNextPc || searchStore.loading}
                                                            onClick={() =>
                                                                handlePcPageChange(searchStore.page + 1)
                                                            }
                                                            aria-label={intl.formatMessage({
                                                                id: 'next_page',
                                                                defaultMessage: 'Next page',
                                                            })}
                                                        >
                                                            <ChevronRight
                                                                size={20}
                                                                aria-hidden
                                                                className="rs-search-page__paginationChevron"
                                                            />
                                                        </button>
                                                    </nav>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rs-search-page__results rs-search-page__results--h5">
                                {searchStore.loading ? (
                                    <Loader />
                                ) : searchStore.list.length === 0 ? (
                                    <NoContent />
                                ) : (
                                    <div className="rs-search-page__grid">
                                        {searchStore.list.map((v) => (
                                            <Link
                                                to={`/video/${v['id']}`}
                                                state={VIDEO_FROM_HOME_STATE}
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
                            </div>
                        )}
                        {!isPc && !searchStore.loading && (
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
            <Drawer open={tagOpen} onOpenChange={setTagOpen}>
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
                        <div className="rs-search-page__drawerClose" onClick={() => setTagOpen(false)}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="rs-search-page__drawerDivider" />
                    <div className="rs-search-page__drawerBody">
                        <div className="rs-search-page__drawerTags">
                            {searchStore.tags
                                .filter(
                                    (w) => (w['unique_id'] as string).indexOf(tagKeyword) !== -1,
                                )
                                .map((w) => (
                                    <div
                                        onClick={() => handleTagClick(w['name'] as string)}
                                        key={w['name'] as string}
                                        className={cn(
                                            'rs-search-page__drawerTag',
                                            (w['name'] as string) === searchStore.tag &&
                                                'rs-search-page__drawerTag--active',
                                        )}
                                    >
                                        {(w['unique_id'] as string)
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
                                            .join('')}
                                    </div>
                                ))}
                        </div>
                    </div>
                    <div className="rs-search-page__drawerSpacer" />
                </DrawerContent>
            </Drawer>

            {scrollTopFabMounted ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={intl.formatMessage({ id: 'scroll_to_top' })}
                    className={cn(
                        'pointer-events-auto fixed z-[101] size-10 shrink-0 rounded-full border-0 p-0 leading-none',
                        'md:h-12 md:w-12',
                        'flex items-center justify-center gap-0 shadow-none',
                        'bg-[#e73857] text-white',
                        'transition-[background-color,transform,opacity] duration-200 ease-out',
                        'hover:bg-[#d42d4c] active:scale-[0.96]',
                        scrollTopFabOpaque ? 'opacity-100' : 'pointer-events-none opacity-0',
                        'right-6',
                        liftScrollFabForPwaH5
                            ? 'bottom-[calc(60px+max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1.5rem)))]'
                            : 'bottom-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))]',
                        'md:bottom-12 md:right-6 md:z-[99]',
                    )}
                    onClick={() => {
                        if (scrollRef.current) {
                            scrollElementToTop(scrollRef.current, 450);
                        }
                    }}
                >
                    <ScrollTopArrowUp className={cn('text-current', isPc && 'md:h-6 md:w-6')} />
                </Button>
            ) : null}
        </div>
    );
}
