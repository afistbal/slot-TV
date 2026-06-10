/** 单条 Feed 视频（与业务 API 解耦，for-demo 只做 id + mp4 url 映射） */
export type DouyinFeedVideoItem = {
    id: string | number;
    url: string;
};

export type PlaybackMode = 'mse' | 'native';

export type FeedNavigateDirection = 'next' | 'prev' | 'auto';

export type DouyinFeedPlayerProps = {
    items: DouyinFeedVideoItem[];
    /** config.static 等静态资源域名，用于拼接相对 video 路径 */
    mediaBaseUrl?: string;
    className?: string;
    /** 对标 MD §2.5：切条回调 */
    onIndexChange?: (index: number, direction: FeedNavigateDirection) => void;
    /** 对标 MD §2.6：是否预加载下一条（影响 isInitPlayer） */
    preloadNext?: boolean;
    /** 初始索引 */
    initialIndex?: number;
    /** iOS MD §9：MSE / native 模式切换回调 */
    onPlaybackModeChange?: (index: number, mode: PlaybackMode) => void;
    /** iOS MD §9：卡顿 / 降级原因回调 */
    onStall?: (index: number, reason: string) => void;
    /** 是否展示底部控制条（静音/倍速/播放/全屏），默认 true */
    showControls?: boolean;
};

export type PlayerSlotState = {
    index: number;
    item: DouyinFeedVideoItem;
    positionOffset: number;
    isActive: boolean;
    shouldInitPlayer: boolean;
};
