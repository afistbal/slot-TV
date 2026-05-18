/**
 * douyin `utils/slide.ts` 直译（VERTICAL_INFINITE 竖滑首页）
 */
import { demoBus } from './bus';
import { css } from './dom';
import { normalizePointerTouch, stopPropagation, type PointerWithTouches } from './utils';
import { SlideType } from './constVar';

export type DemoSlideState = {
    judgeValue: number;
    type: number;
    name: string;
    localIndex: number;
    needCheck: boolean;
    next: boolean;
    isDown: boolean;
    start: { x: number; y: number; time: number };
    move: { x: number; y: number };
    wrapper: { width: number; height: number; childrenLength: number };
};

export function slideInit(el: HTMLDivElement, state: DemoSlideState): void {
    state.wrapper.width = css(el, 'width') as number;
    state.wrapper.height = css(el, 'height') as number;
    queueMicrotask(() => {
        state.wrapper.childrenLength = el.children.length;
    });
    const t = getSlideOffset(state, el);
    css(el, 'transform', `translate3d(0px, ${t}px, 0)`);
}

export function canSlide(state: DemoSlideState): boolean {
    if (state.needCheck) {
        if (Math.abs(state.move.x) > state.judgeValue || Math.abs(state.move.y) > state.judgeValue) {
            const angle = (Math.abs(state.move.x) * 10) / (Math.abs(state.move.y) * 10 || 1);
            state.next = state.type === SlideType.HORIZONTAL ? angle > 1 : angle <= 1;
            state.needCheck = false;
        } else {
            return false;
        }
    }
    return state.next;
}

function canNextDefault(state: DemoSlideState, isNext: boolean): boolean {
    return !(
        (state.localIndex === 0 && !isNext) ||
        (state.localIndex === state.wrapper.childrenLength - 1 && isNext)
    );
}

export function slideTouchStart(e: PointerEvent, el: HTMLDivElement, state: DemoSlideState): void {
    if (!normalizePointerTouch(e)) {
        return;
    }
    css(el, 'transition-duration', '0ms');
    const touch = (e as PointerWithTouches).touches[0]!;
    state.start.x = touch.pageX;
    state.start.y = touch.pageY;
    state.start.time = Date.now();
    state.isDown = true;
}

export function slideTouchMove(
    e: PointerEvent,
    el: HTMLDivElement,
    state: DemoSlideState,
    canNextCb: ((s: DemoSlideState, isNext: boolean) => boolean) | null = null,
    notNextCb: (() => void) | null = null,
    slideOtherDirectionCb: ((e: PointerEvent) => void) | null = null,
): void {
    if (!normalizePointerTouch(e) || !state.isDown) {
        return;
    }
    const touch = (e as PointerWithTouches).touches[0]!;
    state.move.x = touch.pageX - state.start.x;
    state.move.y = touch.pageY - state.start.y;
    const canSlideRes = canSlide(state);
    const isNext = state.type === SlideType.HORIZONTAL ? state.move.x < 0 : state.move.y < 0;

    if (state.type === SlideType.VERTICAL_INFINITE) {
        if (canSlideRes && state.localIndex === 0 && !isNext) {
            demoBus.emit(`${state.name}-moveY`, state.move.y);
        }
    }

    if (canSlideRes) {
        const nextFn = canNextCb ?? canNextDefault;
        if (nextFn(state, isNext)) {
            window.isMoved = true;
            stopPropagation(e);
            const t = getSlideOffset(state, el) + (isNext ? state.judgeValue : -state.judgeValue);
            css(el, 'transition-duration', '0ms');
            css(el, 'transform', `translate3d(0px, ${t + state.move.y}px, 0)`);
        } else {
            notNextCb?.();
        }
    } else {
        slideOtherDirectionCb?.(e);
    }
}

export function slideTouchEnd(
    e: PointerEvent,
    state: DemoSlideState,
    canNextCb: ((s: DemoSlideState, isNext: boolean) => boolean) | null = null,
    nextCb: ((isNext: boolean) => void) | null = null,
    notNextCb: (() => void) | null = null,
): void {
    if (!normalizePointerTouch(e) || !state.isDown) {
        return;
    }
    if (state.next) {
        const isNext = state.move.y < 0;
        const nextFn = canNextCb ?? canNextDefault;
        if (nextFn(state, isNext)) {
            const endTime = Date.now();
            let gapTime = endTime - state.start.time;
            const distance = state.move.y;
            const judgeValue = state.wrapper.height;
            if (Math.abs(distance) < 20) {
                gapTime = 1000;
            }
            if (Math.abs(distance) > judgeValue / 3) {
                gapTime = 100;
            }
            if (gapTime < 150) {
                if (isNext) {
                    state.localIndex += 1;
                } else {
                    state.localIndex -= 1;
                }
                nextCb?.(isNext);
            }
        } else {
            notNextCb?.();
        }
    } else {
        notNextCb?.();
    }
}

export function slideReset(
    e: PointerEvent,
    el: HTMLDivElement,
    state: DemoSlideState,
    onIndex?: (index: number) => void,
): void {
    if (!normalizePointerTouch(e)) {
        return;
    }
    css(el, 'transition-duration', '300ms');
    const t = getSlideOffset(state, el);
    css(el, 'transform', `translate3d(0px, ${t}px, 0)`);
    state.start.x = state.start.y = state.start.time = state.move.x = state.move.y = 0;
    state.next = false;
    state.needCheck = true;
    state.isDown = false;
    window.setTimeout(() => {
        window.isMoved = false;
    }, 200);
    onIndex?.(state.localIndex);
}

export function getSlideOffset(state: DemoSlideState, el: HTMLDivElement): number {
    if (state.type === SlideType.VERTICAL_INFINITE) {
        return -state.localIndex * state.wrapper.height;
    }
    const heights: number[] = [];
    Array.from(el.children).forEach((v) => {
        heights.push(v.getBoundingClientRect().height);
    });
    const slice = heights.slice(0, state.localIndex);
    if (slice.length) {
        return -slice.reduce((a, b) => a + b, 0);
    }
    return 0;
}
