import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api, type IPagination, type TData } from '@/api';
import { skipRemoteApi } from '@/env';
import { useConfigStore } from '@/stores/config';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';

function parseShelfSlug(rawSlug: string) {
    const decoded = decodeURIComponent(rawSlug);
    const m = decoded.match(/-(\d+)\s*$/);
    const shelfId = m ? Number(m[1]) : undefined;
    const namePart = m ? decoded.slice(0, m.index) : decoded;
    const shelfName = namePart.replace(/-short-movies-dramas$/i, '').replace(/-/g, ' ').trim();
    return { decoded, shelfId, shelfName: shelfName || decoded };
}

function resolveImageSrc(staticBase: string, image: string) {
    if (!image) return '';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    return `${staticBase}/${image}`;
}

type ShelfItemData = {
    id: number;
    title: string;
    image: string;
    views?: string;
    favorite?: string;
    desc?: string;
};

function toShelfItemData(v: TData): ShelfItemData | null {
    const id = Number(v['id']);
    if (!Number.isFinite(id)) {
        return null;
    }
    const title = String(v['title'] ?? v['book_title'] ?? v['name'] ?? '');
    const image = String(v['image'] ?? v['cover'] ?? v['poster'] ?? '');
    const views = v['views'] ?? v['play_count'] ?? v['view_count'];
    const favorite = v['favorite'] ?? v['favorite_count'] ?? v['like_count'];
    const desc = String(v['introduction'] ?? v['desc'] ?? v['summary'] ?? v['book_desc'] ?? v['description'] ?? '');
    return {
        id,
        title,
        image,
        views: views ? String(views) : undefined,
        favorite: favorite ? String(favorite) : undefined,
        desc: desc || undefined,
    };
}

function IconPlaySolid({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="1em" height="1em" className={className} aria-hidden>
            <path
                fill="currentColor"
                fillOpacity="0.9"
                d="M4.488 7.04c.817-4.063 2.618-4.91 6.539-3.218a31.933 31.933 0 0 1 7.617 4.624c3.141 2.58 3.141 4.423 0 7.003a31.936 31.936 0 0 1-7.617 4.624c-3.92 1.692-5.722.845-6.54-3.218a24.93 24.93 0 0 1 0-9.815"
            />
        </svg>
    );
}

function IconStarSolid({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="1em" height="1em" className={className} aria-hidden>
            <path
                fill="currentColor"
                fillOpacity="0.9"
                d="M8.98 6.029c1.183-1.866 1.774-2.8 2.585-2.98.287-.065.583-.065.87 0 .81.18 1.402 1.114 2.585 2.98.327.516.491.774.715.969.082.072.17.136.263.194.252.155.544.233 1.13.389 2.117.563 3.176.845 3.597 1.57.149.256.24.542.269.838.08.837-.613 1.695-2 3.412-.383.475-.575.713-.688.988a2.053 2.053 0 0 0-.1.314c-.069.29-.051.597-.017 1.21.126 2.214.189 3.32-.362 3.95a2.017 2.017 0 0 1-.703.518c-.761.336-1.781-.067-3.82-.872-.565-.223-.848-.334-1.141-.358a2.006 2.006 0 0 0-.326 0c-.293.024-.576.136-1.14.358-2.04.805-3.06 1.208-3.82.872a2.016 2.016 0 0 1-.704-.518c-.55-.63-.488-1.736-.362-3.95.034-.614.052-.92-.016-1.21a2.057 2.057 0 0 0-.101-.314c-.113-.275-.305-.513-.689-.988-1.386-1.717-2.079-2.575-1.999-3.412.029-.296.12-.582.269-.838.42-.725 1.48-1.007 3.597-1.57.586-.156.879-.234 1.13-.39.093-.057.18-.121.263-.193.224-.195.388-.453.715-.97"
            />
        </svg>
    );
}

function buildPagerPages(current: number, total: number, variant: 'desktop' | 'mobile') {
    if (total <= 1) return [1];
    const clamp = (n: number) => Math.min(total, Math.max(1, n));
    current = clamp(current);

    // 对齐对方：desktop 显示更多页码；mobile 显示更少
    const headCount = variant === 'desktop' ? 7 : 3;
    if (total <= headCount + 1) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    // 规则：始终展示 1；展示 2..headCount；展示 ...；展示 last
    const pages: (number | 'ellipsis')[] = [1];
    for (let p = 2; p <= headCount; p++) pages.push(p);
    pages.push('ellipsis');
    pages.push(total);

    // 若 current 落在中后段，给 current 附近开窗（更贴近真实分页体验）
    if (current > headCount && current < total) {
        const windowSize = variant === 'desktop' ? 3 : 2;
        const start = clamp(current - 1);
        const end = clamp(current + windowSize - 1);
        const mid: number[] = [];
        for (let p = start; p <= end; p++) {
            if (p !== 1 && p !== total) mid.push(p);
        }
        // 替换掉固定 head 的最后一段（避免重复/跳跃）
        const fixed = new Set<number>([1, total, ...Array.from({ length: headCount - 1 }, (_, i) => i + 2)]);
        const hasMid = mid.some((p) => !fixed.has(p));
        if (hasMid) {
            // 形成：1 ... mid ... last
            const out: (number | 'ellipsis')[] = [1];
            out.push('ellipsis');
            mid.forEach((p) => out.push(p));
            out.push('ellipsis');
            out.push(total);
            return out;
        }
    }

    return pages;
}

export default function Component() {
    const params = useParams();
    const location = useLocation();
    const configStore = useConfigStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    const slug = params['slug'] ?? '';
    const { shelfId, shelfName } = useMemo(() => parseShelfSlug(slug), [slug]);

    const localePrefix = useMemo(() => {
        const locale = params['locale'];
        return locale ? `/${locale}` : '';
    }, [params]);

    const page = useMemo(() => {
        const p1 = Number(params['page'] ?? '');
        if (Number.isFinite(p1) && p1 > 0) return Math.floor(p1);
        const p2 = Number(new URLSearchParams(location.search).get('page') ?? '1');
        return Number.isFinite(p2) && p2 > 0 ? Math.floor(p2) : 1;
    }, [location.search, params]);

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ShelfItemData[]>([]);
    const [more, setMore] = useState(true);
    const [totalPage, setTotalPage] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        async function load() {
            setLoading(true);
            try {
                // 不再使用离线 mock：skipRemoteApi 时保持空列表
                if (skipRemoteApi) {
                    if (!alive) return;
                    setItems([]);
                    setMore(false);
                    setTotalPage(1);
                    return;
                }

                const result = await api<IPagination>('movie', {
                    loading: false,
                    data: {
                        page,
                        ...(shelfId ? { shelf_id: shelfId } : {}),
                        ...(slug ? { shelf_slug: slug } : {}),
                    },
                });
                if (!alive) return;
                const normalized = (result.d?.data ?? [])
                    .map((v) => toShelfItemData(v as TData))
                    .filter(Boolean) as ShelfItemData[];
                setItems(normalized);
                setMore(result.d?.per_page === (result.d?.data?.length ?? 0));
                const count = typeof result.d?.count === 'number' ? result.d.count : undefined;
                const perPage = typeof result.d?.per_page === 'number' ? result.d.per_page : 12;
                setTotalPage(count ? Math.max(1, Math.ceil(count / perPage)) : null);
            } finally {
                if (alive) setLoading(false);
            }
        }
        load();
        return () => {
            alive = false;
        };
    }, [page, shelfId, slug]);

    const basePath = useMemo(() => `${localePrefix}/shelf/${encodeURIComponent(slug)}`, [localePrefix, slug]);
    const prevHref = page > 1 ? `${basePath}/${page - 1}` : null;
    const nextHref = more ? `${basePath}/${page + 1}` : null;
    const pagerTotal = totalPage ?? (more ? page + 1 : page);
    const desktopPages = useMemo(
        () => buildPagerPages(page, pagerTotal, 'desktop'),
        [page, pagerTotal],
    );
    const mobilePages = useMemo(
        () => buildPagerPages(page, pagerTotal, 'mobile'),
        [page, pagerTotal],
    );

    return (
        <div className="rs-shelf">
            <div className="rs-shelf__scroll" ref={scrollRef}>
                <div className="rs-shelf__topnav">
                    <ReelShortTopNav scrollParentRef={scrollRef} />
                </div>
                <div className="rs-shelf__main">
                    <div className="rs-shelf__container">
                        <div className="rs-shelf__content">
                            <div className="rs-shelf__breadcrumbWrap">
                                <nav aria-label="Breadcrumb" className="rs-shelf__breadcrumb">
                                    <Link to={`${localePrefix}/`}>首頁</Link>
                                    <span className="rs-shelf__breadcrumbSep">/</span>
                                    <span className="rs-shelf__breadcrumbCurrent">{shelfName}</span>
                                </nav>
                            </div>
                            <div className="rs-shelf__heading">
                                <div className="rs-shelf__headingRow">
                                    <h1 className="rs-shelf__title">{shelfName} 垂直劇集</h1>
                                    <p className="rs-shelf__pageHint">{totalPage ? `第 ${page} / ${totalPage} 頁` : ''}</p>
                                </div>
                                <div className="rs-shelf__subRow" />
                            </div>

                            <div className="rs-shelf__grid">
                                {items.map((item) => {
                                    const imgSrc = resolveImageSrc(
                                        configStore.config['static'] as string,
                                        item.image,
                                    );
                                    return (
                                        <div key={item.id} className="rs-shelf__card">
                                            <div className="rs-shelf__cover">
                                                <div data-report="expo" className="absolute bottom-0 left-0 right-0" />
                                                <Link to={`/video/${item.id}`} className="cursor-pointer">
                                                    <img
                                                        alt={item.title}
                                                        src={imgSrc}
                                                        decoding="async"
                                                        className="rs-shelf__coverImg"
                                                    />
                                                </Link>
                                            </div>
                                            <div className="rs-shelf__cardBody">
                                                <div>
                                                    <h2 className="rs-shelf__cardTitle">
                                                        <Link to={`/video/${item.id}`}>{item.title}</Link>
                                                    </h2>

                                                    <div className="rs-shelf__meta rs-shelf__meta--mobile">
                                                        <div className="rs-shelf__metaItem">
                                                            <span className="rs-shelf__metaIcon">
                                                                <IconPlaySolid className="rs-shelf__metaSvg" />
                                                            </span>
                                                            {item.views ?? '-'}
                                                        </div>
                                                        <div className="rs-shelf__metaItem">
                                                            <span className="rs-shelf__metaIcon">
                                                                <IconStarSolid className="rs-shelf__metaSvg" />
                                                            </span>
                                                            {item.favorite ?? '-'}
                                                        </div>
                                                    </div>

                                                    {item.desc ? (
                                                        <div
                                                            className="rs-shelf__desc rich-text inner-html-clamp line-clamp-3"
                                                        >
                                                            {item.desc}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="rs-shelf__cardBottom">
                                                    <div className="rs-shelf__meta rs-shelf__meta--desktop">
                                                        <div className="rs-shelf__metaItem">
                                                            <span className="rs-shelf__metaIcon">
                                                                <IconPlaySolid className="rs-shelf__metaSvg" />
                                                            </span>
                                                            {item.views ?? '-'}
                                                        </div>
                                                        <div className="rs-shelf__metaItem">
                                                            <span className="rs-shelf__metaIcon">
                                                                <IconStarSolid className="rs-shelf__metaSvg" />
                                                            </span>
                                                            {item.favorite ?? '-'}
                                                        </div>
                                                    </div>
                                                    <Link
                                                        role="play_btn"
                                                        to={`/video/${item.id}`}
                                                        className="rs-shelf__playBtn"
                                                    >
                                                        <span className="rs-shelf__playBtnIcon">
                                                            <IconPlaySolid className="rs-shelf__playBtnSvg" />
                                                        </span>
                                                        播放
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="rs-shelf__pagerWrap">
                                <div className="rs-shelf__pager">
                                    {prevHref ? (
                                        <Link
                                            rel="prev"
                                            to={prevHref}
                                            className="rs-shelf__pagerBtn"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                viewBox="0 0 24 24"
                                                className="rs-shelf__pagerIcon rs-shelf__pagerIcon--prev"
                                                aria-hidden
                                            >
                                                <path
                                                    fill="currentColor"
                                                    d="m14.83 11.29l-4.24-4.24a1 1 0 0 0-1.42 0a1 1 0 0 0 0 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41a1 1 0 0 0 .71.29a1 1 0 0 0 .71-.29l4.24-4.24a1 1 0 0 0 0-1.42"
                                                />
                                            </svg>
                                        </Link>
                                    ) : (
                                        <div className="rs-shelf__pagerBtn rs-shelf__pagerBtn--disabled">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                viewBox="0 0 24 24"
                                                className="rs-shelf__pagerIcon rs-shelf__pagerIcon--prev"
                                                aria-hidden
                                            >
                                                <path
                                                    fill="currentColor"
                                                    d="m14.83 11.29l-4.24-4.24a1 1 0 0 0-1.42 0a1 1 0 0 0 0 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41a1 1 0 0 0 .71.29a1 1 0 0 0 .71-.29l4.24-4.24a1 1 0 0 0 0-1.42"
                                                />
                                            </svg>
                                        </div>
                                    )}

                                    <div className="rs-shelf__pagerMid rs-shelf__pagerMid--desktop">
                                        {desktopPages.map((p, idx) =>
                                            p === 'ellipsis' ? (
                                                <span key={`d-ellipsis-${idx}`} className="rs-shelf__pagerEllipsis">
                                                    ...
                                                </span>
                                            ) : p === page ? (
                                                <span key={`d-${p}`} className="rs-shelf__pagerCurrent">
                                                    {p}
                                                </span>
                                            ) : (
                                                <Link key={`d-${p}`} className="rs-shelf__pagerNum" to={`${basePath}/${p}`}>
                                                    {p}
                                                </Link>
                                            ),
                                        )}
                                    </div>

                                    <div className="rs-shelf__pagerMid rs-shelf__pagerMid--mobile">
                                        {mobilePages.map((p, idx) =>
                                            p === 'ellipsis' ? (
                                                <span key={`m-ellipsis-${idx}`} className="rs-shelf__pagerEllipsis rs-shelf__pagerEllipsis--mobile">
                                                    ...
                                                </span>
                                            ) : p === page ? (
                                                <span key={`m-${p}`} className="rs-shelf__pagerCurrent">
                                                    {p}
                                                </span>
                                            ) : (
                                                <Link key={`m-${p}`} className="rs-shelf__pagerNum" to={`${basePath}/${p}`}>
                                                    {p}
                                                </Link>
                                            ),
                                        )}
                                    </div>

                                    {nextHref ? (
                                        <Link
                                            rel="next"
                                            to={nextHref}
                                            className="rs-shelf__pagerBtn rs-shelf__pagerBtn--next"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                viewBox="0 0 24 24"
                                                className="rs-shelf__pagerIcon"
                                                aria-hidden
                                            >
                                                <path
                                                    fill="currentColor"
                                                    d="m14.83 11.29l-4.24-4.24a1 1 0 0 0-1.42 0a1 1 0 0 0 0 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41a1 1 0 0 0 .71.29a1 1 0 0 0 .71-.29l4.24-4.24a1 1 0 0 0 0-1.42"
                                                />
                                            </svg>
                                        </Link>
                                    ) : (
                                        <div className="rs-shelf__pagerBtn rs-shelf__pagerBtn--next rs-shelf__pagerBtn--disabled">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="1em"
                                                height="1em"
                                                viewBox="0 0 24 24"
                                                className="rs-shelf__pagerIcon"
                                                aria-hidden
                                            >
                                                <path
                                                    fill="currentColor"
                                                    d="m14.83 11.29l-4.24-4.24a1 1 0 0 0-1.42 0a1 1 0 0 0 0 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41a1 1 0 0 0 .71.29a1 1 0 0 0 .71-.29l4.24-4.24a1 1 0 0 0 0-1.42"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {loading ? <span className="rs-shelf__loading">Loading</span> : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <ReelShortFooter />
            </div>
        </div>
    );
}

