/**
 * 竖向有限列表滑动：手势对齐 douyin；列表为「一集一格」全量 DOM，`translate` 按当前下标与等高视口计算。
 */

export type VerticalFiniteSlideState = {
    name: string;
    judgeValue: number;
    needCheck: boolean;
    next: boolean;
    isDown: boolean;
    localIndex: number;
    /** 全剧列表长度；用于 canNext，与一次手势中子节点数一致 */
    totalEpisodeCount: number;
    start: { x: number; y: number; time: number };
    move: { x: number; y: number };
    wrapper: { width: number; height: number; childrenLength: number };
};

function readCssNumber(el: HTMLElement, key: 'width' | 'height'): number {
    const v = getComputedStyle(el)[key];
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function setTransform(el: HTMLElement, dx1: number, dy2: number) {
    const v = `translate3d(${dx1}px, ${dy2}px, 0)`;
    const st = el.style as CSSStyleDeclaration & Record<string, string>;
    st.webkitTransform = st.msTransform = st.MozTransform = st.OTransform = st.transform = v;
}

function setTransitionDuration(el: HTMLElement, ms: number) {
    el.style.transitionDuration = `${ms}ms`;
}

function stopLikeDouyin(e: Event) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
}

function getPoint(e: PointerEvent): { pageX: number; pageY: number } {
    return { pageX: e.pageX, pageY: e.pageY };
}

/** 在这些元素上按下时不启动竖滑，避免 `slideTouchMove` 里 `preventDefault` 打断取消静音、外链等 */
export function shouldBypassVerticalSlidePointer(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(
        target.closest(
            'button, a[href], input, textarea, select, [role="button"], .xgplayer-unmute, [data-vertical-swipe-ignore]',
        ),
    );
}

export function createVerticalFiniteSlideState(localIndex: number): VerticalFiniteSlideState {
    return {
        name: 'VideoVertical',
        judgeValue: 20,
        needCheck: true,
        next: false,
        isDown: false,
        localIndex,
        totalEpisodeCount: 0,
        start: { x: 0, y: 0, time: 0 },
        move: { x: 0, y: 0 },
        wrapper: { width: 0, height: 0, childrenLength: 0 },
    };
}

export function canSlide(state: VerticalFiniteSlideState): boolean {
    if (state.needCheck) {
        if (Math.abs(state.move.x) > state.judgeValue || Math.abs(state.move.y) > state.judgeValue) {
            const angle = (Math.abs(state.move.x) * 10) / (Math.abs(state.move.y) * 10 || 1);
            state.next = angle <= 1;
            state.needCheck = false;
        } else {
            return false;
        }
    }
    return state.next;
}

function listLengthForBounds(state: VerticalFiniteSlideState): number {
    return state.totalEpisodeCount > 0 ? state.totalEpisodeCount : state.wrapper.childrenLength;
}

function canNext(state: VerticalFiniteSlideState, isNext: boolean): boolean {
    const maxIdx = listLengthForBounds(state) - 1;
    return !((state.localIndex === 0 && !isNext) || (state.localIndex === maxIdx && isNext));
}

export function getSlideOffset(state: VerticalFiniteSlideState, el: HTMLElement): number {
    const idx = state.localIndex;
    if (idx <= 0) {
        return 0;
    }
    const viewportH = state.wrapper.height;
    if (viewportH > 0 && el.children.length > 0) {
        const h0 = (el.children[0] as HTMLElement).offsetHeight;
        if (h0 > 0 && Math.abs(h0 - viewportH) <= 1) {
            return -idx * viewportH;
        }
    }
    const heights: number[] = [];
    for (const v of Array.from(el.children)) {
        heights.push((v as HTMLElement).offsetHeight);
    }
    const slice = heights.slice(0, idx);
    if (slice.length) {
        return -slice.reduce((a, b) => a + b);
    }
    if (viewportH > 0) {
        return -idx * viewportH;
    }
    return 0;
}

export function slideInit(
    el: HTMLElement,
    state: VerticalFiniteSlideState,
    explicitWrapperHeight?: number,
    totalEpisodeCount?: number,
) {
    state.wrapper.width = readCssNumber(el, 'width');
    state.wrapper.height = explicitWrapperHeight ?? readCssNumber(el, 'height');
    if (totalEpisodeCount !== undefined) {
        state.totalEpisodeCount = totalEpisodeCount;
    } else if (state.totalEpisodeCount <= 0) {
        state.totalEpisodeCount = el.children.length;
    }
    state.wrapper.childrenLength = el.children.length;
    const t = getSlideOffset(state, el);
    setTransitionDuration(el, 0);
    setTransform(el, 0, t);
}

export function slideTouchStart(e: PointerEvent, el: HTMLElement, state: VerticalFiniteSlideState) {
    const pt = getPoint(e);
    setTransitionDuration(el, 0);
    state.start.x = pt.pageX;
    state.start.y = pt.pageY;
    state.start.time = Date.now();
    state.isDown = true;
}

export function slideTouchMove(
    e: PointerEvent,
    el: HTMLElement,
    state: VerticalFiniteSlideState,
    canNextCb: ((s: VerticalFiniteSlideState, isNext: boolean) => boolean) | null = null,
    notNextCb: (() => void) | null = null,
) {
    if (!state.isDown) {
        return;
    }
    const pt = getPoint(e);
    state.move.x = pt.pageX - state.start.x;
    state.move.y = pt.pageY - state.start.y;

    const canSlideRes = canSlide(state);
    const isNext = state.move.y < 0;

    if (canSlideRes) {
        const nextFn = canNextCb ?? canNext;
        if (nextFn(state, isNext)) {
            stopLikeDouyin(e);
            const t = getSlideOffset(state, el) + (isNext ? state.judgeValue : -state.judgeValue);
            const dy2 = t + state.move.y;
            setTransitionDuration(el, 0);
            setTransform(el, 0, dy2);
        } else {
            notNextCb?.();
        }
    }
}

export function slideTouchEnd(
    _e: PointerEvent,
    state: VerticalFiniteSlideState,
    canNextCb: ((s: VerticalFiniteSlideState, isNext: boolean) => boolean) | null = null,
    nextCb: ((isNext: boolean) => void) | null = null,
    notNextCb: (() => void) | null = null,
) {
    if (!state.isDown) {
        return;
    }
    if (state.next) {
        const isNext = state.move.y < 0;
        const nextFn = canNextCb ?? canNext;
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
                    state.localIndex++;
                } else {
                    state.localIndex--;
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
    el: HTMLElement,
    state: VerticalFiniteSlideState,
    onIndexSettled?: (index: number) => void,
) {
    setTransitionDuration(el, 300);
    const t = getSlideOffset(state, el);
    setTransform(el, 0, t);
    state.start.x = state.start.y = state.start.time = state.move.x = state.move.y = 0;
    state.next = false;
    state.needCheck = true;
    state.isDown = false;
    onIndexSettled?.(state.localIndex);
}
