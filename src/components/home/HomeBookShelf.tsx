import { Link } from 'react-router';
import { useCallback, useEffect, useRef } from 'react';
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

/** 从封面 Link 上拖：超过该阈值才算横向拖拽，避免误伤点击跳转 */
const TYPE1_LINK_DRAG_THRESHOLD_PX = 8;

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
    const type1ScrollRef = useRef<HTMLDivElement>(null);
    const type1DragRef = useRef<{
        pointerId: number;
        startX: number;
        startScroll: number;
        moved: boolean;
        startedOnLink: boolean;
    } | null>(null);
    const type1UnbindDocDragRef = useRef<(() => void) | null>(null);

    const blockShelfMisclick = useCallback((shelf: HTMLDivElement) => {
        const blockMisclick = (ev: MouseEvent) => {
            if (!shelf.contains(ev.target as Node)) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
        };
        window.addEventListener('click', blockMisclick, { capture: true, once: true });
    }, []);

    const handleType1PointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) {
            return;
        }
        const el = type1ScrollRef.current;
        if (!el || el.scrollWidth <= el.clientWidth + 2) {
            return;
        }
        const t = e.target as HTMLElement | null;
        const startedOnLink = !!t?.closest('a[href], button');

        type1DragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startScroll: el.scrollLeft,
            moved: false,
            startedOnLink,
        };

        if (!startedOnLink) {
            el.setPointerCapture(e.pointerId);
            return;
        }

        type1UnbindDocDragRef.current?.();

        const onDocMove = (ev: PointerEvent) => {
            const d = type1DragRef.current;
            if (!d || ev.pointerId !== d.pointerId || !d.startedOnLink) {
                return;
            }
            const shelf = type1ScrollRef.current;
            if (!shelf) {
                return;
            }
            const dx = ev.clientX - d.startX;
            if (Math.abs(dx) < TYPE1_LINK_DRAG_THRESHOLD_PX) {
                return;
            }
            d.moved = true;
            shelf.scrollLeft = d.startScroll - dx;
            ev.preventDefault();
        };

        const onDocEnd = (ev: PointerEvent) => {
            const d = type1DragRef.current;
            if (!d || ev.pointerId !== d.pointerId || !d.startedOnLink) {
                return;
            }
            type1UnbindDocDragRef.current?.();
            type1UnbindDocDragRef.current = null;
            type1DragRef.current = null;
            const shelf = type1ScrollRef.current;
            if (d.moved && shelf) {
                blockShelfMisclick(shelf);
            }
        };

        document.addEventListener('pointermove', onDocMove, { capture: true, passive: false });
        document.addEventListener('pointerup', onDocEnd, { capture: true });
        document.addEventListener('pointercancel', onDocEnd, { capture: true });
        type1UnbindDocDragRef.current = () => {
            document.removeEventListener('pointermove', onDocMove, { capture: true });
            document.removeEventListener('pointerup', onDocEnd, { capture: true });
            document.removeEventListener('pointercancel', onDocEnd, { capture: true });
        };
    }, [blockShelfMisclick]);

    const handleType1PointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const d = type1DragRef.current;
        if (!d || e.pointerId !== d.pointerId || d.startedOnLink) {
            return;
        }
        const el = type1ScrollRef.current;
        if (!el) {
            return;
        }
        const dx = e.clientX - d.startX;
        if (Math.abs(dx) > 4) {
            d.moved = true;
        }
        el.scrollLeft = d.startScroll - dx;
    }, []);

    const endType1Drag = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const d = type1DragRef.current;
            if (!d || e.pointerId !== d.pointerId || d.startedOnLink) {
                return;
            }
            const el = type1ScrollRef.current;
            type1DragRef.current = null;
            el?.releasePointerCapture(e.pointerId);
            if (d.moved && el) {
                blockShelfMisclick(el);
            }
        },
        [blockShelfMisclick],
    );

    useEffect(() => {
        if (type !== 'type_1') {
            return;
        }
        const el = type1ScrollRef.current;
        if (!el) {
            return;
        }
        const onWheel = (e: WheelEvent) => {
            if (el.scrollWidth <= el.clientWidth + 2) {
                return;
            }
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }
            if (e.shiftKey) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
                return;
            }
            const { scrollLeft, clientWidth, scrollWidth } = el;
            const maxLeft = Math.max(0, scrollWidth - clientWidth);
            const atStart = scrollLeft <= 1;
            const atEnd = scrollLeft >= maxLeft - 1;
            if (e.deltaY > 0 && !atEnd) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
            } else if (e.deltaY < 0 && !atStart) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [type, items.length]);

    useEffect(() => {
        return () => {
            type1UnbindDocDragRef.current?.();
            type1UnbindDocDragRef.current = null;
            type1DragRef.current = null;
        };
    }, []);

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
                <div
                    ref={type1ScrollRef}
                    className="HomePage_content__DZ4dU HomePage_type_1__uTWfT"
                    onPointerDown={handleType1PointerDown}
                    onPointerMove={handleType1PointerMove}
                    onPointerUp={endType1Drag}
                    onPointerCancel={endType1Drag}
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
