import { useCallback, useEffect, useRef } from 'react';

/** 从封面 Link 上拖：超过该阈值才算横向拖拽，避免误伤点击跳转 */
const TYPE1_LINK_DRAG_THRESHOLD_PX = 8;

/**
 * H5 首页 type_1 横向货架：原生 touch 走 overflow-x + touch-action:pan-x；鼠标在链路上拖动用 document 监听。
 * `enabled` 为 false 时不挂载滚轮逻辑，指针处理器仍返回但父组件可不绑定。
 */
export function useHomeType1H5Scroll(enabled: boolean, itemsLength: number) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startScroll: number;
        moved: boolean;
        startedOnLink: boolean;
    } | null>(null);
    const unbindDocDragRef = useRef<(() => void) | null>(null);

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

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!enabled || e.button !== 0) {
                return;
            }
            if (e.pointerType === 'touch') {
                return;
            }
            const el = scrollRef.current;
            if (!el || el.scrollWidth <= el.clientWidth + 2) {
                return;
            }
            const t = e.target as HTMLElement | null;
            const startedOnLink = !!t?.closest('a[href], button');

            dragRef.current = {
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

            unbindDocDragRef.current?.();

            const onDocMove = (ev: PointerEvent) => {
                const d = dragRef.current;
                if (!d || ev.pointerId !== d.pointerId || !d.startedOnLink) {
                    return;
                }
                const shelf = scrollRef.current;
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
                const d = dragRef.current;
                if (!d || ev.pointerId !== d.pointerId || !d.startedOnLink) {
                    return;
                }
                unbindDocDragRef.current?.();
                unbindDocDragRef.current = null;
                dragRef.current = null;
                const shelf = scrollRef.current;
                if (d.moved && shelf) {
                    blockShelfMisclick(shelf);
                }
            };

            document.addEventListener('pointermove', onDocMove, { capture: true, passive: false });
            document.addEventListener('pointerup', onDocEnd, { capture: true });
            document.addEventListener('pointercancel', onDocEnd, { capture: true });
            unbindDocDragRef.current = () => {
                document.removeEventListener('pointermove', onDocMove, { capture: true });
                document.removeEventListener('pointerup', onDocEnd, { capture: true });
                document.removeEventListener('pointercancel', onDocEnd, { capture: true });
            };
        },
        [enabled, blockShelfMisclick],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!enabled) {
                return;
            }
            const d = dragRef.current;
            if (!d || e.pointerId !== d.pointerId || d.startedOnLink) {
                return;
            }
            const el = scrollRef.current;
            if (!el) {
                return;
            }
            const dx = e.clientX - d.startX;
            if (Math.abs(dx) > 4) {
                d.moved = true;
            }
            el.scrollLeft = d.startScroll - dx;
        },
        [enabled],
    );

    const endDrag = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!enabled) {
                return;
            }
            const d = dragRef.current;
            if (!d || e.pointerId !== d.pointerId || d.startedOnLink) {
                return;
            }
            const el = scrollRef.current;
            dragRef.current = null;
            el?.releasePointerCapture(e.pointerId);
            if (d.moved && el) {
                blockShelfMisclick(el);
            }
        },
        [enabled, blockShelfMisclick],
    );

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const el = scrollRef.current;
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
    }, [enabled, itemsLength]);

    useEffect(() => {
        return () => {
            unbindDocDragRef.current?.();
            unbindDocDragRef.current = null;
            dragRef.current = null;
        };
    }, []);

    return {
        scrollRef,
        onPointerDown: enabled ? handlePointerDown : undefined,
        onPointerMove: enabled ? handlePointerMove : undefined,
        onPointerUp: enabled ? endDrag : undefined,
        onPointerCancel: enabled ? endDrag : undefined,
    };
}
