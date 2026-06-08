/**
 * @deprecated 请使用 `useVideoSeriesEpisodeQueues`（双队列：全量 + 预加载窗口 ±1）
 */
export { syncVideoPreloadWindow as prewarmVideoSeriesWindow } from './videoEpisodeQueues';
export { getPreloadWindowRowIds as getEpisodeIdsToPrewarm } from './videoEpisodeQueues';
