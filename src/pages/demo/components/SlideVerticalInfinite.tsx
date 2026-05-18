import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

function computeWindow(localIndex: number, listLength: number, virtualTotal: number) {
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
    const indices: number[] = [];
    for (let i = start; i < end; i += 1) {
        indices.push(i);
    }
    return { start, end, indices };
}

/** douyin `SlideVerticalInfinite.vue` */
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
    const [localIndex, setLocalIndex] = useState(indexProp);

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
        wrapper: { width: 0, height: 0, childrenLength: list.length },
    });

    const windowPlan = useMemo(
        () => computeWindow(localIndex, list.length, virtualTotal),
        [localIndex, list.length, virtualTotal],
    );

    const emitIndexSwitch = useCallback(
        (newIndex: number, oldIndex: number) => {
            if (!list.length) {
                return;
            }
            demoBus.emit(DEMO_EVENT_KEY.CURRENT_ITEM, list[newIndex]);
            demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, {
                uniqueId,
                index: newIndex,
                type: DEMO_EVENT_KEY.ITEM_PLAY,
            });
            window.setTimeout(() => {
                demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, {
                    uniqueId,
                    index: oldIndex,
                    type: DEMO_EVENT_KEY.ITEM_STOP,
                });
            }, 200);
            onIndexChange?.(newIndex);
        },
        [list, onIndexChange, uniqueId],
    );

    const applyListTransform = useCallback(() => {
        const el = slideListRef.current;
        const state = stateRef.current;
        if (!el) {
            return;
        }
        state.wrapper.childrenLength = list.length;
        css(el, 'transform', `translate3d(0px, ${getSlideOffset(state, el)}px, 0)`);
    }, [list.length]);

    useLayoutEffect(() => {
        stateRef.current.localIndex = localIndex;
        const el = slideListRef.current;
        if (el) {
            slideInit(el, stateRef.current);
            applyListTransform();
        }
    }, [localIndex, applyListTransform, windowPlan.indices.join(',')]);

    useEffect(() => {
        const el = slideListRef.current;
        if (!el) {
            return;
        }

        const canNext = (state: DemoSlideState, isNext: boolean) =>
            !(
                (state.localIndex === 0 && !isNext) ||
                (state.localIndex === list.length - 1 && isNext)
            );

        const touchStart = (e: PointerEvent) => slideTouchStart(e, el, stateRef.current);
        const touchMove = (e: PointerEvent) => slideTouchMove(e, el, stateRef.current, canNext);
        const touchEnd = (e: PointerEvent) => {
            const state = stateRef.current;
            const oldIndex = state.localIndex;
            slideTouchEnd(e, state, canNext);
            slideReset(e, el, state, (idx) => {
                if (idx !== oldIndex) {
                    setLocalIndex(idx);
                    emitIndexSwitch(idx, oldIndex);
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
    }, [applyListTransform, emitIndexSwitch, list.length, uniqueId]);

    const wrapperH = stateRef.current.wrapper.height;
    const itemTopPx =
        wrapperH > 0 && localIndex > 2 && list.length > 5
            ? windowPlan.indices.length - localIndex > 2
                ? (localIndex - 2) * wrapperH
                : windowPlan.start * wrapperH
            : 0;

    return (
        <div className="slide slide-infinite">
            <div
                ref={slideListRef}
                className="slide-list flex-direction-column"
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={(e) => e.preventDefault()}
                onPointerUp={(e) => e.preventDefault()}
            >
                {windowPlan.indices.map((idx) => (
                    <div
                        key={list[idx]!.aweme_id}
                        className="slide-item"
                        data-index={idx}
                        style={itemTopPx > 0 ? { top: itemTopPx } : undefined}
                    >
                        <DemoBaseVideo
                            item={list[idx]!}
                            position={{ uniqueId, index: idx }}
                            isPlay={active && idx === localIndex}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

