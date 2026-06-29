/**
 * QD: 9085 模块 79462（L484–562）
 * 见 QUICKDRAMA-REFERENCE.md §功能1、§功能2
 */
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { isQdControlTarget } from './isQdControlTarget';
import type { QdVerticalFeedHandle } from './types';

import './qd-feed-demo.scss';

export type QdVerticalFeedProps<T> = {
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    currentIndex: number;
    onSlideChange?: (index: number) => void;
    width?: number;
    height?: number;
    bottomOffset?: number;
};

function QdVerticalFeedInner<T>(
    {
        items,
        renderItem,
        currentIndex,
        onSlideChange,
        width,
        height,
        bottomOffset = 0,
    }: QdVerticalFeedProps<T>,
    ref: React.ForwardedRef<QdVerticalFeedHandle>,
) {
    const isFirstTouchRef = useRef(true);
    const lastTouchYRef = useRef(0);
    const touchStartYRef = useRef(0);
    const [offsetY, setOffsetY] = useState(0);
    const [animating, setAnimating] = useState(false);

    const feedWidth = width ?? window.innerWidth;
    const slideHeight = (height ?? window.innerHeight) - bottomOffset;

    useEffect(() => {
        setOffsetY(slideHeight * currentIndex);
    }, [currentIndex, slideHeight]);

    useImperativeHandle(ref, () => ({
        scrollTo: (index: number) => {
            setOffsetY(slideHeight * index);
            onSlideChange?.(index);
            setAnimating(true);
            window.setTimeout(() => setAnimating(false), 400);
        },
        scrollToNoAnimation: (index: number) => {
            setOffsetY(slideHeight * index);
        },
    }));

    /** QD: L512–514 预加载 — 仅 current 与 current+1 渲染 player */
    const renderSlot = (item: T, index: number) => {
        if (currentIndex === index || currentIndex + 1 === index) {
            return renderItem(item, index);
        }
        return <div className="h-screen w-full" />;
    };

    return (
        <div
            className="qd-vertical-feed overflow-hidden relative"
            onTouchStart={(e) => {
                if (isQdControlTarget(e.target)) return;
                const touch = e.touches[0];
                if (!touch) return;
                const clientY = touch.clientY;
                touchStartYRef.current = clientY;
                if (isFirstTouchRef.current) {
                    lastTouchYRef.current = clientY;
                } else {
                    lastTouchYRef.current = offsetY + clientY;
                }
            }}
            onTouchMove={(e) => {
                if (isQdControlTarget(e.target)) return;
                const touch = e.touches[0];
                if (!touch) return;
                let next = lastTouchYRef.current - touch.clientY;
                const max = slideHeight * (items.length - 1);
                if (next < 0) next = 0;
                if (next > max) next = max;
                setOffsetY(next);
            }}
            onTouchEnd={(e) => {
                e.stopPropagation();
                if (isQdControlTarget(e.target)) return;
                const touch = e.changedTouches[0];
                if (!touch) return;
                const clientY = touch.clientY;
                isFirstTouchRef.current = false;

                let nextIndex = currentIndex;
                if (touchStartYRef.current - clientY > 20) {
                    nextIndex = currentIndex + 1;
                } else if (touchStartYRef.current - clientY < -20) {
                    // QD L538: g.current - t < -20 && !u.current（touchend 开头已将 u 置 false）
                    nextIndex = currentIndex - 1;
                }

                if (nextIndex < items.length && nextIndex >= 0) {
                    setOffsetY(slideHeight * nextIndex);
                    setAnimating(true);
                    window.setTimeout(() => setAnimating(false), 400);
                    if (nextIndex !== currentIndex) {
                        onSlideChange?.(nextIndex);
                    }
                }
            }}
            style={{
                height: `${slideHeight}px`,
                width: `${feedWidth}px`,
                marginBottom: `${bottomOffset}px`,
            }}
        >
            <div
                className="w-full h-full absolute qd-vertical-feed__track"
                style={{
                    transform: `translateY(${-offsetY}px)`,
                    transition: animating ? 'transform 0.4s ease-in-out' : 'none',
                }}
            >
                {items.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            height: `${slideHeight}px`,
                            width: `${feedWidth}px`,
                        }}
                    >
                        {renderSlot(item, index)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export const QdVerticalFeed = forwardRef(QdVerticalFeedInner) as <T>(
    props: QdVerticalFeedProps<T> & { ref?: React.ForwardedRef<QdVerticalFeedHandle> },
) => ReturnType<typeof QdVerticalFeedInner>;
