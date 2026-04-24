import { Link } from 'react-router';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import { HomeBookItem, type HomeBookItemData } from './HomeBookItem';
import { useHomeType1H5Scroll } from './useHomeType1H5Scroll';

function normalizeEpisodeSlug(raw?: string) {
    if (!raw) return undefined;
    let v = String(raw).trim();
    if (!v) return undefined;
    if (v.startsWith('http://') || v.startsWith('https://')) {
        try {
            const u = new URL(v);
            v = u.pathname;
        } catch {
            // ignore
        }
    }
    v = v.replace(/^[#/]/, '');
    const m = v.match(/(?:^|\/)episodes\/([^/?#]+)$/i);
    if (m) return decodeURIComponent(m[1]);
    if (v.startsWith('episodes/')) return decodeURIComponent(v.slice('episodes/'.length));
    return decodeURIComponent(v);
}

function toEpisodeOrVideoHref(item: { id: number; episodeSlug?: string }) {
    const slug = normalizeEpisodeSlug(item.episodeSlug);
    return slug ? `/episodes/${slug}` : `/video/${item.id}`;
}

/** 对齐镜像 `fb8bb5c8…css` 中 `.Slider_item` 列数断点 */
function pageSizeForViewportWidth(w: number) {
    if (w < 768) {
        return 2;
    }
    if (w <= 700) {
        return 3;
    }
    if (w <= 1000) {
        return 4;
    }
    if (w <= 1200) {
        return 5;
    }
    if (w <= 1400) {
        return 6;
    }
    return 7;
}

function useRowPagerSize() {
    /* SSR/首屏与 useMinWidth768 的 getServerSnapshot 对齐：先按 H5(<768) 用窄视口，避免 --row-cols=5+ 的 HTML 与客户端 hydration 前错位成「多列/横滑感」 */
    const [size, setSize] = useState(() =>
        pageSizeForViewportWidth(typeof window === 'undefined' ? 375 : window.innerWidth),
    );

    useEffect(() => {
        const onResize = () => {
            setSize(pageSizeForViewportWidth(window.innerWidth));
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return size;
}

/**
 * 排名 / 为您推荐：PC(≥768) Slider 分页轨 + 圆钮；H5(<768) DOM 与 `HomeBookShelf` type_1 一致（书架 → 标题 → 横滑列表），尺寸用全局 BookItem 36.8vw。
 */
export function HomeRowPagerShelf({
    titleMessageId,
    titleHref,
    items,
    staticBase,
    shelfId,
}: {
    titleMessageId: string;
    titleHref: string;
    items: HomeBookItemData[];
    staticBase: string;
    shelfId: string;
}) {
    const intl = useIntl();
    const isPc = useMinWidth768();
    const h5Scroll = useHomeType1H5Scroll(!isPc, items.length);
    const pageSizeByViewport = useRowPagerSize();
    /** H5(<768) 固定 2 列，与对站/设计稿两列宫格一致，避免与 PC 共用的视口分栏逻辑在边界情况下错位。 */
    const pageSize = isPc ? pageSizeByViewport : 2;
    const [page, setPage] = useState(0);

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages - 1);

    const pageSlices = useMemo(() => {
        const out: HomeBookItemData[][] = [];
        for (let p = 0; p < totalPages; p++) {
            out.push(items.slice(p * pageSize, p * pageSize + pageSize));
        }
        return out;
    }, [items, pageSize, totalPages]);

    useEffect(() => {
        setPage(0);
    }, [titleMessageId, total]);

    useEffect(() => {
        setPage((p) => Math.min(p, totalPages - 1));
    }, [totalPages]);

    const goPrev = useCallback(() => {
        setPage((p) => Math.max(0, p - 1));
    }, []);

    const goNext = useCallback(() => {
        setPage((p) => Math.min(totalPages - 1, p + 1));
    }, [totalPages]);

    const hasMultiplePages = isPc && totalPages > 1;
    const canPrev = safePage > 0;
    const canNext = safePage < totalPages - 1;

    const gridStyle = {
        ['--row-cols' as string]: String(Math.max(1, pageSize)),
    } as CSSProperties;

    const trackStyle: CSSProperties =
        totalPages > 1
            ? {
                  width: `${totalPages * 100}%`,
                  transform: `translateX(-${(safePage * 100) / totalPages}%)`,
              }
            : { width: '100%' };

    if (items.length === 0) {
        return null;
    }

    const shelfHead = (
        <div className="home_floorTitle__cIyIp HomePage_shelfHead">
            <h2>
                <Link to={titleHref} className="text-white hover:text-[#E52E2E]">
                    <FormattedMessage id={titleMessageId} />
                </Link>
            </h2>
        </div>
    );

    if (!isPc) {
        return (
            <div data-uistyle="1" className="HomePage_bookShelf__W2tPD" id={shelfId}>
                {shelfHead}
                <div
                    ref={h5Scroll.scrollRef}
                    className="HomePage_content__DZ4dU HomePage_type_1__uTWfT"
                    onPointerDown={h5Scroll.onPointerDown}
                    onPointerMove={h5Scroll.onPointerMove}
                    onPointerUp={h5Scroll.onPointerUp}
                    onPointerCancel={h5Scroll.onPointerCancel}
                >
                    {items.map((item) => (
                        <HomeBookItem
                            key={item.id}
                            to={toEpisodeOrVideoHref(item)}
                            staticBase={staticBase}
                            item={item}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div data-uistyle="1" className="HomePage_bookShelf__W2tPD" id={shelfId}>
            <div className="Slider_sliderWrapper__66_q7">
                <div
                    className={cn(
                        'Slider_slider__g_dkb HomePage_reelSlider__root',
                        hasMultiplePages && 'HomePage_reelSlider__root--paged',
                    )}
                    data-uistyle="1"
                >
                    {shelfHead}
                    <div className="Slider_sliderContainer__2F8gq">
                        <div className="HomePage_reelSliderTrack flex" style={trackStyle}>
                            {pageSlices.map((slice, pi) => (
                                <div
                                    key={`${shelfId}-p-${pi}`}
                                    className="HomePage_reelSliderPage shrink-0"
                                    style={{ width: `${100 / totalPages}%` }}
                                >
                                    <div
                                        className={cn(
                                            'Slider_sliderList__o0xyY',
                                            'HomePage_reelSliderList--pageGrid',
                                        )}
                                        style={gridStyle}
                                    >
                                        {slice.map((item) => (
                                            <div key={item.id} className="Slider_item__28DWA">
                                                <HomeBookItem
                                                    to={toEpisodeOrVideoHref(item)}
                                                    staticBase={staticBase}
                                                    item={item}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {hasMultiplePages ? (
                        <>
                            <button
                                type="button"
                                className={cn(
                                    'Slider_pageButtons__jvO9V',
                                    'Slider_prevButton__5XAPR',
                                    !canPrev && 'Slider_disable__GAXYV',
                                )}
                                aria-label={intl.formatMessage({ id: 'home_row_pager_prev' })}
                                onClick={goPrev}
                            />
                            <button
                                type="button"
                                className={cn(
                                    'Slider_pageButtons__jvO9V',
                                    'Slider_nextButton__a5KCv',
                                    !canNext && 'Slider_disable__GAXYV',
                                )}
                                aria-label={intl.formatMessage({ id: 'home_row_pager_next' })}
                                onClick={goNext}
                            />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
