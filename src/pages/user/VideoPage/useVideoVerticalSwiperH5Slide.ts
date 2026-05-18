/**
 * H5 专用：竖向列表 `pointerdown / move / up(cancel)` 与 douyin 同源 slide 数学，
 * 与 PC 滚轮、首屏 layout 等分离，便于单独优化 H5 换集速度与 iOS 行为。
 */
import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import type { IPlayerData } from '@/types/videoPlayer';
import {
    slideInit,
    slideReset,
    shouldBypassVerticalSlidePointer,
    slideTouchEnd,
    slideTouchMove,
    slideTouchStart,
    type VerticalFiniteSlideState,
} from './videoVerticalDouyinSlide';

export type UseVideoVerticalSwiperH5SlideParams = {
    listRef: RefObject<HTMLDivElement | null>;
    outerRef: RefObject<HTMLDivElement | null>;
    slideStateRef: MutableRefObject<VerticalFiniteSlideState>;
    legacyEpisodeAutoplayRef: MutableRefObject<boolean>;
    skipLayoutUrlSyncRef: MutableRefObject<boolean>;
    setCurrent: Dispatch<SetStateAction<number>>;
    syncNavigateForIndex: (listIndex: number) => void;
    markFullscreenTransition: () => void;
};

export function useVideoVerticalSwiperH5Slide(
    enabled: boolean,
    data: IPlayerData | undefined,
    p: UseVideoVerticalSwiperH5SlideParams,
): void {
    const {
        listRef,
        outerRef,
        slideStateRef,
        legacyEpisodeAutoplayRef,
        skipLayoutUrlSyncRef,
        setCurrent,
        syncNavigateForIndex,
        markFullscreenTransition,
    } = p;

    useEffect(() => {
        if (!enabled || !data) {
            return;
        }
        const el = listRef.current;
        if (!el) {
            return;
        }
        const onPointerDown = (e: PointerEvent) => {
            if ((e.target as Element | null)?.closest('[data-pc-episode-aside]')) {
                return;
            }
            if (shouldBypassVerticalSlidePointer(e.target)) {
                return;
            }
            /** 勿 `setPointerCapture`：会把 pointer 锁在 list 上，子层「取消静音」等收不到完整 click。竖滑靠冒泡到 list 的 move/up。 */
            slideTouchStart(e, el, slideStateRef.current);
        };
        const onPointerMove = (e: PointerEvent) => {
            slideTouchMove(e, el, slideStateRef.current, null, null);
        };
        const onPointerUp = (e: PointerEvent) => {
            const idxBeforeSlide = slideStateRef.current.localIndex;
            slideTouchEnd(e, slideStateRef.current, null, null, null);
            const idx = slideStateRef.current.localIndex;
            /** 竖滑真正换集后再置位：与「点下一集」一致走 legacy 有声优先 play；避免仅 pointerdown 置位在 iOS 上被长异步链错开 */
            if (idx !== idxBeforeSlide) {
                legacyEpisodeAutoplayRef.current = true;
            }
            markFullscreenTransition();
            skipLayoutUrlSyncRef.current = true;
            flushSync(() => {
                setCurrent(idx);
                syncNavigateForIndex(idx);
            });
            const list = listRef.current;
            const outer = outerRef.current;
            if (list !== null && outer !== null) {
                const outerH = outer.clientHeight;
                if (outerH > 0) {
                    slideStateRef.current.wrapper.height = outerH;
                    /** 与 `handleSetEpisode` / douyin `touchEnd` 一致：index 与 DOM 切片已更新后再 `slideInit`，避免仅靠 `slideReset` 时序与 URL 竞态 */
                    slideInit(list, slideStateRef.current, outerH, data.episodes.length);
                }
            }
            const listForReset = listRef.current;
            if (listForReset !== null) {
                slideReset(listForReset, slideStateRef.current);
            }
        };
        const opts: AddEventListenerOptions = { passive: false };
        el.addEventListener('pointerdown', onPointerDown, opts);
        el.addEventListener('pointermove', onPointerMove, opts);
        el.addEventListener('pointerup', onPointerUp, opts);
        el.addEventListener('pointercancel', onPointerUp, opts);
        return () => {
            el.removeEventListener('pointerdown', onPointerDown, opts);
            el.removeEventListener('pointermove', onPointerMove, opts);
            el.removeEventListener('pointerup', onPointerUp, opts);
            el.removeEventListener('pointercancel', onPointerUp, opts);
        };
    }, [enabled, data, listRef, outerRef, slideStateRef, legacyEpisodeAutoplayRef, skipLayoutUrlSyncRef, setCurrent, syncNavigateForIndex, markFullscreenTransition]);
}
