import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DemoAwemeItem } from '../data/buildDemoAwemeFeed';
import { demoBus, DEMO_EVENT_KEY } from '../douyin/bus';
import { css } from '../douyin/dom';
import { SlideType } from '../douyin/constVar';
import {
    getSlideOffset,
    slideInit,
    slideReset,
    slideTouchEnd,
    slideTouchMove,
    slideTouchStart,
    type DemoSlideState,
} from '../douyin/slide';
import { DemoBaseVideo } from './DemoBaseVideo';

type Props = {
    list: DemoAwemeItem[];
    uniqueId: string;
    name?: string;
    virtualTotal?: number;
    active?: boolean;
    index?: number;
    onIndexChange?: (index: number) => void;
};

const ITEM_CLASS = 'slide-item';

type SlideMount = {
    root: Root;
    parent: HTMLDivElement;
};

function computeWindowStart(localIndex: number, listLength: number, virtualTotal: number): number {
    const half = Math.floor(virtualTotal / 2);
    let start = 0;
    if (localIndex > half) {
        start = localIndex - half;
    }
    let end = start + virtualTotal;
    if (end >= listLength) {
        end = listLength;
        start = Math.max(0, end - virtualTotal);
    }
    return start;
}

/** douyin 增量 DOM + 绝对定位；仅当前条加载 mp4（见 DemoBaseVideo） */
export function SlideVerticalInfinite({
    list,
    uniqueId,
    name = 'infinite',
    virtualTotal = 5,
    active = true,
    index: indexProp = 0,
    onIndexChange,
}: Props) {
    const slideListRef = useRef<HTMLDivElement>(null);
    const appInsMapRef = useRef(new Map<number, SlideMount>());
    const [localIndex, setLocalIndex] = useState(indexProp);
    const prevLocalIndexRef = useRef(indexProp);
    const listRef = useRef(list);
    listRef.current = list;

    const stateRef = useRef<DemoSlideState>({
        judgeValue: 20,
        type: SlideType.VERTICAL_INFINITE,
        name,
        localIndex: indexProp,
        needCheck: true,
        next: false,
        isDown: false,
        start: { x: 0, y: 0, time: 0 },
        move: { x: 0, y: 0 },
        wrapper: { width: 0, height: 0, childrenLength: 0 },
    });

    const half = Math.floor(virtualTotal / 2);
    const stopEmitTimerRef = useRef<number | null>(null);

    const emitIndexSwitch = useCallback(
        (newIndex: number, oldIndex: number) => {
            const items = listRef.current;
            if (!items.length) {
                return;
            }
            if (stopEmitTimerRef.current) {
                window.clearTimeout(stopEmitTimerRef.current);
                stopEmitTimerRef.current = null;
            }
            demoBus.emit(DEMO_EVENT_KEY.CURRENT_ITEM, items[newIndex]);
            demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, {
                uniqueId,
                index: newIndex,
                type: DEMO_EVENT_KEY.ITEM_PLAY,
            });
            stopEmitTimerRef.current = window.setTimeout(() => {
                demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, {
                    uniqueId,
                    index: oldIndex,
                    type: DEMO_EVENT_KEY.ITEM_STOP,
                });
                stopEmitTimerRef.current = null;
            }, 200);
            onIndexChange?.(newIndex);
        },
        [onIndexChange, uniqueId],
    );

    useEffect(() => {
        const prev = prevLocalIndexRef.current;
        if (prev === localIndex) {
            return;
        }
        prevLocalIndexRef.current = localIndex;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                emitIndexSwitch(localIndex, prev);
            });
        });
    }, [localIndex, emitIndexSwitch]);

    const unmountSlideItem = useCallback((index: number) => {
        const entry = appInsMapRef.current.get(index);
        if (!entry) {
            return;
        }
        entry.root.unmount();
        entry.parent.remove();
        appInsMapRef.current.delete(index);
    }, []);

    const positionSlideItem = useCallback((node: HTMLElement, dataIndex: number, h: number) => {
        css(node, 'top', dataIndex * h);
    }, []);

    const getInsEl = useCallback(
        (item: DemoAwemeItem, index: number, play = false) => {
            const parent = document.createElement('div');
            parent.className = ITEM_CLASS;
            parent.setAttribute('data-index', String(index));
            const root = createRoot(parent);
            root.render(
                <DemoBaseVideo
                    item={item}
                    position={{ uniqueId, index }}
                    isPlay={active && play}
                />,
            );
            appInsMapRef.current.set(index, { root, parent });
            return parent;
        },
        [active, uniqueId],
    );

    const applyListTransform = useCallback(() => {
        const el = slideListRef.current;
        const state = stateRef.current;
        if (!el) {
            return;
        }
        slideInit(el, state);
        css(el, 'transform', `translate3d(0px, ${getSlideOffset(state, el)}px, 0)`);
    }, []);

    const insertContent = useCallback(() => {
        const el = slideListRef.current;
        const items = listRef.current;
        const state = stateRef.current;
        if (!el || !items.length) {
            return;
        }

        for (const idx of [...appInsMapRef.current.keys()]) {
            unmountSlideItem(idx);
        }
        el.innerHTML = '';

        slideInit(el, state);
        const h = state.wrapper.height;
        if (h <= 0) {
            return;
        }

        const start = computeWindowStart(state.localIndex, items.length, virtualTotal);
        const end = Math.min(start + virtualTotal, items.length);

        items.slice(start, end).forEach((item, i) => {
            const dataIndex = start + i;
            const node = getInsEl(item, dataIndex, dataIndex === state.localIndex);
            positionSlideItem(node, dataIndex, h);
            el.appendChild(node);
        });

        state.wrapper.childrenLength = el.children.length;
        applyListTransform();
        demoBus.emit(DEMO_EVENT_KEY.CURRENT_ITEM, items[state.localIndex]);
    }, [applyListTransform, getInsEl, positionSlideItem, unmountSlideItem, virtualTotal]);

    const needsFullRebuild = useCallback(
        (idx: number) => {
            const items = listRef.current;
            const el = slideListRef.current;
            if (!el || items.length <= virtualTotal) {
                return false;
            }
            if (!el.querySelector(`.${ITEM_CLASS}[data-index="${idx}"]`)) {
                return true;
            }
            /** 尾部 douyin 不再增量换 DOM，整窗重建避免黑屏 */
            return idx >= items.length - half;
        },
        [half, virtualTotal],
    );

    useEffect(() => {
        const el = slideListRef.current;
        if (!el) {
            return;
        }
        stateRef.current.localIndex = indexProp;
        insertContent();
    }, [indexProp, insertContent, list]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onResize = () => {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                insertContent();
            }, 150);
        };
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
        };
    }, [insertContent]);

    useEffect(() => {
        const el = slideListRef.current;
        if (!el) {
            return;
        }

        const canNext = (state: DemoSlideState, isNext: boolean) =>
            !(
                (state.localIndex === 0 && !isNext) ||
                (state.localIndex === listRef.current.length - 1 && isNext)
            );

        const touchStart = (e: PointerEvent) => slideTouchStart(e, el, stateRef.current);
        const touchMove = (e: PointerEvent) => slideTouchMove(e, el, stateRef.current, canNext);
        const touchEnd = (e: PointerEvent) => {
            const state = stateRef.current;
            const oldIndex = state.localIndex;
            const items = listRef.current;

            slideTouchEnd(e, state, canNext, (next) => {
                if (items.length <= virtualTotal) {
                    return;
                }
                const h = state.wrapper.height;
                if (h <= 0) {
                    return;
                }
                const idx = state.localIndex;
                if (needsFullRebuild(idx)) {
                    return;
                }
                if (next) {
                    if (idx > half && idx < items.length - half) {
                        const addItemIndex = idx + half;
                        if (!el.querySelector(`.${ITEM_CLASS}[data-index="${addItemIndex}"]`) && items[addItemIndex]) {
                            const node = getInsEl(items[addItemIndex], addItemIndex);
                            positionSlideItem(node, addItemIndex, h);
                            el.appendChild(node);
                        }
                        const first = el.querySelector(`.${ITEM_CLASS}:first-child`);
                        const removeIndex = Number(first?.getAttribute('data-index'));
                        if (!Number.isNaN(removeIndex)) {
                            unmountSlideItem(removeIndex);
                        }
                    }
                } else if (idx >= half && idx < items.length - (half + 1)) {
                    const addIndex = idx - half;
                    if (addIndex >= 0 && !el.querySelector(`.${ITEM_CLASS}[data-index="${addIndex}"]`) && items[addIndex]) {
                        const node = getInsEl(items[addIndex], addIndex);
                        positionSlideItem(node, addIndex, h);
                        el.prepend(node);
                    }
                    const last = el.querySelector(`.${ITEM_CLASS}:last-child`);
                    const removeIndex = Number(last?.getAttribute('data-index'));
                    if (!Number.isNaN(removeIndex)) {
                        unmountSlideItem(removeIndex);
                    }
                }
                state.wrapper.childrenLength = el.children.length;
            });

            slideReset(e, el, state, (idx) => {
                if (idx !== oldIndex) {
                    if (needsFullRebuild(idx)) {
                        insertContent();
                    }
                    applyListTransform();
                    setLocalIndex(idx);
                } else {
                    applyListTransform();
                }
            });
        };

        let clickTimer: ReturnType<typeof setTimeout> | null = null;
        let lastClickTime = 0;
        let isDown = false;
        let isMoveLocal = false;
        const checkTime = 200;

        const onDown = () => {
            isDown = true;
        };
        const onMove = () => {
            if (isDown) {
                isMoveLocal = true;
            }
        };
        const onUp = () => {
            if (!isDown) {
                return;
            }
            if (!isMoveLocal && !window.isMoved) {
                const now = Date.now();
                if (now - lastClickTime >= checkTime) {
                    clickTimer = setTimeout(() => {
                        demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK, uniqueId);
                    }, checkTime);
                } else if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                lastClickTime = now;
            }
            isMoveLocal = false;
            isDown = false;
        };

        el.addEventListener('pointerdown', touchStart);
        el.addEventListener('pointermove', touchMove);
        el.addEventListener('pointerup', touchEnd);
        el.addEventListener('pointercancel', touchEnd);
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);

        return () => {
            el.removeEventListener('pointerdown', touchStart);
            el.removeEventListener('pointermove', touchMove);
            el.removeEventListener('pointerup', touchEnd);
            el.removeEventListener('pointercancel', touchEnd);
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
        };
    }, [
        applyListTransform,
        getInsEl,
        insertContent,
        needsFullRebuild,
        positionSlideItem,
        half,
        unmountSlideItem,
        uniqueId,
        virtualTotal,
    ]);

    useEffect(() => {
        return () => {
            for (const idx of [...appInsMapRef.current.keys()]) {
                unmountSlideItem(idx);
            }
        };
    }, [unmountSlideItem]);

    return (
        <div className="slide slide-infinite">
            <div
                ref={slideListRef}
                className="slide-list flex-direction-column"
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={(e) => e.preventDefault()}
                onPointerUp={(e) => e.preventDefault()}
            />
        </div>
    );
}
