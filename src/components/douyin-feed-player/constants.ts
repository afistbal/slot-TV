/**
 * 常量来自：
 * - 抖音H5滑动与播放逻辑分析.md §2.4 / §2.6
 * - 抖音H5-iOS播放适配分析.md §3 / §7
 */

/** routes-route L3073-3087：滚轮累积阈值 */
export const WHEEL_DELTA_THRESHOLD = 40;

/** routes-route L3073-3087：滚轮防抖 ms */
export const WHEEL_DEBOUNCE_MS = 400;

/** §2.6：activeIndex ± 1，DOM 内最多 3 个 video */
export const PLAYER_WINDOW_RADIUS = 1;

/** client-entry mp4encryptplayer 默认 — iOS MD §3.1 */
export const MIN_BUFFER_LENGTH = 5;
export const MAX_BUFFER_LENGTH = 60;
export const RESUME_PLAY_WATER_LEVEL = 2;

/** player-9 _onWaiting — iOS MD §3.2 */
export const WAITING_IN_BUFFER_MS = 5000;
export const WAIT_JAMP_BUFFER_MAX_CNT = 3;

/** player-9 _loadStuckCheck — iOS MD §3.3 */
export const WAITING_STUCK_MS = 10000;

/** 倍速档位（UI 对齐 /video SPEED，逻辑独立存储） */
export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/** for-demo / For You：固定 1.0x（`PLAYBACK_SPEEDS` 下标） */
export const FIXED_PLAYBACK_SPEED_INDEX = 1;
