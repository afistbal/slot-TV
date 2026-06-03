/** 接口默认每页条数（foryou 常见 10 条/页） */
export const FORYOU_DEFAULT_PER_PAGE = 10;

/** 距列表末尾几条时预拉下一页（10 条/页时滑到第 9 条即 index 8 触发） */
export const FORYOU_LOAD_MORE_PREFETCH_FROM_END = 2;

/** 首条上拉刷新：在顶部 overscroll 超过该像素触发 */
export const FORYOU_PULL_REFRESH_THRESHOLD_PX = 72;

/** H5 缓冲 loading：超过该时长仍未 canplay 才展示 */
export const FORYOU_H5_BUFFER_LOADER_DELAY_MS = 3000;

/** H5 邻条窗口：当前条 ±N（对标 douyin prev=1 / next=2 的简化版） */
export const FORYOU_H5_PLAYER_WINDOW_RADIUS = 1;
