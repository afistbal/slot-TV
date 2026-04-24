import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useConfigStore } from '@/stores/config';
import { useHomeStore, type IItem } from '@/stores/home';
import { cn } from '@/lib/utils';

const TRANSITION_MS = 500;
/** 对方：Math.max(500-80, 260) */
const IMG_OPACITY_MS = Math.max(TRANSITION_MS - 80, 260);

/**
 * 相对原离线图镜像(310×410 / 舞台 480)整体放大，贴近线上 `netshort.com` 首页 Banner 体量；
 * 位移与 getSlideLayout 同比例，避免 3D 队形散掉。
 */
const NS_HERO_BANNER_SCALE = 1.12;
const NS_BASE_237_46 = 237.46;
const NS_BASE_OUTER_BASE = 237.46 + 147.25 + 78.12;
const BASE_X_INNER = Math.round(NS_BASE_237_46 * NS_HERO_BANNER_SCALE);
const BASE_X_OUTER = Math.round(NS_BASE_OUTER_BASE * NS_HERO_BANNER_SCALE);
/** 对站 zh：perspective 舞台固定高度 */
const STAGE_PX = Math.round(480 * NS_HERO_BANNER_SCALE);
/** 单卡尺寸（与 getSlideLayout 位移一致；原 310×410） */
const COVER_CARD_W = Math.round(310 * NS_HERO_BANNER_SCALE);
const COVER_CARD_H = Math.round(410 * NS_HERO_BANNER_SCALE);
const COVER_HALF_W = COVER_CARD_W / 2;
/** 对站 h-[68px] 原钮，随 Banner 略放大；圆心对齐时两侧内收用 tuck */
const ARROW_CIRCLE_PX = Math.round(68 * NS_HERO_BANNER_SCALE);
const ARROW_TUCK_PER_SIDE_PX = Math.round(ARROW_CIRCLE_PX / 2) + 8;
const HERO_CIRCLE_OFFSET_PX = Math.round(60 * NS_HERO_BANNER_SCALE);
const HERO_CIRCLE_PX: [number, number] = [Math.round(1390 * NS_HERO_BANNER_SCALE), Math.round(116 * NS_HERO_BANNER_SCALE)];
const RESPONSIVE_SAFE_GUTTER_PX = 100;

/**
 * 五张时卡区几何外接宽（与 translateX(±BASE_X_OUTER) 一致），再每侧内收「约半圆+8」
 * 使 flex 行不会比 5 张图视觉还宽一截；列上 px-2 与 3D 进深不必再进这道公式，走 tuck 手调。
 */
function coverflowGeometricSpanPx(n: number): number {
    if (n < 2) return COVER_CARD_W;
    if (n >= 4) return 2 * (BASE_X_OUTER + COVER_HALF_W);
    return 2 * (BASE_X_INNER + COVER_HALF_W);
}

function coverflowTrackMaxWidthPx(n: number): number {
    const raw = coverflowGeometricSpanPx(n);
    if (n < 2) return raw;
    return Math.max(2 * ARROW_CIRCLE_PX, raw - 2 * ARROW_TUCK_PER_SIDE_PX);
}

const heroImageUrl = (staticBase: string, imagePath: string) => {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    return `${staticBase}/${imagePath}`;
};

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

/**
 * 对方源码：`((e - t + n) % r + r) % r - n`（e=slide 下标, t=currentIndex, r=条数, n=floor(r/2)）
 * 每格 DOM 仍绑定「第 t 条」数据，只随 k 变化改变 rel → 只动画 transform，不会整屏换图。
 */
function relFromCenter(slideIndex: number, k: number, total: number): number {
    if (total <= 0) return 0;
    const half = Math.floor(total / 2);
    return ((slideIndex - k + half) % total + total) % total - half;
}

/** 镜像里 `getSlideLayout`（参数为 rel） */
function getSlideLayout(
    rel: number,
    geom: { xInner: number; xOuter: number; zFront: number; zInner: number; zOuter: number; zBack: number },
) {
    const t = (x: number, rest: string) =>
        `translateX(calc(-50% + ${x}px)) translateY(-50%) ${rest}`;
    if (rel === 0) {
        return {
            transform: t(0, `translateZ(${geom.zFront}px) scale(1) rotateY(0deg)`),
            zIndex: 30,
            wrapOpacity: 1,
        };
    }
    if (rel === 1) {
        return {
            transform: t(geom.xInner, `translateZ(${geom.zInner}px) scale(0.95) rotateY(-26deg)`),
            zIndex: 20,
            wrapOpacity: 1,
        };
    }
    if (rel === -1) {
        return {
            transform: t(-geom.xInner, `translateZ(${geom.zInner}px) scale(0.95) rotateY(26deg)`),
            zIndex: 20,
            wrapOpacity: 1,
        };
    }
    if (rel === 2) {
        return {
            transform: t(geom.xOuter, `translateZ(${geom.zOuter}px) scale(0.9) rotateY(-32deg)`),
            zIndex: 10,
            wrapOpacity: 1,
        };
    }
    if (rel === -2) {
        return {
            transform: t(-geom.xOuter, `translateZ(${geom.zOuter}px) scale(0.9) rotateY(32deg)`),
            zIndex: 10,
            wrapOpacity: 1,
        };
    }
    return {
        transform: t(0, `translateZ(${geom.zBack}px) scale(0.5) rotateY(0deg)`),
        zIndex: 5,
        wrapOpacity: 0,
    };
}

function coverOpacityForRel(rel: number) {
    if (rel === 0) return 1;
    if (Math.abs(rel) === 1) return 0.6;
    return 0.3;
}

/** 不将封面 slide（div[role=button]）算入：否则在封面上无法开始横向拖拽。真实 <button> / 链接 仍会排除。 */
function isInteractiveUI(target: EventTarget | null) {
    return target instanceof HTMLElement && !!target.closest('button, a, input, textarea, select');
}

type Props = {
    className?: string;
    goHeroIndex: (next: number) => void;
};

/**
 * 对标 netshort 桌面 `ultra-light-carousel`：自研 3D 位移动画（非 Swiper）。
 * H5 用 Swiper + coverflow；本组件仅在 md+ 使用。
 */
export function NetShortPcCoverflowHero({ className, goHeroIndex }: Props) {
    const navigate = useNavigate();
    const configStore = useConfigStore();
    const homeStore = useHomeStore();
    const staticBase = configStore.config['static'] as string;
    const topList = homeStore.data?.top ?? [];
    const n = topList.length;
    const k = n > 0 ? Math.min(Math.max(homeStore.current, 0), n - 1) : 0;

    const [isDragging, setIsDragging] = useState(false);
    const [layoutScale, setLayoutScale] = useState(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartX = useRef(0);
    /** 横向切张后同一次松手会合成 click，避免与 onCoverActivate 点进详情重复 */
    const suppressNextCoverClickRef = useRef(false);

    const onPrev = useCallback(() => {
        if (n <= 1) return;
        goHeroIndex(k - 1);
    }, [k, n, goHeroIndex]);

    const onNext = useCallback(() => {
        if (n <= 1) return;
        goHeroIndex(k + 1);
    }, [k, n, goHeroIndex]);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.button !== 0) return;
            if (isInteractiveUI(e.target)) return;
            // 不可对封面/图片 preventDefault，否则不派发 click；亦勿 setPointerCapture，否则部分环境下不合成 click
            isDraggingRef.current = true;
            setIsDragging(true);
            dragStartX.current = e.clientX;
        },
        [],
    );

    const handlePointerUp = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            setIsDragging(false);
            const dx = e.clientX - dragStartX.current;
            if (Math.abs(dx) > 50) {
                suppressNextCoverClickRef.current = true;
                if (dx > 50) {
                    onPrev();
                } else {
                    onNext();
                }
                window.setTimeout(() => {
                    suppressNextCoverClickRef.current = false;
                }, 100);
            }
        },
        [onNext, onPrev],
    );

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const update = () => {
            const width = el.clientWidth;
            if (!width) return;
            const baseTrack = coverflowTrackMaxWidthPx(n);
            if (!baseTrack) return;
            // 预留左右安全边距，避免到临界值才开始缩小（背景与白线图是一体视觉）
            const available = Math.max(width - RESPONSIVE_SAFE_GUTTER_PX, 1);
            const s = Math.max(0.55, Math.min(1, available / baseTrack));
            setLayoutScale(s);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [n]);

    // 预加载封面
    useEffect(() => {
        const urls = topList.map((it) => heroImageUrl(staticBase, it.image));
        const keep: HTMLImageElement[] = [];
        for (const u of urls) {
            const im = new Image();
            im.decoding = 'async';
            im.src = u;
            keep.push(im);
        }
        return () => {
            for (const im of keep) {
                im.src = '';
            }
        };
    }, [topList, staticBase]);

    if (n < 1) {
        return null;
    }

    const noTransition = isDragging;
    const transformEase = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const stageHeight = Math.round(STAGE_PX * layoutScale);
    const cardW = Math.round(COVER_CARD_W * layoutScale);
    const cardH = Math.round(COVER_CARD_H * layoutScale);
    const arrowSize = Math.round(ARROW_CIRCLE_PX * layoutScale);
    const circleW = Math.round(HERO_CIRCLE_PX[0] * layoutScale);
    const circleH = Math.round(HERO_CIRCLE_PX[1] * layoutScale);
    const circleBottom = Math.round(HERO_CIRCLE_OFFSET_PX * layoutScale);
    const trackMaxWidth = Math.round(coverflowTrackMaxWidthPx(n) * layoutScale);
    const geom = {
        xInner: Math.round(BASE_X_INNER * layoutScale),
        xOuter: Math.round(BASE_X_OUTER * layoutScale),
        zFront: Math.round(52 * layoutScale),
        zInner: Math.round(-34 * layoutScale),
        zOuter: Math.round(-92 * layoutScale),
        zBack: Math.round(-120 * layoutScale),
    };

    return (
        <div className={className} aria-hidden={false}>
            {/*
             * 对站 zh：底 padding + 舞台高与 netshort 一致；外层略加宽于原 70%，接近线上 Banner 占比
             */}
            <div
                className="ultra-light-carousel relative w-full select-none overflow-visible rounded-none pb-[min(7.5vw,112px)]"
                style={{ overflow: 'visible' }}
            >
                <div className="alert-container pointer-events-none text-white" aria-hidden style={{ display: 'none' }} />
                <div className="relative z-[1] mx-auto w-full min-w-0 max-w-screen-2xl px-2 md:w-[min(88%,1600px)]">
                    <div
                        ref={stageRef}
                        className="relative w-full touch-none overflow-visible pb-6"
                        style={{
                            height: stageHeight,
                            perspective: '1100px',
                            perspectiveOrigin: '50% 50%',
                        }}
                        onPointerDown={n > 1 ? handlePointerDown : undefined}
                        onPointerUp={n > 1 ? handlePointerUp : undefined}
                        onPointerCancel={n > 1 ? handlePointerUp : undefined}
                    >
                        {topList.map((item: IItem, t: number) => {
                            const rel = n <= 1 ? 0 : relFromCenter(t, k, n);
                            const L = getSlideLayout(rel, geom);
                            const isCenter = rel === 0;
                            const isSide = Math.abs(rel) === 1;
                            const coverOp = coverOpacityForRel(rel);
                            const href = toEpisodeOrVideoHref(item);
                            const src = heroImageUrl(staticBase, item.image);
                            const imgTrans = noTransition
                                ? 'none'
                                : `opacity ${IMG_OPACITY_MS}ms ease`;

                            /** 对方每张 slide 始终同一套 Image 节点；不可在「中间 / 非中间」时切换不同标签，否则会卸载 img 造成闪黑。 */
                            const onCoverActivate = (e: React.SyntheticEvent) => {
                                if (suppressNextCoverClickRef.current) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                                e.stopPropagation();
                                if (isCenter) {
                                    void navigate(href);
                                } else {
                                    goHeroIndex(t);
                                }
                            };

                            return (
                                <div
                                    key={`${item.id}-${t}`}
                                    className="absolute left-1/2 top-1/2 select-none pointer-events-none"
                                    style={{
                                        width: cardW,
                                        height: cardH,
                                        zIndex: L.zIndex,
                                        opacity: L.wrapOpacity,
                                        transform: L.transform,
                                        transformOrigin: 'center center',
                                        transformStyle: 'preserve-3d',
                                        transition: noTransition
                                            ? 'none'
                                            : `transform ${TRANSITION_MS}ms ${transformEase}`,
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                    }}
                                >
                                    <div
                                        className={cn(
                                            'relative h-full w-full rounded-[20px]',
                                            L.wrapOpacity === 0
                                                ? 'pointer-events-none'
                                                : 'pointer-events-auto cursor-pointer',
                                        )}
                                        style={{ backfaceVisibility: 'hidden' }}
                                        role={L.wrapOpacity === 0 ? undefined : 'button'}
                                        tabIndex={L.wrapOpacity === 0 ? undefined : 0}
                                        onClick={onCoverActivate}
                                        onKeyDown={(e) => {
                                            if (e.key !== 'Enter' && e.key !== ' ') return;
                                            e.preventDefault();
                                            onCoverActivate(e);
                                        }}
                                    >
                                        <div className="relative h-full w-full overflow-hidden rounded-[20px]">
                                            <div className="pointer-events-none absolute inset-0 z-0 bg-black" />
                                            <div className="absolute inset-0 z-[1]">
                                                <img
                                                    src={src}
                                                    alt={item.title}
                                                    draggable={false}
                                                    width={cardW}
                                                    height={cardH}
                                                    loading="eager"
                                                    decoding="async"
                                                    fetchPriority={t === 0 ? 'high' : 'auto'}
                                                    className="absolute inset-0 h-full w-full select-none object-cover [user-drag:none]"
                                                    style={{ opacity: coverOp, transition: imgTrans }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {isCenter && (
                                        <div className="absolute left-0 right-0 top-full mt-[12px] flex flex-col justify-center px-2 text-left">
                                            <span className="truncate font-[Inter] text-[22px] font-medium leading-snug text-white">
                                                {item.title}
                                            </span>
                                        </div>
                                    )}
                                    {isSide && !isCenter && (
                                        <div
                                            className={cn(
                                                'absolute left-0 right-0 top-full mt-[12px] flex flex-col justify-center px-2 text-left',
                                                rel === 1 ? 'ml-[30%]' : '',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'truncate font-[Inter] text-[15px] font-medium leading-snug text-white/80',
                                                    rel === 1 ? 'w-full' : 'w-[70%]',
                                                )}
                                            >
                                                {item.title}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {n > 1 ? (
                            <div
                                className="pointer-events-none absolute left-1/2 top-1/2 z-[100] flex items-center justify-between"
                                style={{
                                    width: '100%',
                                    maxWidth: trackMaxWidth,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <button
                                    type="button"
                                    className="pointer-events-auto flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 cursor-pointer bg-white/16"
                                    style={{ width: arrowSize, height: arrowSize }}
                                    aria-label="Prev"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onPrev();
                                    }}
                                >
                                    <img
                                        src="/netshort/arrow@2x.png"
                                        alt="Prev"
                                        loading="lazy"
                                        width={28}
                                        height={28}
                                        decoding="async"
                                        className="rotate-180 w-auto h-[28px] relative z-[101] mr-[6px]"
                                        style={{ color: 'transparent' }}
                                    />
                                </button>
                                <button
                                    type="button"
                                    className="pointer-events-auto flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 cursor-pointer bg-white/16"
                                    style={{ width: arrowSize, height: arrowSize }}
                                    aria-label="Next"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onNext();
                                    }}
                                >
                                    <img
                                        src="/netshort/arrow@2x.png"
                                        alt="Next"
                                        loading="lazy"
                                        width={28}
                                        height={28}
                                        decoding="async"
                                        className="w-auto h-[28px] relative z-[101] ml-[6px]"
                                        style={{ color: 'transparent' }}
                                    />
                                </button>
                            </div>
                        ) : null}

                        <img
                            src="/netshort/home-circle.png"
                            alt="home-circle"
                            width={circleW}
                            height={circleH}
                            loading="lazy"
                            decoding="async"
                            className="pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2"
                            style={{
                                bottom: -circleBottom,
                                width: circleW,
                                height: circleH,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
