import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { HomeBookItem, type HomeBookItemData } from './HomeBookItem';

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

function ShelfChevron() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 18"
            aria-hidden
            className="rotate--90 ml-2/vw w-12/vw"
        >
            <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="m16 6-7 7-7-7"
            />
        </svg>
    );
}

export function HomeBookShelf({
    titleMessageId,
    titleHref,
    viewAllHref,
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
                {type === 'type_1' ? (
                    <Link to={viewAllHref} className="HomePage_shelfHead__more">
                        <FormattedMessage id="home_view_all" />
                        <ShelfChevron />
                    </Link>
                ) : null}
            </div>
            {type === 'type_5' ? (
                <div>
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
                <div className="HomePage_content__DZ4dU HomePage_type_1__uTWfT">
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
