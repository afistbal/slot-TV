/** 接口默认每页条数（foryou 常见 10 条/页） */
export const FORYOU_DEFAULT_PER_PAGE = 10;

/** 距列表末尾几条时预拉下一页（10 条/页时滑到第 9 条即 index 8 触发） */
export const FORYOU_LOAD_MORE_PREFETCH_FROM_END = 2;

/** 首条上拉刷新：在顶部 overscroll 超过该像素触发 */
export const FORYOU_PULL_REFRESH_THRESHOLD_PX = 72;

/** H5 缓冲 loading：超过该时长仍未 canplay 才展示 */
export const FORYOU_H5_BUFFER_LOADER_DELAY_MS = 3000;

/** For You 挂载窗口：相对当前条向上保留（PC/H5 一致，对标 douyin prev=1） */
export const FORYOU_PLAYER_WINDOW_PREV = 1;

/** For You 挂载窗口：相对当前条向下保留（PC/H5 一致，对标 douyin next=2） */
export const FORYOU_PLAYER_WINDOW_NEXT = 2;

/** 挂载窗口再向下 1 条：隐藏 video metadata 预拉（已由邻格 +1/+2 承担） */
export const FORYOU_HIDDEN_PRELOAD_BELOW_OFFSET = FORYOU_PLAYER_WINDOW_NEXT + 1;

export function isInForyouPlayerWindow(index: number, activeIndex: number): boolean {
    return (
        index >= activeIndex - FORYOU_PLAYER_WINDOW_PREV &&
        index <= activeIndex + FORYOU_PLAYER_WINDOW_NEXT
    );
}
