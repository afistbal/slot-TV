/** PC 舞台（侧栏右缘）与抽屉左缘间距，与 measurePcStageShiftPx 目标间隙一致 */
export const PC_DRAWER_STAGE_GAP_PX = 54;

/** 与 .video-pc-right-drawer max-width / --pc-drawer-panel-width 一致 */
const PC_DRAWER_MAX_WIDTH_PX = 340;
const PC_DRAWER_INNER_MAX_PX = 1600;
const PC_DRAWER_INNER_WIDTH_RATIO = 0.88;
const PC_DRAWER_WIDTH_VW_RATIO = 0.38;
const PC_DRAWER_RIGHT_INSET_MIN_PX = 8;
/** 与 .video-player-pc-right-rail `right` 的 +12px 一致 */
const PC_DRAWER_RAIL_RIGHT_OFFSET_PX = 12;
/** 与 .video-player-pc-episode-nav__btn 宽度一致 */
export const PC_EPISODE_NAV_COLUMN_PX = 48;
/** 与 .video-player-pc-right-rail gap 一致 */
export const PC_DRAWER_NAV_GAP_PX = 10;

function pcDrawerRightInsetPx(shellWidth: number): number {
    const innerMax = Math.min(shellWidth * PC_DRAWER_INNER_WIDTH_RATIO, PC_DRAWER_INNER_MAX_PX);
    return Math.max(PC_DRAWER_RIGHT_INSET_MIN_PX, (shellWidth - innerMax) / 2);
}

function pcDrawerWidthPx(shellWidth: number): number {
    return Math.min(PC_DRAWER_MAX_WIDTH_PX, shellWidth * PC_DRAWER_WIDTH_VW_RATIO);
}

/** 抽屉右缘距 shell 右缘（预留上下集列 + 间距，与顶栏头像列对齐） */
function pcDrawerReservedRightPx(shellWidth: number): number {
    const rightInset = pcDrawerRightInsetPx(shellWidth);
    return (
        rightInset +
        PC_DRAWER_RAIL_RIGHT_OFFSET_PX +
        PC_EPISODE_NAV_COLUMN_PX +
        PC_DRAWER_NAV_GAP_PX
    );
}

/** 抽屉左缘（视口坐标） */
function pcDrawerLeftPx(shellRect: DOMRect): number {
    return shellRect.right - pcDrawerReservedRightPx(shellRect.width) - pcDrawerWidthPx(shellRect.width);
}

/**
 * 计算舞台左移量：基于未应用 transform 的布局位置，避免 translate 后测量回弹导致压盖侧栏。
 */
export function measurePcStageShiftPx(shell: HTMLElement, cluster: HTMLElement): number {
    const shellRect = shell.getBoundingClientRect();
    const clusterRight = shellRect.left + cluster.offsetLeft + cluster.offsetWidth;
    const drawerLeft = pcDrawerLeftPx(shellRect);
    let shift = Math.max(0, Math.ceil(clusterRight + PC_DRAWER_STAGE_GAP_PX - drawerLeft));

    const drawer = shell.querySelector<HTMLElement>('.video-pc-right-drawer--open');
    if (drawer) {
        const actualOverlap = clusterRight + PC_DRAWER_STAGE_GAP_PX - drawer.getBoundingClientRect().left;
        shift = Math.max(shift, Math.max(0, Math.ceil(actualOverlap)));
    }

    return shift;
}
