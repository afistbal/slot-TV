import { api, type IPagination, type TData } from '@/api';
import { VideoPosterLazyCover } from '@/components/VideoPosterLazyCover';
import NoContent from '@/components/NoContent';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, useLocation, useNavigate } from 'react-router';
import {
    matchCategoriesPath,
    matchSearchFamilyPath,
    matchSearchOnlyPath,
    matchTagSearchPath,
    resolveSearchPageType,
    type SearchPageType,
} from '@/lib/searchRoutes';
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
import { isOpaqueTagId } from '@/lib/isOpaqueTagId';
import {
    buildTagSearchQuery,
    categoryDisplayLabel,
    ensureMovieTags,
    ensureMovieCategories,
    ensureCategoryTags,
    defaultMovieCategoryId,
    findTagRowByKey,
    readMovieTagFromSearch,
    readTagLabelFromSearch,
    formatTagUniqueId,
    resolveTagDisplayLabel,
    tagRowDisplayLabel,
} from '@/lib/movieTagLabels';
import iconTag from '@/assets/images/icon_tag@2x.png';
import { movieCoverUrl } from '@/lib/movieCoverUrl';

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

/** 最新一次 `movie` 请求生效；较早返回的结果丢弃（导航/Strict Mode 叠请求） */
let searchMovieLoadId = 0;

/** 当前 URL 的 ?q= / ?movie_tag= 是否与 store 一致（用于 keep-alive 下复用列表） */
function searchUrlMatchesStore(search: string): boolean {
    const params = new URLSearchParams(search);
    const urlQ = params.get('q');
    const urlTag = params.get('movie_tag');
    const decodedQ = urlQ ? decodeURIComponent(urlQ.replace(/\+/g, ' ')).trim() : '';
    const decodedTag = urlTag ? decodeURIComponent(urlTag.replace(/\+/g, ' ')).trim() : '';
    const s = useSearchStore.getState();
    const kwOk = urlQ ? s.keyword.trim() === decodedQ : s.keyword.trim() === '';
    const tagOk = urlTag ? s.tag === decodedTag : s.tag === '';
    return kwOk && tagOk;
}

function buildSearchListScopeKey(state: {
    keyword: string;
    tag: string;
    categoryId: string;
}, isCategoriesPage: boolean): string {
    if (isCategoriesPage) {
        if (state.tag) {
            return `categories:tag:${state.tag}`;
        }
        return `categories:category:${state.categoryId || 'all'}`;
    }
    if (state.tag) {
        return `tag:${state.tag}`;
    }
    return `search:${state.keyword.trim()}`;
}

/** 含 calc/rem 的 CSS 变量无法用 parseFloat；用离屏探针解析为像素 */
function resolveCssVarPx(host: HTMLElement, varName: string, fallbackPx: number): number {
    const probe = document.createElement('div');
    probe.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;height:var(' +
        varName +
        ');width:0;overflow:hidden;';
    host.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    host.removeChild(probe);
    return px > 0 && Number.isFinite(px) ? px : fallbackPx;
}

/** H5 /categories 三行折叠高度回退（含 32px 展开钮行高，16px 根字号） */
const H5_CATEGORIES_TAGS_COLLAPSED_FALLBACK_PX = 112;
/** PC 标签三行折叠高度回退 */
const PC_TAGS_COLLAPSED_FALLBACK_PX = 138;

/** 與離屏測量 `measurePcTagsTwoRowSplit` 內 DOM 一致 */
const PC_TAG_TOGGLE_INNER_HTML =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 18" class="rs-search-page__pcTagsToggleSvg" aria-hidden="true">' +
    '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 6L9 13L2 6"/>' +
    '</svg>';

const H5_CATEGORIES_TAG_TOGGLE_INNER_HTML =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 18" class="rs-search-page__categoriesTagsToggleSvg" aria-hidden="true">' +
    '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 6L9 13L2 6"/>' +
    '</svg>';

type TagsRowMeasureClasses = {
    containerClass: string;
    tagClass: string;
    toggleClass: string;
    toggleInnerHtml: string;
};

const PC_TAGS_ROW_MEASURE: TagsRowMeasureClasses = {
    containerClass: 'rs-search-page__pcTags',
    tagClass: 'rs-search-page__pcTag',
    toggleClass: 'rs-search-page__pcTagsToggle',
    toggleInnerHtml: PC_TAG_TOGGLE_INNER_HTML,
};

const H5_CATEGORIES_TAGS_ROW_MEASURE: TagsRowMeasureClasses = {
    containerClass: 'rs-search-page__categoriesTags',
    tagClass: 'rs-search-page__tag',
    toggleClass: 'rs-search-page__categoriesTagsToggle',
    toggleInnerHtml: H5_CATEGORIES_TAG_TOGGLE_INNER_HTML,
};

/** 离屏容器 offsetHeight 含 padding；折叠上限只计 flex 内容区 */
function ghostFlexContentHeightPx(ghost: HTMLElement): number {
    const style = getComputedStyle(ghost);
    const pt = parseFloat(style.paddingTop) || 0;
    const pb = parseFloat(style.paddingBottom) || 0;
    return ghost.offsetHeight - pt - pb;
}

/**
 * 測量：僅標籤是否超過折疊行數；若超過，求「前 n 個標籤 + 展開鈕」整體高度不超過折疊上限的最大 n，
 * 使展開鈕緊跟最後一個可見 tag（對標 ReelShort，而非另起一行）。
 */
function measureTagsTwoRowSplit(
    widthPx: number,
    tags: TData[],
    collapsedMaxPx: number,
    labelFor: (tag: TData) => string,
    mountParent: HTMLElement,
    classes: TagsRowMeasureClasses,
    leadingButtonLabels: string[] = [],
): { needsExpand: boolean; visibleCount: number } {
    if (tags.length === 0 && leadingButtonLabels.length === 0) {
        return { needsExpand: false, visibleCount: 0 };
    }

    const ghost = document.createElement('div');
    ghost.className = classes.containerClass;
    ghost.style.cssText = `position:fixed;left:-99999px;top:0;width:${widthPx}px;visibility:hidden;pointer-events:none;`;

    mountParent.appendChild(ghost);

    const appendLeading = () => {
        for (const label of leadingButtonLabels) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = classes.tagClass;
            b.textContent = label;
            ghost.appendChild(b);
        }
    };

    appendLeading();
    for (const t of tags) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = classes.tagClass;
        b.textContent = labelFor(t);
        ghost.appendChild(b);
    }
    const tagsOnlyH = ghostFlexContentHeightPx(ghost);
    const needsExpand = tagsOnlyH > collapsedMaxPx + 1;

    if (!needsExpand) {
        mountParent.removeChild(ghost);
        return { needsExpand: false, visibleCount: tags.length };
    }

    ghost.innerHTML = '';

    const makeToggle = (): HTMLButtonElement => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = classes.toggleClass;
        btn.innerHTML = classes.toggleInnerHtml;
        return btn;
    };

    let lo = 0;
    let hi = tags.length;
    let best = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        ghost.innerHTML = '';
        appendLeading();
        for (let i = 0; i < mid; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = classes.tagClass;
            b.textContent = labelFor(tags[i]);
            ghost.appendChild(b);
        }
        ghost.appendChild(makeToggle());
        const h = ghostFlexContentHeightPx(ghost);
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

function measurePcTagsTwoRowSplit(
    widthPx: number,
    tags: TData[],
    collapsedMaxPx: number,
    labelFor: (tag: TData) => string,
    mountParent: HTMLElement,
    leadingButtonLabels: string[] = [],
): { needsExpand: boolean; visibleCount: number } {
    return measureTagsTwoRowSplit(
        widthPx,
        tags,
        collapsedMaxPx,
        labelFor,
        mountParent,
        PC_TAGS_ROW_MEASURE,
        leadingButtonLabels,
    );
}

/** PC / H5 分類標籤展開鈕 chevron */
function TagsExpandChevronIcon({ className }: { className: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 18"
            className={className}
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

function PcTagsExpandChevronIcon() {
    return <TagsExpandChevronIcon className="rs-search-page__pcTagsToggleSvg" />;
}

function H5CategoriesTagsExpandChevronIcon() {
    return <TagsExpandChevronIcon className="rs-search-page__categoriesTagsToggleSvg" />;
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

/** 与 `reelshort-dashboard-cabinet-mylist.scss` 中 /search PC 列断点一致 */
function pcSearchGridColumns(width: number): number {
    if (width >= 1201) {
        return 7;
    }
    if (width >= 901) {
        return 6;
    }
    return 5;
}

function usePcSearchGridColumns(enabled: boolean) {
    const [cols, setCols] = useState(() =>
        enabled && typeof window !== 'undefined' ? pcSearchGridColumns(window.innerWidth) : 7,
    );
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const onResize = () => setCols(pcSearchGridColumns(window.innerWidth));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [enabled]);
    return cols;
}

type SearchRowItem = {
    id: number;
    title: string;
    image: string;
    is_rename?: number | string;
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
        is_rename: v['is_rename'] as number | string | undefined,
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
    const imgSrc = movieCoverUrl(item, String(configStore.config['static'] ?? '')) ?? '';

    return (
        <div className="rs-bi-bookItem rs-dc-bookItem" data-id={item.id}>
            <div className="rs-bi-expoItem" aria-hidden data-report="expo" />
            <div className="rs-bi-poster">
                <Link to={`/video/${item.id}`} state={VIDEO_FROM_HOME_STATE} className="rs-bi-cover">
                    <VideoPosterLazyCover src={imgSrc} />
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
    const { pathname } = useLocation();
    return <SearchPage type={resolveSearchPageType(pathname)} />;
}

export function SearchPage({ type }: { type: SearchPageType }) {
    const intl = useIntl();
    const location = useLocation();
    const navigate = useNavigate();
    const isCategoriesPage = type === 'categories';
    const isTagSearchPage = type === 'tagSearch';
    const showH5SearchBar = type !== 'categories' && !isTagSearchPage;
    const showH5LegacyTagRow = type !== 'categories' && type !== 'search' && !isTagSearchPage;
    const configStore = useConfigStore();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const timer = useRef(0);
    const requesting = useRef(false);
    const searchStore = useSearchStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const pcTagsRef = useRef<HTMLDivElement>(null);
    const pcShelfHeadingRef = useRef<HTMLDivElement>(null);
    const [tagOpen, setTagOpen] = useState(false);
    const [tagKeyword, setTagKeyword] = useState('');
    const [h5CategoriesPickerOpen, setH5CategoriesPickerOpen] = useState(false);
    const [pcTagsExpanded, setPcTagsExpanded] = useState(false);
    const [pcTagsNeedsExpand, setPcTagsNeedsExpand] = useState(false);
    const [pcTagsExceedsAnchorRows, setPcTagsExceedsAnchorRows] = useState(false);
    /** 折疊態下僅渲染前 n 個標籤 + 展開鈕，使鈕緊跟最後可見 tag */
    const [pcCollapsedVisibleCount, setPcCollapsedVisibleCount] = useState<number | null>(null);
    const [h5CategoriesTagsNeedsExpand, setH5CategoriesTagsNeedsExpand] = useState(false);
    const [h5CategoriesCollapsedVisibleCount, setH5CategoriesCollapsedVisibleCount] = useState<number | null>(
        null,
    );
    const h5CategoriesTagsRef = useRef<HTMLDivElement>(null);
    const isPc = useMinWidth768();
    const isH5SearchPage = type === 'search' && !isPc;
    const isH5TagSearchPage = isTagSearchPage && !isPc;
    const isPcTagSearchPage = isTagSearchPage && isPc;
    const isH5InnerNavPage = isH5SearchPage || isH5TagSearchPage;
    const tagLabelFromUrl = isTagSearchPage ? readTagLabelFromSearch(location.search) : '';
    const tagKeyFromUrl = isTagSearchPage ? readMovieTagFromSearch(location.search) : '';
    const activeTagKey = searchStore.tag || tagKeyFromUrl;
    const tagDisplayLabel = resolveTagDisplayLabel(
        activeTagKey,
        searchStore.tags,
        intl.formatMessage({ id: 'tag' }),
        tagLabelFromUrl,
    );
    const pcTagSearchTitle =
        tagDisplayLabel ||
        tagLabelFromUrl ||
        (activeTagKey && !isOpaqueTagId(activeTagKey) ? activeTagKey : '');
    const showPcTagSearchHeader = isPcTagSearchPage && Boolean(activeTagKey && pcTagSearchTitle);
    const resolvedActiveTagLabel = () =>
        resolveTagDisplayLabel(
            searchStore.tag,
            searchStore.tags,
            intl.formatMessage({ id: 'tag' }),
            tagLabelFromUrl,
        );
    const selectedCategoryLabel = () => {
        const row = searchStore.categories.find((c) => String(c['id'] ?? '') === searchStore.categoryId);
        return row ? categoryDisplayLabel(row) : '';
    };
    const tagResultCount =
        searchStore.totalCount > 0 ? searchStore.totalCount : searchStore.list.length;
    /** 窄屏底栏（Tab + 可选「添加桌面」）时抬高回顶钮 */
    const liftScrollFabForBottomNav = !isPc;

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
            const categoryId = String(state.categoryId ?? '').trim();
            const shouldLoadByCategory = isCategoriesPage && categoryId && !state.tag;
            const result = await api<IPagination>(shouldLoadByCategory ? 'movie/by-category' : 'movie', {
                loading: false,
                data: shouldLoadByCategory ? {
                    page: state.page,
                    pageSize: state.perPage || 24,
                    category_id: categoryId,
                } : {
                    page: state.page,
                    /** 按标签筛选时只传 tag，避免 keyword 与 tag 语义叠加导致结果不符合预期 */
                    keyword: state.tag ? '' : state.keyword.trim(),
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
            searchStore.setListScopeKey(buildSearchListScopeKey(state, isCategoriesPage));

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

            if (isPc && scrollRef.current && !isCategoriesPage) {
                if (false) {
                    /** 全部劇情（无 tag）不滚到列表区；仅选中具体标签时定位到 rs-shelf__title */
                    scrollRef.current!.scrollTop = 0;
                    searchStore.setScrollTop(0);
                } else {
                    scrollRef.current.scrollTop = 0;
                    searchStore.setScrollTop(0);
                }
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

    function openTagDrawer() {
        setTagKeyword('');
        setTagOpen(true);
    }

    function handleAllPlotsClick() {
        setTagOpen(false);
        setH5CategoriesPickerOpen(false);
        if (!searchStore.tag && !searchStore.keyword.trim()) {
            return;
        }
        searchStore.setTag('');
        searchStore.setKeyword('');
        searchStore.setPage(1);
        if (isCategoriesPage || type === 'search') {
            void loadData();
            return;
        }
        navigate('/categories');
    }

    async function handleCategoryClick(categoryId: string) {
        const nextCategoryId = String(categoryId ?? '').trim();
        if (!nextCategoryId || searchStore.categoryId === nextCategoryId) {
            return;
        }
        if (isPc && isCategoriesPage) {
            const loadId = ++searchMovieLoadId;
            requesting.current = true;
            try {
                const state = useSearchStore.getState();
                const pageSize = state.perPage || 24;
                const [tags, movieResult] = await Promise.all([
                    ensureCategoryTags(nextCategoryId),
                    api<IPagination>('movie/by-category', {
                        loading: false,
                        data: {
                            page: 1,
                            pageSize,
                            category_id: nextCategoryId,
                        },
                    }),
                ]);
                if (loadId !== searchMovieLoadId) {
                    return;
                }

                const d = movieResult.d;
                const rows = dedupeSearchRowsById((d.data ?? []) as TData[]);
                const perPage = d.per_page > 0 ? d.per_page : pageSize;
                const cur = typeof d.current_page === 'number' ? d.current_page : 1;
                const total = typeof d.count === 'number' ? d.count : 0;
                const more = total > 0 ? cur * perPage < total : rows.length === perPage;
                searchStore.setCategoryResults({
                    categoryId: nextCategoryId,
                    tags,
                    list: rows,
                    totalCount: total,
                    perPage,
                    more,
                    listScopeKey: buildSearchListScopeKey(
                        {
                            keyword: '',
                            tag: '',
                            categoryId: nextCategoryId,
                        },
                        true,
                    ),
                });
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                }
            } finally {
                if (loadId === searchMovieLoadId) {
                    requesting.current = false;
                }
            }
            return;
        }
        searchStore.setCategoryId(nextCategoryId);
        searchStore.setTags([]);
        const tags = await ensureCategoryTags(nextCategoryId);
        searchStore.setTag('');
        searchStore.setKeyword('');
        searchStore.setTags(tags);
        searchStore.setPage(1);
        if (isPc && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
            searchStore.setScrollTop(0);
        }
        void loadData();
    }

    /** PC /categories：筛选后滚到 `rs-shelf__title`，而非整页置顶 */
    

    function handleTagClick(name: string) {
        setTagOpen(false);
        setH5CategoriesPickerOpen(false);
        if (searchStore.tag === name) {
            if (isCategoriesPage) {
                searchStore.setTag('');
                searchStore.setKeyword('');
                searchStore.setPage(1);
                void loadData();
                return;
            }
            navigate('/categories');
            return;
        }
        if (isCategoriesPage) {
            searchStore.setTag(name);
            searchStore.setKeyword('');
            searchStore.setPage(1);
            void loadData().then(() => {
                if (!isPc || !pcTagsExceedsAnchorRows) {
                    return;
                }
                requestAnimationFrame(() => {
                    const scrollEl = scrollRef.current;
                    const headingEl = pcShelfHeadingRef.current;
                    if (!scrollEl || !headingEl) {
                        return;
                    }
                    const navEl = scrollEl.querySelector('.reelshort-topnav');
                    const navHeight = navEl instanceof HTMLElement ? navEl.offsetHeight : 0;
                    const next = Math.max(
                        0,
                        headingEl.getBoundingClientRect().top -
                            scrollEl.getBoundingClientRect().top +
                            scrollEl.scrollTop -
                            navHeight,
                    );
                    scrollEl.scrollTop = next;
                    searchStore.setScrollTop(next);
                });
            });
            return;
        }
        const row = findTagRowByKey(name, searchStore.tags);
        const label = row ? tagRowDisplayLabel(row) : '';
        navigate(`/tagSearch?${buildTagSearchQuery(name, label)}`);
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
            const label = resolvedActiveTagLabel();
            if (label) {
                return label;
            }
            if (!isOpaqueTagId(searchStore.tag)) {
                return searchStore.tag;
            }
            return intl.formatMessage({ id: 'nav_categories' });
        }
        if (searchStore.keyword.trim()) {
            const q = searchStore.keyword.trim();
            return q.length > 24 ? `${q.slice(0, 24)}…` : q;
        }
        if (isCategoriesPage && searchStore.categoryId) {
            return selectedCategoryLabel() || intl.formatMessage({ id: 'nav_categories' });
        }
        return intl.formatMessage({ id: 'nav_categories' });
    }

    function pageHeading(): string {
        if (searchStore.tag) {
            const label = resolvedActiveTagLabel();
            if (isTagSearchPage) {
                if (label) {
                    return label;
                }
                if (!isOpaqueTagId(searchStore.tag)) {
                    return searchStore.tag;
                }
                return intl.formatMessage({ id: 'search_movies_all' });
            }
            if (label) {
                if (isCategoriesPage) {
                    return `${label} Movie Collection`;
                }
                return intl.formatMessage({ id: 'search_movies_with_tag' }, { tag: label });
            }
            if (isOpaqueTagId(searchStore.tag) && searchStore.tags.length === 0) {
                return intl.formatMessage({ id: 'search_movies_all' });
            }
            if (isCategoriesPage) {
                return `${searchStore.tag} Movie Collection`;
            }
            return intl.formatMessage(
                { id: 'search_movies_with_tag' },
                { tag: searchStore.tag },
            );
        }
        if (searchStore.keyword.trim()) {
            return intl.formatMessage(
                { id: 'search_results_for' },
                { q: searchStore.keyword.trim() },
            );
        }
        if (isCategoriesPage && searchStore.categoryId) {
            return selectedCategoryLabel() || intl.formatMessage({ id: 'search_movies_all' });
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
        const path = location.pathname;
        if (!matchSearchFamilyPath(path)) {
            return;
        }

        const s = useSearchStore.getState();
        let changed = false;

        if (matchCategoriesPath(path)) {
            if (s.tag) {
                s.setTag('');
                changed = true;
            }
            if (s.keyword.trim()) {
                s.setKeyword('');
                changed = true;
            }
            if (changed) {
                s.setPage(1);
            }
            return;
        }

        if (s.categoryId) {
            s.setCategoryId('');
            s.setTags([]);
        }

        const params = new URLSearchParams(location.search);

        if (matchSearchOnlyPath(path)) {
            const q = params.get('q');
            if (s.tag) {
                s.setTag('');
                changed = true;
            }
            if (q) {
                const decoded = decodeURIComponent(q.replace(/\+/g, ' ')).trim();
                if (s.keyword.trim() !== decoded) {
                    s.setKeyword(decoded);
                    changed = true;
                }
            } else if (s.keyword.trim()) {
                s.setKeyword('');
                changed = true;
            }
            if (changed) {
                s.setPage(1);
            }
            return;
        }

        if (matchTagSearchPath(path)) {
            const movieTag = params.get('movie_tag');
            if (!movieTag) {
                return;
            }
            if (s.keyword.trim()) {
                s.setKeyword('');
                changed = true;
            }
            const decodedTag = decodeURIComponent(movieTag.replace(/\+/g, ' ')).trim();
            if (s.tag !== decodedTag) {
                s.setTag(decodedTag);
                changed = true;
            }
            if (changed) {
                s.setPage(1);
            }
        }
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!sessionBootstrapReady) {
            return;
        }
        const path = location.pathname;
        if (!matchSearchFamilyPath(path)) {
            return;
        }

        let cancelled = false;
        void (async () => {
            if (isCategoriesPage) {
                await ensureMovieCategories();
                if (cancelled) return;
                const latest = useSearchStore.getState();
                const selectedCategoryId = latest.categoryId || defaultMovieCategoryId(latest.categories);
                if (selectedCategoryId && latest.categoryId !== selectedCategoryId) {
                    latest.setCategoryId(selectedCategoryId);
                    latest.setTags([]);
                }
                await ensureCategoryTags(selectedCategoryId);
            } else {
                await ensureMovieTags();
            }
            if (cancelled) return;

            const state = useSearchStore.getState();
            const canReuseList =
                state.list.length > 0 &&
                searchUrlMatchesStore(location.search) &&
                state.listScopeKey === buildSearchListScopeKey(state, isCategoriesPage);

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
    }, [sessionBootstrapReady, location.pathname, location.search]);

    /** PC：三行高度上限 + 離屏二分測量，决定折疊時展示多少個 tag（展開鈕跟在末尾 tag 後） */
    useLayoutEffect(() => {
        if (!isPc || searchStore.tags.length === 0) {
            setPcTagsNeedsExpand(false);
            setPcTagsExceedsAnchorRows(false);
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
            const collapsedMax = resolveCssVarPx(
                host,
                '--rs-search-pc-tags-collapsed-max',
                PC_TAGS_COLLAPSED_FALLBACK_PX,
            );
            const anchorMax = resolveCssVarPx(
                host,
                '--rs-search-pc-tags-anchor-max',
                Math.round((PC_TAGS_COLLAPSED_FALLBACK_PX / 3) * 4),
            );
            const leadingLabels: string[] = [];
            const { needsExpand, visibleCount } = measurePcTagsTwoRowSplit(
                w,
                searchStore.tags,
                collapsedMax,
                (t) => formatTagUniqueId(String(t['unique_id'] ?? '')),
                shell,
                leadingLabels,
            );
            const { needsExpand: exceedsAnchorRows } = measurePcTagsTwoRowSplit(
                w,
                searchStore.tags,
                anchorMax,
                (t) => formatTagUniqueId(String(t['unique_id'] ?? '')),
                shell,
                leadingLabels,
            );
            setPcTagsNeedsExpand(needsExpand);
            setPcTagsExceedsAnchorRows(exceedsAnchorRows);
            setPcCollapsedVisibleCount(visibleCount);
            if (!needsExpand) {
                setPcTagsExpanded(false);
            }
        };

        run();
        const ro = new ResizeObserver(run);
        ro.observe(host);
        return () => ro.disconnect();
    }, [isPc, isCategoriesPage, isTagSearchPage, searchStore.tags, pcTagsExpanded, intl]);

    useLayoutEffect(() => {
        if (isPc || !isCategoriesPage || searchStore.tags.length === 0) {
            setH5CategoriesTagsNeedsExpand(false);
            setH5CategoriesCollapsedVisibleCount(null);
            return;
        }
        const host = h5CategoriesTagsRef.current;
        if (!host) {
            return;
        }

        const run = () => {
            const w = host.offsetWidth;
            if (w <= 0) {
                return;
            }
            const shell = (host.closest('.rs-search-page') ?? document.body) as HTMLElement;
            const collapsedMax = resolveCssVarPx(
                host,
                '--rs-search-categories-tags-collapsed-max',
                H5_CATEGORIES_TAGS_COLLAPSED_FALLBACK_PX,
            );
            const { needsExpand, visibleCount } = measureTagsTwoRowSplit(
                w,
                searchStore.tags,
                collapsedMax,
                tagRowDisplayLabel,
                shell,
                H5_CATEGORIES_TAGS_ROW_MEASURE,
                [],
            );
            setH5CategoriesTagsNeedsExpand(needsExpand);
            setH5CategoriesCollapsedVisibleCount(visibleCount);
        };

        run();
        const ro = new ResizeObserver(run);
        ro.observe(host);
        return () => ro.disconnect();
    }, [isPc, isCategoriesPage, searchStore.tags]);

    const searchPlaceholder = intl.formatMessage({ id: 'search_placeholder' });

    const pcTagsForRender =
        isPc &&
        pcTagsNeedsExpand &&
        !pcTagsExpanded &&
        pcCollapsedVisibleCount !== null
            ? searchStore.tags.slice(0, pcCollapsedVisibleCount)
            : searchStore.tags;

    const h5CategoriesTagsForRender =
        h5CategoriesTagsNeedsExpand && h5CategoriesCollapsedVisibleCount !== null
            ? searchStore.tags.slice(0, h5CategoriesCollapsedVisibleCount)
            : searchStore.tags;
    const categoriesForRender = searchStore.categories;
    const showCategoriesSelector = isCategoriesPage && categoriesForRender.length > 0;
    const h5CategoriesCurrentLabel =
        resolvedActiveTagLabel() ||
        selectedCategoryLabel() ||
        intl.formatMessage({ id: 'nav_categories' });

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

    const pcGridCols = usePcSearchGridColumns(isPc);
    /** PC：尚有下一页时裁掉末行未满格（对齐首页 Latest Updates `pcHideIncompleteRow`） */
    const pcSearchListForRender = useMemo(() => {
        const rows = searchStore.list;
        if (!isPc || !canNextPc || rows.length === 0) {
            return rows;
        }
        const remainder = rows.length % pcGridCols;
        if (remainder === 0) {
            return rows;
        }
        const kept = rows.length - remainder;
        return kept <= 0 ? rows : rows.slice(0, kept);
    }, [isPc, canNextPc, searchStore.list, pcGridCols]);

    return (
        <div
            className={cn(
                'rs-search-page',
                isCategoriesPage && 'rs-search-page--categories',
                isH5SearchPage && 'rs-search-page--h5Search',
                isH5TagSearchPage && 'rs-search-page--h5TagSearch',
                isTagSearchPage && 'rs-search-page--tagSearch',
            )}
        >
            <div
                className="rs-search-page__scroll"
                ref={scrollRef}
                onScroll={handleScrollEnd}
            >
                <ReelShortTopNav
                    scrollParentRef={scrollRef}
                    showPrimaryNav={isCategoriesPage}
                    leftAction={isCategoriesPage ? 'none' : isH5InnerNavPage ? 'back' : 'menu'}
                    showRightActions={!isH5InnerNavPage}
                    showSearch={isCategoriesPage}
                    showProfile={!isCategoriesPage && !isH5InnerNavPage}
                    showLanguage={!isH5InnerNavPage}
                    showHistory={!isH5InnerNavPage}
                />

                {showH5SearchBar ? (
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
                ) : null}

                <div className="rs-search-page__body">
                    {isH5SearchPage ? (
                        <h2 className="rs-search-page__popularHeading">
                            <FormattedMessage id="search_popular_now" defaultMessage="Popular Now" />
                        </h2>
                    ) : null}
                    {isH5TagSearchPage && activeTagKey && pcTagSearchTitle ? (
                        <header className="rs-search-page__tagSearchHeading">
                            <div className="rs-search-page__tagSearchTitleRow">
                                <img
                                    src={iconTag}
                                    alt=""
                                    className="rs-search-page__tagSearchIcon"
                                    aria-hidden
                                />
                                <h1 className="rs-search-page__tagSearchTitle">{pcTagSearchTitle}</h1>
                            </div>
                            <p className="rs-search-page__tagSearchMeta">
                                <FormattedMessage
                                    id="tag_search_total_count"
                                    defaultMessage="{count} in total"
                                    values={{ count: tagResultCount }}
                                />
                            </p>
                        </header>
                    ) : null}
                    {isCategoriesPage && !isPc && (showCategoriesSelector || searchStore.tags.length > 0) ? (
                        <section
                            className="rs-search-page__categoriesPanel rs-search-page__categoriesPanel--h5Picker"
                            aria-label={intl.formatMessage({ id: 'nav_categories' })}
                        >
                            <button
                                type="button"
                                className="rs-search-page__h5CategorySelect"
                                onClick={() => setH5CategoriesPickerOpen((open) => !open)}
                                aria-expanded={h5CategoriesPickerOpen}
                            >
                                <span className="rs-search-page__h5CategorySelectText">
                                    {h5CategoriesCurrentLabel}
                                </span>
                                <TagsExpandChevronIcon
                                    className={cn(
                                        'rs-search-page__h5CategorySelectSvg',
                                        h5CategoriesPickerOpen &&
                                            'rs-search-page__h5CategorySelectSvg--open',
                                    )}
                                />
                            </button>
                            {h5CategoriesPickerOpen ? (
                                <div className="rs-search-page__h5CategoryDropdown">
                                    <div className="rs-search-page__h5CategoryDropdownHeader">
                                        <h2 className="rs-search-page__h5CategoryDropdownTitle">
                                            <FormattedMessage id="nav_categories" />
                                        </h2>
                                        <button
                                            type="button"
                                            className="rs-search-page__h5CategoryDropdownClose"
                                            onClick={() => setH5CategoriesPickerOpen(false)}
                                            aria-label={intl.formatMessage({
                                                id: 'close',
                                                defaultMessage: 'Close',
                                            })}
                                        >
                                            <X size={18} aria-hidden />
                                        </button>
                                    </div>
                                    <div className="rs-search-page__h5CategoryDropdownBody">
                                        <div className="rs-search-page__h5CategorySide">
                                            {categoriesForRender.map((v) => {
                                                const id = String(v['id'] ?? '');
                                                return (
                                                    <button
                                                        type="button"
                                                        key={id}
                                                        className={cn(
                                                            'rs-search-page__h5CategorySideItem',
                                                            id === searchStore.categoryId &&
                                                                'rs-search-page__h5CategorySideItem--active',
                                                        )}
                                                        onClick={() => void handleCategoryClick(id)}
                                                    >
                                                        {categoryDisplayLabel(v)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="rs-search-page__h5CategoryTagsPane">
                                            {searchStore.tags.map((v) => {
                                                const name = v['name'] as string;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={name}
                                                        className={cn(
                                                            'rs-search-page__tag',
                                                            name === searchStore.tag &&
                                                                'rs-search-page__tag--active',
                                                        )}
                                                        onClick={() => handleTagClick(name)}
                                                    >
                                                        {tagRowDisplayLabel(v)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            <h2 className="rs-search-page__categoriesHeading">
                                <FormattedMessage id="categories_all_dramas" />
                            </h2>
                            {showCategoriesSelector ? (
                                <div className="rs-search-page__categoryTabs">
                                    {categoriesForRender.map((v) => {
                                        const id = String(v['id'] ?? '');
                                        return (
                                            <button
                                                type="button"
                                                key={id}
                                                className={cn(
                                                    'rs-search-page__categoryTab',
                                                    id === searchStore.categoryId &&
                                                        'rs-search-page__categoryTab--active',
                                                )}
                                                onClick={() => void handleCategoryClick(id)}
                                            >
                                                {categoryDisplayLabel(v)}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                            <div ref={h5CategoriesTagsRef} className="rs-search-page__categoriesTags">
                                <button
                                    type="button"
                                    className={cn(
                                        'rs-search-page__tag',
                                        !searchStore.tag && 'rs-search-page__tag--active',
                                    )}
                                    onClick={() => {
                                        if (searchStore.tag) {
                                            handleAllPlotsClick();
                                        }
                                    }}
                                >
                                    <FormattedMessage id="categories_all_plots" />
                                </button>
                                {h5CategoriesTagsForRender.map((v) => {
                                    const name = v['name'] as string;
                                    return (
                                        <button
                                            type="button"
                                            key={name}
                                            className={cn(
                                                'rs-search-page__tag',
                                                name === searchStore.tag && 'rs-search-page__tag--active',
                                            )}
                                            onClick={() => handleTagClick(name)}
                                        >
                                            {tagRowDisplayLabel(v)}
                                        </button>
                                    );
                                })}
                                {h5CategoriesTagsNeedsExpand ? (
                                    <button
                                        type="button"
                                        className="rs-search-page__categoriesTagsToggle"
                                        onClick={openTagDrawer}
                                        aria-expanded={tagOpen}
                                        aria-label="打开标签列表"
                                        title="打开标签列表"
                                    >
                                        <H5CategoriesTagsExpandChevronIcon />
                                    </button>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                    {showH5LegacyTagRow && searchStore.tags.length > 0 && !isPc ? (
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
                                    {tagRowDisplayLabel(v)}
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
                                        {tagRowDisplayLabel(
                                            searchStore.tags.find(
                                                (w) => (w['name'] as string) === searchStore.tag,
                                            )!,
                                        )}
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
                                    {showPcTagSearchHeader ? (
                                        <header className="rs-search-page__pcTagSearchBar">
                                            <div className="rs-search-page__pcTagSearchLeft">
                                                <button
                                                    type="button"
                                                    className="rs-search-page__pcTagSearchBack"
                                                    onClick={() => navigate(-1)}
                                                    aria-label={intl.formatMessage({
                                                        id: 'back',
                                                        defaultMessage: 'Back',
                                                    })}
                                                >
                                                    <ChevronLeft size={22} aria-hidden />
                                                </button>
                                                <h1 className="rs-search-page__pcTagSearchTitle">
                                                    {pcTagSearchTitle}
                                                </h1>
                                            </div>
                                            <p className="rs-search-page__tagSearchCount">
                                                <FormattedMessage
                                                    id="tag_search_total_count"
                                                    defaultMessage="{count} in total"
                                                    values={{ count: tagResultCount }}
                                                />
                                            </p>
                                        </header>
                                    ) : !isCategoriesPage ? (
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
                                    ) : null}

                                    {(showCategoriesSelector || searchStore.tags.length > 0) && !isTagSearchPage ? (
                                        <div className="rs-search-page__pcTagPanel">
                                            {showCategoriesSelector ? (
                                                <div className="rs-search-page__pcCategoryTabs">
                                                    {categoriesForRender.map((v) => {
                                                        const id = String(v['id'] ?? '');
                                                        return (
                                                            <button
                                                                key={id}
                                                                type="button"
                                                                className={cn(
                                                                    'rs-search-page__pcCategoryTab',
                                                                    id === searchStore.categoryId &&
                                                                        'rs-search-page__pcCategoryTab--active',
                                                                )}
                                                                onClick={() => void handleCategoryClick(id)}
                                                            >
                                                                {categoryDisplayLabel(v)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                            <div
                                                ref={pcTagsRef}
                                                className="rs-search-page__pcTags"
                                            >
                                                {pcTagsForRender.map((v) => {
                                                    const name = v['name'] as string;
                                                    const label = formatTagUniqueId(String(v['unique_id'] ?? ''));
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

                                    {!isPcTagSearchPage ? (
                                        <div className="rs-shelf__heading" ref={pcShelfHeadingRef}>
                                            <div className="rs-shelf__headingRow">
                                                <h1 className="rs-shelf__title">{pageHeading()}</h1>
                                            </div>
                                            <div className="rs-shelf__subRow" />
                                        </div>
                                    ) : null}

                                    <div className="rs-search-page__results rs-search-page__results--pc">
                                        {searchStore.loading ? (
                                            <Loader />
                                        ) : searchStore.list.length === 0 ? (
                                            <NoContent />
                                        ) : (
                                            <>
                                                <section className="rs-dc-mylist">
                                                    {pcSearchListForRender.map((v) => {
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
                                                        className="rs-shelf__pagerWrap rs-search-page__paginationWrap"
                                                        aria-label={intl.formatMessage({
                                                            id: 'pagination',
                                                            defaultMessage: 'Pagination',
                                                        })}
                                                    >
                                                        <div className="rs-shelf__pager">
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    'rs-shelf__pagerBtn',
                                                                    (!canPrevPc || searchStore.loading) &&
                                                                        'rs-shelf__pagerBtn--disabled',
                                                                )}
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
                                                                    className="rs-shelf__pagerIcon"
                                                                    aria-hidden
                                                                />
                                                            </button>
                                                            <div className="rs-shelf__pagerMid rs-shelf__pagerMid--desktop">
                                                                {pageItems.length > 0
                                                                    ? pageItems.map((item, idx) =>
                                                                          item === 'ellipsis' ? (
                                                                              <span
                                                                                  key={`e-${idx}`}
                                                                                  className="rs-shelf__pagerEllipsis"
                                                                                  aria-hidden
                                                                              >
                                                                                  …
                                                                              </span>
                                                                          ) : item === searchStore.page ? (
                                                                              <span
                                                                                  key={item}
                                                                                  className="rs-shelf__pagerCurrent"
                                                                              >
                                                                                  {item}
                                                                              </span>
                                                                          ) : (
                                                                              <button
                                                                                  key={item}
                                                                                  type="button"
                                                                                  className="rs-shelf__pagerNum"
                                                                                  disabled={searchStore.loading}
                                                                                  onClick={() =>
                                                                                      handlePcPageChange(item)
                                                                                  }
                                                                              >
                                                                                  {item}
                                                                              </button>
                                                                          ),
                                                                      )
                                                                    : !totalKnown && searchStore.page > 0 ? (
                                                                          <span className="rs-shelf__pagerCurrent">
                                                                              {searchStore.page}
                                                                          </span>
                                                                      ) : null}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    'rs-shelf__pagerBtn rs-shelf__pagerBtn--next',
                                                                    (!canNextPc || searchStore.loading) &&
                                                                        'rs-shelf__pagerBtn--disabled',
                                                                )}
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
                                                                    className="rs-shelf__pagerIcon"
                                                                    aria-hidden
                                                                />
                                                            </button>
                                                        </div>
                                                    </nav>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={cn(
                                    'rs-search-page__results rs-search-page__results--h5',
                                    (searchStore.loading || searchStore.list.length === 0) &&
                                        'rs-search-page__results--h5Shell',
                                )}
                            >
                                {searchStore.loading ? (
                                    <Loader />
                                ) : searchStore.list.length === 0 ? (
                                    <NoContent />
                                ) : (
                                    <>
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
                                                        src={
                                                            movieCoverUrl(
                                                                v,
                                                                configStore.config['static'] as string,
                                                            ) ?? ''
                                                        }
                                                        className="rs-search-page__poster"
                                                    />
                                                    <div className="rs-search-page__title">{`${v['title']}`}</div>
                                                </Link>
                                            ))}
                                        </div>
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
                                    </>
                                )}
                            </div>
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
                        <div className="rs-search-page__categoriesTags">
                            {searchStore.tags
                                .filter((w) => {
                                    const kw = tagKeyword.trim().toLowerCase();
                                    if (!kw) {
                                        return true;
                                    }
                                    const uid = String(w['unique_id'] ?? '').toLowerCase();
                                    const name = String(w['name'] ?? '').toLowerCase();
                                    const local = String(w['local_label'] ?? '').toLowerCase();
                                    return uid.includes(kw) || name.includes(kw) || local.includes(kw);
                                })
                                .map((w) => {
                                    const name = w['name'] as string;
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => handleTagClick(name)}
                                            key={name}
                                            className={cn(
                                                'rs-search-page__tag',
                                                name === searchStore.tag && 'rs-search-page__tag--active',
                                            )}
                                        >
                                            {tagRowDisplayLabel(w)}
                                        </button>
                                    );
                                })}
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
                        liftScrollFabForBottomNav
                            ? 'bottom-[calc(var(--rs-bottom-nav-stack,0px)+1.5rem)]'
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
