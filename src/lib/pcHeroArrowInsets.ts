/**
 * PC 首页 NetShortPcCoverflowHero：箭头带宽度与舞台几何（与组件内 layoutScale 公式一致）。
 */

const NS_HERO_BANNER_SCALE = 1.12;
const NS_BASE_237_46 = 237.46;
const NS_BASE_OUTER_BASE = 237.46 + 147.25 + 78.12;
const BASE_X_INNER = Math.round(NS_BASE_237_46 * NS_HERO_BANNER_SCALE);
const BASE_X_OUTER = Math.round(NS_BASE_OUTER_BASE * NS_HERO_BANNER_SCALE);
const COVER_CARD_W = Math.round(310 * NS_HERO_BANNER_SCALE);
const COVER_HALF_W = COVER_CARD_W / 2;
const ARROW_CIRCLE_PX = Math.round(68 * NS_HERO_BANNER_SCALE);
const ARROW_TUCK_PER_SIDE_PX = Math.round(ARROW_CIRCLE_PX / 2) + 8;

export const RESPONSIVE_SAFE_GUTTER_PX = 100;

/** PC 整页版心上限（与 `.reelshort-topnav__inner` / Banner 外层一致） */
export const PC_HERO_OUTER_MAX_W_PX = 1636;

function coverflowGeometricSpanPx(n: number): number {
    if (n < 2) return COVER_CARD_W;
    if (n >= 4) return 2 * (BASE_X_OUTER + COVER_HALF_W);
    return 2 * (BASE_X_INNER + COVER_HALF_W);
}

/** 与 NetShortPcCoverflowHero 内 `coverflowTrackMaxWidthPx` 一致 */
export function coverflowTrackMaxWidthPx(n: number): number {
    const raw = coverflowGeometricSpanPx(n);
    if (n < 2) return raw;
    return Math.max(2 * ARROW_CIRCLE_PX, raw - 2 * ARROW_TUCK_PER_SIDE_PX);
}
