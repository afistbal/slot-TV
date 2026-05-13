import { Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
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

/** 与 `home-reelshort.scss` 中 PC `.HomePage_type_5--pc` / type_1 宫格列断点一致 */
function pcHomeShelfGridColumns(width: number): number {
    if (width >= 1700) {
        return 7;
    }
    if (width >= 1400) {
        return 6;
    }
    if (width >= 1200) {
        return 5;
    }
    if (width >= 1000) {
        return 4;
    }
    return 3;
}

function usePcType5GridColumns(track: boolean) {
    const [cols, setCols] = useState(() =>
        track && typeof window !== 'undefined' ? pcHomeShelfGridColumns(window.innerWidth) : 5,
    );
    useEffect(() => {
        if (!track) {
            return;
        }
        const onResize = () => setCols(pcHomeShelfGridColumns(window.innerWidth));
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [track]);
    return cols;
}

export function HomeBookShelf({
    titleMessageId,
    titleHref,
    viewAllHref: _viewAllHref,
    items,
    staticBase,
    type = 'type_1',
    showMoreMoviesButton,
    onMoreMoviesClick,
}: {
    titleMessageId: string;
    titleHref: string;
    viewAllHref: string;
    items: HomeBookItemData[];
    staticBase: string;
    type?: 'type_1' | 'type_5';
    showMoreMoviesButton?: boolean;
    onMoreMoviesClick?: () => void;
}) {
    /** 非 H5 时 type_1 为 CSS 网格、无横滑，不挂载拖拽/滚轮与 ref */
    const notH5 = useMinWidth768();
    const type1Enabled = type === 'type_1' && !notH5;
    const type1Scroll = useHomeType1H5Scroll(type1Enabled, items.length);
    const pcType5Cols = usePcType5GridColumns(type === 'type_5' && notH5);

    const type5PcVisibleItems = useMemo(() => {
        if (type !== 'type_5' || !notH5 || !showMoreMoviesButton) {
            return items;
        }
        const c = pcType5Cols;
        if (items.length === 0 || c <= 0) {
            return items;
        }
        const remainder = items.length % c;
        if (remainder === 0) {
            return items;
        }
        const kept = items.length - remainder;
        return kept <= 0 ? items : items.slice(0, kept);
    }, [type, notH5, showMoreMoviesButton, items, pcType5Cols]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div data-uistyle={type === 'type_5' ? '5' : '1'} className="HomePage_bookShelf__W2tPD">
            <div className="HomePage_shelfHead">
                <h2>
                    <Link to={titleHref}>
                        <FormattedMessage id={titleMessageId} />
                    </Link>
                </h2>
                {/* {type === 'type_1' ? (
                    <Link to={viewAllHref} className="HomePage_shelfHead__more">
                        <FormattedMessage id="home_view_all" />
                        <ShelfChevron />
                    </Link>
                ) : null} */}
            </div>
            {type === 'type_5' ? (
                <div>
                    {notH5 ? (
                        <div className="HomePage_content__DZ4dU HomePage_type_5__SK5Rv HomePage_type_5--pc">
                            {type5PcVisibleItems.map((item) => (
                                <HomeBookItem
                                    key={item.id}
                                    to={toEpisodeOrVideoHref(item)}
                                    staticBase={staticBase}
                                    item={{ ...item, showExpo: true, showPlayMask: false }}
                                    variant="style5"
                                    linkState={VIDEO_FROM_HOME_STATE}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="HomePage_content__DZ4dU HomePage_type_5__SK5Rv">
                            <div className="HomePage_colunm__1XbhV">
                                {items.filter((_, idx) => idx % 2 === 0).map((item) => (
                                    <HomeBookItem
                                        key={item.id}
                                        to={toEpisodeOrVideoHref(item)}
                                        staticBase={staticBase}
                                        item={{ ...item, showExpo: true, showPlayMask: false }}
                                        variant="style5"
                                        linkState={VIDEO_FROM_HOME_STATE}
                                    />
                                ))}
                            </div>
                            <div className="HomePage_colunm__1XbhV">
                                {items.filter((_, idx) => idx % 2 === 1).map((item) => (
                                    <HomeBookItem
                                        key={item.id}
                                        to={toEpisodeOrVideoHref(item)}
                                        staticBase={staticBase}
                                        item={{ ...item, showExpo: true, showPlayMask: false }}
                                        variant="style5"
                                        linkState={VIDEO_FROM_HOME_STATE}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {showMoreMoviesButton ? (
                        <div className="flex w-full min-w-0 justify-center px-1">
                            <button
                                type="button"
                                className="HomePage_more_movies_btn__z0biE shrink-0"
                                onClick={onMoreMoviesClick}
                                disabled={!onMoreMoviesClick}
                            >
                                <FormattedMessage id="home_more_movies" />
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div
                    ref={notH5 ? undefined : type1Scroll.scrollRef}
                    className="HomePage_content__DZ4dU HomePage_type_1__uTWfT"
                    onPointerDown={notH5 ? undefined : type1Scroll.onPointerDown}
                    onPointerMove={notH5 ? undefined : type1Scroll.onPointerMove}
                    onPointerUp={notH5 ? undefined : type1Scroll.onPointerUp}
                    onPointerCancel={notH5 ? undefined : type1Scroll.onPointerCancel}
                >
                    {items.map((item) => (
                        <HomeBookItem
                            key={item.id}
                            to={toEpisodeOrVideoHref(item)}
                            staticBase={staticBase}
                            item={item}
                            linkState={VIDEO_FROM_HOME_STATE}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
