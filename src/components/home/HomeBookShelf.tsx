import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { useMinWidth481 } from '@/hooks/useMinWidth481';
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
    const notH5 = useMinWidth481();
    const type1Enabled = type === 'type_1' && !notH5;
    const type1Scroll = useHomeType1H5Scroll(type1Enabled, items.length);

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
                            {items.map((item) => (
                                <HomeBookItem
                                    key={item.id}
                                    to={toEpisodeOrVideoHref(item)}
                                    staticBase={staticBase}
                                    item={{ ...item, showExpo: true, showPlayMask: false }}
                                    variant="style5"
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
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {showMoreMoviesButton ? (
                        <button
                            type="button"
                            className="HomePage_more_movies_btn__z0biE"
                            onClick={onMoreMoviesClick}
                            disabled={!onMoreMoviesClick}
                        >
                            <FormattedMessage id="home_more_movies" />
                        </button>
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
